// =============================================================================
// queue/jobs/message.delivery.job.ts
// Worker that processes offline message delivery jobs.
// When a user reconnects, their pending messages are delivered via WebSocket.
// =============================================================================

import { Worker, Job } from 'bullmq';
import { redisWorker } from '../../config/redis';
import { MessageModel } from '../../db/mongo/models/message.model';
import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';
import type { MessageDeliveryJobData } from '../queue.client';

// io is imported lazily to avoid circular dependency
// (socket.server → queue → socket.server)
let getIo: (() => import('socket.io').Server | null) | null = null;

/** Called from server.ts after io is initialised to break circular dep */
export function setIoGetter(fn: () => import('socket.io').Server | null) {
    getIo = fn;
}

/**
 * Delivers a queued message to a recipient who was offline.
 *
 * Strategy:
 *  1. Check if the recipient is now online (has an active socket)
 *  2. If yes → emit message:new directly to their socket
 *  3. If still offline → enqueue a push notification instead
 *  4. Update deliveryStatus from 'sent' → 'delivered'
 */
async function processMessageDelivery(
    job: Job<MessageDeliveryJobData>,
): Promise<void> {
    const { messageId, conversationId, recipientIds } = job.data;

    // Fetch the message (it may have been deleted since queueing)
    const message = await MessageModel.findById(messageId).lean();
    if (!message || message.deletedAt) {
        logger.info({ messageId }, 'Message delivery skipped — message deleted');
        return;
    }

    const io = getIo?.();

    for (const recipientId of recipientIds) {
        // Check if user is now connected (has an active socket in our rooms)
        const user = await prisma.user.findUnique({
            where: { id: recipientId },
            select: { isOnline: true },
        });

        if (user?.isOnline && io) {
            // User came back online — deliver immediately via WebSocket
            // We emit to the conversation room; if they've rejoined they'll get it
            io.to(`conversation:${conversationId}`).emit('message:new', {
                ...message,
                id: message._id.toString(),
            } as unknown as import('@chatapp/shared').Message);

            // Update delivery status
            await MessageModel.updateOne(
                { _id: messageId },
                { $set: { [`deliveryStatus.${recipientId}`]: 'delivered' } },
            );

            logger.debug({ messageId, recipientId }, 'Offline message delivered via WebSocket');
        } else {
            // Still offline — trigger push notification
            const { pushNotificationQueue } = await import('../queue.client');
            await pushNotificationQueue.add('push', {
                recipientId,
                messageId,
                conversationId,
                title: 'New message',
                body: (message.content as { text?: string }).text?.slice(0, 100) ?? '📎 Attachment',
                senderName: 'Someone', // resolved in push worker
            });
        }
    }
}

/** Starts the message delivery worker process */
export function startMessageDeliveryWorker(): Worker {
    const worker = new Worker<MessageDeliveryJobData>(
        'message-delivery',
        processMessageDelivery,
        {
            connection: redisWorker,
            concurrency: 10, // process up to 10 delivery jobs simultaneously
        },
    );

    worker.on('completed', (job) => {
        logger.debug({ jobId: job.id }, 'Message delivery job completed');
    });

    worker.on('failed', (job, err) => {
        logger.error({ jobId: job?.id, err }, 'Message delivery job failed');
    });

    return worker;
}
