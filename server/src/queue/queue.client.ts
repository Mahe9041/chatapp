// =============================================================================
// queue/queue.client.ts
// BullMQ queue definitions.
// Each queue has a dedicated Redis connection (BullMQ requirement).
// =============================================================================

import { Queue } from 'bullmq';
import { redisWorker } from '../config/redis';
import { logger } from '../utils/logger';

// ── Connection config shared by all queues ────────────────────────────────────
const connection = redisWorker;

// =============================================================================
// Queue: message-delivery
// Handles delivering messages to users who were offline when the message
// was sent. When they reconnect, pending jobs are processed and the messages
// are pushed via WebSocket.
// =============================================================================

export interface MessageDeliveryJobData {
    messageId: string;   // MongoDB ObjectId string
    conversationId: string;
    senderId: string;
    recipientIds: string[]; // users who were offline at send time
}

export const messageDeliveryQueue = new Queue<MessageDeliveryJobData>(
    'message-delivery',
    {
        connection,
        defaultJobOptions: {
            attempts: 5,        // retry up to 5 times on failure
            backoff: {
                type: 'exponential',
                delay: 2000,         // 2s → 4s → 8s → 16s → 32s
            },
            removeOnComplete: { count: 100 },  // keep last 100 completed jobs for debugging
            removeOnFail: { count: 500 },  // keep failed jobs longer for investigation
        },
    },
);

// =============================================================================
// Queue: push-notification
// Sends FCM push notifications to mobile/desktop clients that are not
// connected via WebSocket (app is backgrounded or closed).
// =============================================================================

export interface PushNotificationJobData {
    recipientId: string;
    title: string;
    body: string;
    conversationId: string;
    messageId: string;
    senderName: string;
}

export const pushNotificationQueue = new Queue<PushNotificationJobData>(
    'push-notification',
    {
        connection,
        defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'fixed', delay: 5000 },
            removeOnComplete: { count: 50 },
            removeOnFail: { count: 200 },
        },
    },
);

// =============================================================================
// Queue: cleanup
// Periodic maintenance jobs — expired tokens, old soft-deleted messages, etc.
// =============================================================================

export const cleanupQueue = new Queue('cleanup', {
    connection,
    defaultJobOptions: {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: { count: 10 },
    },
});

/**
 * Schedules recurring cleanup jobs.
 * Called once at server startup.
 */
export async function scheduleCleanupJobs(): Promise<void> {
    // Remove expired/revoked refresh tokens — runs every 24 hours
    await cleanupQueue.add(
        'expire-refresh-tokens',
        {},
        {
            repeat: { pattern: '0 3 * * *' }, // 3 AM every day
            jobId: 'expire-refresh-tokens',  // stable ID prevents duplicate schedules
        },
    );

    logger.info('Cleanup jobs scheduled');
}
