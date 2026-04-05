/**
 * message.handler.ts — WebSocket message event handlers
 * Updated to properly emit read receipts after broadcast
 */

import type { Server, Socket } from 'socket.io';
import * as MessageService from '../../modules/messages/messages.service';
import { createMessageTracer } from '../../modules/demo/demo.tracer';
import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';

export function registerMessageHandlers(io: Server, socket: Socket) {
    const { userId } = socket.data;

    socket.on('message:send', async (payload, ack) => {
        const tracer = createMessageTracer(payload.clientMsgId, payload.conversationId);

        try {
            tracer.recordStage('ws_received', { senderId: userId });
            tracer.recordStage('permission_check');

            const message = await MessageService.sendMessage(userId, payload);
            tracer.recordStage('db_write', {
                seqNumber: message.seq,
                messageId: message._id.toString(),
            });

            const members = await prisma.conversationMember.findMany({
                where: { conversationId: payload.conversationId },
                include: { user: { select: { isOnline: true } } },
            });
            const offlineCount = members.filter((m) => !m.user.isOnline).length;
            tracer.recordStage('queue_check', {
                totalMembers: members.length,
                offlineMembers: offlineCount,
            });

            // Broadcast message to all conversation members
            const messageObj = {
                ...message.toObject(),
                id: message._id.toString(),
            };
            io.to(`conversation:${payload.conversationId}`).emit('message:new', messageObj);
            tracer.recordStage('ws_broadcast');

            if (offlineCount > 0) {
                tracer.recordStage('queue_enqueue', { offlineCount });
            }

            // Send ack to sender with seq + server ID
            ack({ status: 'ok', seq: message.seq, serverId: message._id.toString() });

            // Emit read receipt for sender (they've implicitly read their own message)
            io.to(`conversation:${payload.conversationId}`).emit('read:receipt', {
                conversationId: payload.conversationId,
                userId,
                upToSeq: message.seq,
                status: 'read' as const,
            });

            tracer.complete({ approximated: true });

        } catch (err) {
            logger.error({ err, userId }, 'message:send failed');
            ack({ status: 'error', code: 'SEND_FAILED' });
        }
    });

    socket.on('message:edit', async (payload) => {
        try {
            await MessageService.editMessage(payload.messageId, userId, payload.text);
            io.to(`conversation:${payload.conversationId}`).emit('message:edited', payload);
        } catch (err) {
            logger.error({ err, userId }, 'message:edit failed');
        }
    });

    socket.on('message:delete', async (payload) => {
        try {
            await MessageService.deleteMessage(payload.messageId, userId);
            io.to(`conversation:${payload.conversationId}`).emit('message:deleted', payload);
        } catch (err) {
            logger.error({ err, userId }, 'message:delete failed');
        }
    });

    socket.on('message:react', async (payload) => {
        try {
            await MessageService.reactToMessage(payload.messageId, userId, payload.emoji);
            io.to(`conversation:${payload.conversationId}`).emit('message:reaction', payload);
        } catch (err) {
            logger.error({ err, userId }, 'message:react failed');
        }
    });
}