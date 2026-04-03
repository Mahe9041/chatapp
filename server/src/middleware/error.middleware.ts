// =============================================================================
// error.middleware.ts
// Global error handler — the last middleware registered in app.ts.
// All errors thrown anywhere in the app land here via next(err).
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { logger } from '../utils/logger';
import { isProd } from '../config/env';

/**
 * Converts any thrown error into a consistent JSON error response.
 *
 * Error types handled:
 *  - AppError subclasses → use their statusCode + code
 *  - ZodError            → 422 with field-level details
 *  - Everything else     → 500 (and logged as critical in prod)
 */
export const errorMiddleware = (
    err: unknown,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: NextFunction, // Express requires 4-arg signature to treat as error handler
): void => {
    // ── ZodError (from manual schema.parse() calls in controllers) ─────────────
    if (err instanceof ZodError) {
        res.status(422).json({
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Request validation failed',
                fields: err.flatten().fieldErrors,
            },
        });
        return;
    }

    // ── Known operational errors (AppError subclasses) ─────────────────────────
    if (err instanceof AppError) {
        if (!err.isOperational) {
            // Non-operational = programmer mistake — log loudly
            logger.error({ err, path: req.path, method: req.method }, 'Non-operational error');
        }

        res.status(err.statusCode).json({
            error: {
                code: err.code,
                message: err.message,
            },
        });
        return;
    }

    // ── Unknown / unexpected errors ─────────────────────────────────────────────
    logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');

    res.status(500).json({
        error: {
            code: 'INTERNAL_ERROR',
            message: isProd
                ? 'An unexpected error occurred'
                : (err instanceof Error ? err.message : String(err)),
        },
    });
};