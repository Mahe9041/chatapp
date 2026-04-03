/**
 * server.ts — Application entry point
 * -------------------------------------
 * Boot order:
 *   1. Redis
 *   2. Databases (Postgres + MongoDB)
 *   3. Express app
 *   4. HTTP server
 *   5. Socket.io
 *   6. BullMQ workers
 *   7. Listen
 */

import http from 'http';
import { createApp } from './app';
import {
    connectDatabases,
    disconnectDatabases
} from './config/database';
import {
    connectRedis,
    disconnectRedis
} from './config/redis';
import {
    initSocketServer,
    setIo
} from './socket/socket.server';
import { startAllWorkers } from './queue/queue.workers';
import { setIoGetter } from './queue/jobs/message.delivery.job';
import { setDemoIoGetter } from './modules/demo/demo.tracer';
import { env } from './config/env';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
    logger.info('Starting ChatApp server...');

    // ── 1. Data stores ─────────────────────────────────────────────────────────
    await connectRedis();
    await connectDatabases();

    // ── 2. Express app ─────────────────────────────────────────────────────────
    const app = createApp();

    // ── 3. HTTP server ─────────────────────────────────────────────────────────
    const httpServer = http.createServer(app);

    // ── 4. Socket.io ───────────────────────────────────────────────────────────
    const socketIo = initSocketServer(httpServer);
    setIo(socketIo);

    // Inject io into the delivery job worker (breaks circular dependency)
    setIoGetter(() => socketIo);

    // Inject io into the demo tracer so it can emit trace events
    setDemoIoGetter(() => socketIo);

    // ── 5. BullMQ workers ──────────────────────────────────────────────────────
    await startAllWorkers();

    // ── 6. Listen ──────────────────────────────────────────────────────────────
    httpServer.listen(env.PORT, () => {
        logger.info(`HTTP server on port ${env.PORT} [${env.NODE_ENV}]`);
        logger.info(`WebSocket ready on ws://localhost:${env.PORT}`);
    });

    // ── Graceful shutdown ──────────────────────────────────────────────────────
    const shutdown = async (signal: string): Promise<void> => {
        logger.info(`${signal} received — shutting down`);

        httpServer.close(async () => {
            await disconnectDatabases();
            await disconnectRedis();
            logger.info('Shutdown complete');
            process.exit(0);
        });

        setTimeout(() => {
            logger.error('Shutdown timed out — forcing exit');
            process.exit(1);
        }, 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
        logger.error({ reason }, 'Unhandled promise rejection');
    });
}

bootstrap().catch((err) => {
    logger.error({ err }, 'Fatal startup error');
    process.exit(1);
});