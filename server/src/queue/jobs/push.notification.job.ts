// =============================================================================
// queue/jobs/push.notification.job.ts
// Sends FCM push notifications to offline users.
// FCM is optional — gracefully skips if FCM_SERVER_KEY is not configured.
// =============================================================================

import { Worker, Job } from 'bullmq';
import { redisWorker } from '../../config/redis';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import type { PushNotificationJobData } from '../queue.client';

/**
 * Sends a push notification via FCM HTTP v1 API.
 * In production, replace this with the Firebase Admin SDK.
 */
async function sendFcmNotification(data: {
    fcmToken: string;
    title: string;
    body: string;
    payload: Record<string, string>;
}): Promise<void> {
    if (!env.FCM_SERVER_KEY) {
        logger.debug('FCM not configured — skipping push notification');
        return;
    }

    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `key=${env.FCM_SERVER_KEY}`,
        },
        body: JSON.stringify({
            to: data.fcmToken,
            notification: {
                title: data.title,
                body: data.body,
            },
            data: data.payload,
        }),
    });

    if (!response.ok) {
        throw new Error(`FCM error: ${response.status} ${await response.text()}`);
    }
}

async function processPushNotification(
    job: Job<PushNotificationJobData>,
): Promise<void> {
    const { recipientId, title, body, conversationId, messageId } = job.data;

    // Look up the recipient's FCM token (stored on user record — added in Phase 5)
    // For now we just log — implement token storage when building the mobile client
    const user = await prisma.user.findUnique({
        where: { id: recipientId },
        select: { id: true, displayName: true },
    });

    if (!user) return;

    // TODO: fetch fcmToken from a user_devices table (Phase 5)
    // For now, log the notification that would be sent
    logger.info(
        { recipientId, title, body, conversationId },
        'Push notification would be sent here (FCM token not yet stored)',
    );
}

/** Starts the push notification worker process */
export function startPushNotificationWorker(): Worker {
    const worker = new Worker<PushNotificationJobData>(
        'push-notification',
        processPushNotification,
        {
            connection: redisWorker,
            concurrency: 20,
        },
    );

    worker.on('failed', (job, err) => {
        logger.error({ jobId: job?.id, err }, 'Push notification job failed');
    });

    return worker;
}