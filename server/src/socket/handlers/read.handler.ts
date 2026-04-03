// =============================================================================
// socket/handlers/read.handler.ts
// Read receipts — marks messages as read and notifies conversation members.
// =============================================================================

import type { Server, Socket } from 'socket.io';
import * as MessageRepo from '../../modules/messages/messages.repository';
import * as ConvoRepo from '../../modules/conversations/conversations.repository';
import { logger } from '../../utils/logger';

export function registerReadHandlers(io: Server, socket: Socket) {
    const { userId } = socket.data;

    /**
     * read:mark — client tells server they've read up to a certain seq number.
     * We mark messages in DB and broadcast a receipt to conversation members
     * so other clients can update their delivery status indicators (✓✓ blue).
     */
    socket.on('read:mark', async (payload) => {
        try {
            await Promise.all([
                MessageRepo.markMessagesRead(
                    payload.conversationId,
                    userId,
                    payload.upToSeq,
                ),
                ConvoRepo.markAsRead(payload.conversationId, userId),
            ]);

            // Notify conversation members that this user has read up to this point
            io.to(`conversation:${payload.conversationId}`).emit('read:receipt', {
                conversationId: payload.conversationId,
                userId,
                upToSeq: payload.upToSeq,
                status: 'read',
            });
        } catch (err) {
            logger.error({ err, userId }, 'read:mark failed');
        }
    });
}