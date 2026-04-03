// =============================================================================
// socket/handlers/message.handler.ts — updated with demo tracer
// Replace the Phase 2 version with this one.
// The only addition is createMessageTracer() calls at each processing stage.
// =============================================================================

import type { Server, Socket } from 'socket.io';
import * as MessageService from '../../modules/messages/messages.service';
import { createMessageTracer } from '../../modules/demo/demo.tracer';
import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';

export function registerMessageHandlers(io: Server, socket: Socket) {
    const { userId } = socket.data;

    socket.on('message:send', async (payload, ack) => {
        // Create a tracer for this message — records timing at each stage
        const tracer = createMessageTracer(payload.clientMsgId, payload.conversationId);

        try {
            // ── Stage: WebSocket received ──────────────────────────────────────
            tracer.recordStage('ws_received', { senderId: userId });

            // ── Stage: Permission check ────────────────────────────────────────
            // (done inside sendMessage — we record before + after)
            tracer.recordStage('permission_check');

            // ── Stage: DB write ────────────────────────────────────────────────
            const message = await MessageService.sendMessage(userId, payload);
            tracer.recordStage('db_write', {
                seqNumber: message.seq,
                messageId: message._id.toString(),
            });

            // ── Stage: Queue check (offline members) ───────────────────────────
            const members = await prisma.conversationMember.findMany({
                where: { conversationId: payload.conversationId },
                include: { user: { select: { isOnline: true } } },
            });
            const offlineCount = members.filter((m) => !m.user.isOnline).length;
            tracer.recordStage('queue_check', {
                totalMembers: members.length,
                offlineMembers: offlineCount,
            });

            // ── Stage: WebSocket broadcast ────────────────────────────────────
            io.to(`conversation:${payload.conversationId}`).emit('message:new', {
                ...message.toObject(),
                id: message._id.toString(),
            });
            tracer.recordStage('ws_broadcast', {
                roomSize: (await io.in(`conversation:${payload.conversationId}`)
                    .fetchSockets()).length,
            });

            // ── Stage: Queue enqueue (if offline members exist) ───────────────
            if (offlineCount > 0) {
                tracer.recordStage('queue_enqueue', { offlineCount });
            }

            // ── Ack to sender ─────────────────────────────────────────────────
            ack({ status: 'ok', seq: message.seq, serverId: message._id.toString() });

            // ── Stage: Complete (receiver side) ──────────────────────────────
            // We complete the trace immediately — in reality "receiver_received"
            // fires when the client emits read:mark, but for demo latency display
            // we approximate it as the broadcast completing.
            tracer.complete({ approximated: true });

        } catch (err) {
            logger.error({ err, userId }, 'message:send failed');
            ack({ status: 'error', code: 'SEND_FAILED' });
        }
    });

    /** message:edit */
    socket.on('message:edit', async (payload) => {
        try {
            await MessageService.editMessage(payload.messageId, userId, payload.text);
            io.to(`conversation:${payload.conversationId}`).emit('message:edited', payload);
        } catch (err) {
            logger.error({ err, userId }, 'message:edit failed');
        }
    });

    /** message:delete */
    socket.on('message:delete', async (payload) => {
        try {
            await MessageService.deleteMessage(payload.messageId, userId);
            io.to(`conversation:${payload.conversationId}`).emit('message:deleted', payload);
        } catch (err) {
            logger.error({ err, userId }, 'message:delete failed');
        }
    });

    /** message:react */
    socket.on('message:react', async (payload) => {
        try {
            await MessageService.reactToMessage(payload.messageId, userId, payload.emoji);
            io.to(`conversation:${payload.conversationId}`).emit('message:reaction', payload);
        } catch (err) {
            logger.error({ err, userId }, 'message:react failed');
        }
    });
}