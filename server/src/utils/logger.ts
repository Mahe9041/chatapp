// =============================================================================
// logger.ts
// Structured JSON logger using Pino.
// In development: pretty-prints with colours.
// In production:  outputs machine-readable JSON (ingested by Betterstack).
//
// Usage:
//   import { logger } from '../utils/logger';
//   logger.info({ userId }, 'User logged in');
//   logger.error({ err }, 'Unexpected failure');
// =============================================================================

import pino from 'pino';
import { env, isDev } from '../config/env';

export const logger = pino({
    level: env.LOG_LEVEL,

    // Pretty print in development, raw JSON in production
    transport: isDev
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname',
                messageFormat: '{msg}',
            },
        }
        : undefined,

    // Always include timestamp in production JSON
    timestamp: pino.stdTimeFunctions.isoTime,

    // Redact sensitive fields from logs automatically
    redact: {
        paths: ['password', 'passwordHash', 'token', 'tokenHash', 'authorization'],
        censor: '[REDACTED]',
    },
});

