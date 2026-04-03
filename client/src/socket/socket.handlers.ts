// =============================================================================
// socket/socket.handlers.ts
// Registers incoming socket event listeners.
// Called once after socket connects — wires server events into the store.
// =============================================================================

import { getSocket } from './socket.client';
import { useChatStore } from '../store/chat.store';

/**
 * Attaches all server→client event listeners to the socket.
 * Must be called after connectSocket() and store initialisation.
 */
export function registerSocketHandlers(): void {
    const socket = getSocket();
    if (!socket) return;

    const store = useChatStore.getState();

    socket.on('message:new', store.receiveMessage);
    socket.on('message:edited', store.handleMessageEdited);
    socket.on('message:deleted', store.handleMessageDeleted);
    socket.on('message:reaction', store.handleMessageReaction);
    socket.on('typing:start', store.handleTypingStart);
    socket.on('typing:stop', store.handleTypingStop);
    socket.on('presence:update', store.handlePresenceUpdate);
    socket.on('read:receipt', store.handleReadReceipt);

    socket.on('connect', () => console.info('[Socket] connected'));
    socket.on('disconnect', (reason) => console.warn('[Socket] disconnected', reason));
    socket.on('connect_error', (err) => console.error('[Socket] error', err.message));
}
