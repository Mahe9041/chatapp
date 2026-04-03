// =============================================================================
// socket/handlers/typing.handler.ts
// Typing indicators — purely ephemeral, never persisted to DB.
// =============================================================================

import type { Server, Socket } from 'socket.io';
import { logger } from '../../utils/logger';

// Map of userId → timeout handle for auto-clearing stale typing state
const typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const TYPING_TIMEOUT_MS = 5000; // clear typing if no stop event after 5s

export function registerTypingHandlers(io: Server, socket: Socket) {
    const { userId } = socket.data;

    socket.on('typing:start', (payload) => {
        // Broadcast to room EXCLUDING the sender (they know they're typing)
        socket.to(`conversation:${payload.conversationId}`).emit('typing:start', {
            ...payload,
            userId,
        });

        // Reset auto-clear timeout — prevents stuck "typing..." if client crashes
        const key = `${userId}:${payload.conversationId}`;
        clearTimeout(typingTimeouts.get(key));
        typingTimeouts.set(
            key,
            setTimeout(() => {
                socket.to(`conversation:${payload.conversationId}`)
                    .emit('typing:stop', { ...payload, userId });
                typingTimeouts.delete(key);
            }, TYPING_TIMEOUT_MS),
        );
    });

    socket.on('typing:stop', (payload) => {
        socket.to(`conversation:${payload.conversationId}`).emit('typing:stop', {
            ...payload,
            userId,
        });
        // Cancel the auto-clear since client sent explicit stop
        const key = `${userId}:${payload.conversationId}`;
        clearTimeout(typingTimeouts.get(key));
        typingTimeouts.delete(key);
    });

    // Clean up all typing timeouts when socket disconnects
    socket.on('disconnect', () => {
        typingTimeouts.forEach((timeout, key) => {
            if (key.startsWith(userId)) {
                clearTimeout(timeout);
                typingTimeouts.delete(key);
            }
        });
    });
}