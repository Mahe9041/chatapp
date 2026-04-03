// =============================================================================
// validate.middleware.ts
// Generic Zod validation middleware factory.
// Validates req.body against any Zod schema and returns 422 on failure.
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Wraps a Zod schema into Express middleware.
 * Parses req.body and attaches the validated + typed result back to req.body.
 *
 * @example
 * router.post('/register', validate(RegisterSchema), registerHandler)
 */
export const validate = <T>(schema: ZodSchema<T>) =>
    (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            // Format Zod errors into a flat, human-readable shape
            const errors = result.error.flatten().fieldErrors;
            res.status(422).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Request validation failed',
                    fields: errors,
                },
            });
            return;
        }

        req.body = result.data; // Replace raw body with validated + typed data
        next();
    };