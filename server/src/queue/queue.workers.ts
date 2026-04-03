// =============================================================================
// queue/queue.workers.ts
// Starts all workers. Called once from server.ts.
// =============================================================================

import { startMessageDeliveryWorker } from './jobs/message.delivery.job';
import { startPushNotificationWorker } from './jobs/push.notification.job';
import { startCleanupWorker } from './jobs/cleanup.job';
import { scheduleCleanupJobs } from './queue.client';
import { logger } from '../utils/logger';

export async function startAllWorkers(): Promise<void> {
    startMessageDeliveryWorker();
    startPushNotificationWorker();
    startCleanupWorker();
    await scheduleCleanupJobs();
    logger.info('All BullMQ workers started');
}