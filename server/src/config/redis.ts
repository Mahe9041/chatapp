// =============================================================================
// redis.ts
// ioredis singleton used across the app:
//   - Presence (online/offline state)
//   - Session allowlist for refresh token rotation
//   - BullMQ job queue
//   - Socket.io Redis adapter
// =============================================================================

import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

/**
 * Creates a configured ioredis client.
 * `lazyConnect: true` means we call `.connect()` explicitly so startup
 * errors are surfaced clearly rather than silently retrying.
 */
function createRedisClient(name: string): Redis {
    const client = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: null,   // Required by BullMQ
        lazyConnect: true,
        connectionName: name,   // Shows in Redis CLIENT LIST for debugging
    });

    client.on('connect', () => logger.info(`Redis [${name}] connected`));
    client.on('error', (err) => logger.error({ err }, `Redis [${name}] error`));
    client.on('reconnecting', () => logger.warn(`Redis [${name}] reconnecting`));

    return client;
}

// Three separate clients because BullMQ requires dedicated connections
// and the Socket.io adapter has its own pub/sub channel.

/** General-purpose client: presence, sessions, cache */
export const redis = createRedisClient('main');

/** Dedicated client for BullMQ worker (blocks the connection) */
export const redisWorker = createRedisClient('bullmq-worker');

/** Dedicated pub client for Socket.io Redis adapter */
export const redisPub = createRedisClient('socketio-pub');

/** Dedicated sub client for Socket.io Redis adapter */
export const redisSub = createRedisClient('socketio-sub');

/**
 * Opens all Redis connections.
 * Awaited in `server.ts` before `app.listen()`.
 */
/**
 * Connects a single Redis client only if it isn't already connected.
 * Guards against tsx watch hot-reload calling connect() on a live client.
 */
function connectIfNeeded(client: Redis): Promise<void> {
    // ioredis statuses: "wait" | "reconnecting" | "connecting" | "connect" | "ready" | "close" | "end"
    if (client.status === 'ready' || client.status === 'connect' || client.status === 'connecting') {
        return Promise.resolve();
    }
    return client.connect();
}

export async function connectRedis(): Promise<void> {
    await Promise.all([
        connectIfNeeded(redis),
        connectIfNeeded(redisWorker),
        connectIfNeeded(redisPub),
        connectIfNeeded(redisSub),
    ]);
}

/**
 * Closes all Redis connections gracefully.
 */
export async function disconnectRedis(): Promise<void> {
    await Promise.all([
        redis.quit(),
        redisWorker.quit(),
        redisPub.quit(),
        redisSub.quit(),
    ]);
    logger.info('All Redis connections closed');
}