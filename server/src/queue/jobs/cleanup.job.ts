// =============================================================================
// queue/jobs/cleanup.job.ts
// Runs maintenance tasks on a schedule.
// =============================================================================

import { Worker } from 'bullmq';
import { redisWorker } from '../../config/redis';
import { prisma } from '../../config/database';
import { MessageModel } from '../../db/mongo/models/message.model';
import { logger } from '../../utils/logger';

async function processCleanup(): Promise<void> {
    const now = new Date();

    // 1. Delete expired / revoked refresh tokens older than 7 days
    const tokenResult = await prisma.refreshToken.deleteMany({
        where: {
            OR: [
                { expiresAt: { lt: now } },
                { revoked: true, createdAt: { lt: new Date(Date.now() - 7 * 86400_000) } },
            ],
        },
    });
    logger.info({ deleted: tokenResult.count }, 'Expired refresh tokens cleaned up');

    // 2. Hard-delete soft-deleted messages older than 30 days
    const msgResult = await MessageModel.deleteMany({
        deletedAt: { $lt: new Date(Date.now() - 30 * 86400_000) },
    });
    logger.info({ deleted: msgResult.deletedCount }, 'Old deleted messages purged');
}

export function startCleanupWorker(): Worker {
    const worker = new Worker('cleanup', processCleanup, {
        connection: redisWorker,
    });

    worker.on('completed', () => logger.info('Cleanup job completed'));
    worker.on('failed', (job, err) => logger.error({ err }, 'Cleanup job failed'));

    return worker;
}