// =============================================================================
// socket/socket.events.ts
// Typed event emitters — components/hooks call these, never socket directly.
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { getSocket } from './socket.client';
import type {
    SendMessagePayload,
    MessageAck
} from '@chatapp/shared';

/**
 * Sends a message via WebSocket with acknowledgement.
 * Returns a promise that resolves with the server's ack response.
 */
export function emitSendMessage(
    payload: Omit<SendMessagePayload, 'clientMsgId'>,
): Promise<Parameters<MessageAck>[0]> {
    return new Promise((resolve, reject) => {
        const socket = getSocket();
        if (!socket) return reject(new Error('Socket not connected'));

        const fullPayload: SendMessagePayload = {
            ...payload,
            clientMsgId: uuidv4(), // generate client-side unique ID for dedup
        };

        // 5s timeout — if no ack received, treat as failure
        const timeout = setTimeout(() => {
            reject(new Error('Message send timed out'));
        }, 5000);

        socket.emit('message:send', fullPayload, (ack) => {
            clearTimeout(timeout);
            resolve(ack);
        });
    });
}

export function emitTypingStart(conversationId: string): void {
    getSocket()?.emit('typing:start', { conversationId, userId: '' }); // userId filled server-side
}

export function emitTypingStop(conversationId: string): void {
    getSocket()?.emit('typing:stop', { conversationId, userId: '' });
}

export function emitReadMark(conversationId: string, upToSeq: number): void {
    getSocket()?.emit('read:mark', { conversationId, upToSeq });
}

export function emitPresencePing(): void {
    getSocket()?.emit('presence:ping');
}