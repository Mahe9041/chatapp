/**
 * app.ts — Express application factory
 * --------------------------------------
 * Creates and configures the Express app.
 * Does NOT call app.listen() — that lives in server.ts.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { apiRateLimit } from './middleware/rateLimit.middleware';
import { errorMiddleware } from './middleware/error.middleware';

// ── Route modules ─────────────────────────────────────────────────────────────
import authRoutes from './modules/auth/auth.routes';
import conversationRoutes from './modules/conversations/conversations.routes';
import messageRoutes from './modules/messages/messages.routes';
import mediaRoutes from './modules/media/media.routes';
import demoRoutes from './modules/demo/demo.routes';
import userRoutes from './modules/users/users.routes';

export function createApp() {
    const app = express();

    // ── Security headers ───────────────────────────────────────────────────────
    app.use(helmet());

    // ── CORS ───────────────────────────────────────────────────────────────────
    const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
    app.use(cors({
        origin: (origin, cb) => {
            if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
            cb(new Error(`CORS blocked: ${origin}`));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // ── Body parsing ───────────────────────────────────────────────────────────
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // ── Global rate limiting ───────────────────────────────────────────────────
    app.use('/api', apiRateLimit);

    // ── Health check ───────────────────────────────────────────────────────────
    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', uptime: process.uptime() });
    });

    // ── API routes ─────────────────────────────────────────────────────────────
    app.use('/api/auth', authRoutes);
    app.use('/api/conversations', conversationRoutes);
    app.use('/api/messages', messageRoutes);
    app.use('/api/media', mediaRoutes);
    app.use('/api/demo', demoRoutes);
    app.use('/api/users', userRoutes);

    // Nested message route: GET /api/conversations/:conversationId/messages
    app.use(
        '/api/conversations/:conversationId/messages',
        (req, _res, next) => {
            req.params.conversationId = req.params.conversationId;
            next();
        },
        messageRoutes,
    );

    // ── Global error handler — must always be last ─────────────────────────────
    app.use(errorMiddleware);

    return app;
}