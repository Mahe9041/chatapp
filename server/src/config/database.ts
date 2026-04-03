// =============================================================================
// database.ts
// Initialises Prisma (PostgreSQL) and Mongoose (MongoDB) connections.
// Call `connectDatabases()` once at server startup, before any routes register.
// =============================================================================

import { PrismaClient } from '@prisma/client';
import mongoose from 'mongoose';
import { env, isDev } from './env';
import { logger } from '../utils/logger';

// ── Prisma singleton ─────────────────────────────────────────────────────────
// Prevents multiple PrismaClient instances in development (hot-reload safe).
declare global {
    // eslint-disable-next-line no-var
    var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma ?? new PrismaClient({
    log: isDev
        ? [{ emit: 'event', level: 'query' }]  // Log SQL in dev
        : [],
});

if (isDev) {
    global.__prisma = prisma;

    // Log every SQL query in development to help debug N+1s and slow queries
    (prisma as unknown as { $on: (event: string, cb: (e: { query: string; duration: number }) => void) => void })
        .$on('query', (e) => {
            logger.debug({ query: e.query, duration: `${e.duration}ms` }, 'Prisma query');
        });
}

// ── MongoDB connection ────────────────────────────────────────────────────────

/**
 * Connects to MongoDB via Mongoose.
 * Messages, media metadata, and reactions are stored here.
 */
async function connectMongo(): Promise<void> {
    mongoose.set('strictQuery', true);

    // Surface Mongoose errors to our logger instead of raw console
    mongoose.connection.on('error', (err) => {
        logger.error({ err }, 'MongoDB connection error');
    });

    mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
    });

    await mongoose.connect(env.MONGODB_URI, {
        // Keep alive to prevent connection drops on Mongo Atlas free tier
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
    });

    logger.info('MongoDB connected');
}

/**
 * Connects to PostgreSQL via Prisma.
 * Users, conversations, group members, and auth tokens are stored here.
 */
async function connectPostgres(): Promise<void> {
    // `$connect` is optional — Prisma connects lazily, but calling it
    // explicitly surfaces config errors at startup rather than at first query.
    await prisma.$connect();
    logger.info('PostgreSQL connected');
}

/**
 * Bootstraps all database connections.
 * Awaited in `server.ts` before `app.listen()`.
 */
export async function connectDatabases(): Promise<void> {
    await Promise.all([connectPostgres(), connectMongo()]);
}

/**
 * Gracefully closes all database connections.
 * Called on SIGTERM / SIGINT for clean shutdown.
 */
export async function disconnectDatabases(): Promise<void> {
    await Promise.all([
        prisma.$disconnect(),
        mongoose.disconnect(),
    ]);
    logger.info('All database connections closed');
}
