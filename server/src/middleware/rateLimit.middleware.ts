// =============================================================================
// rateLimit.middleware.ts
// Preconfigured rate limiters for different endpoint sensitivity levels.
// =============================================================================

import rateLimit from 'express-rate-limit';

/**
 * Strict limiter for auth endpoints — prevents brute-force attacks.
 * 10 attempts per IP per 15-minute window.
 */
export const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: {
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many attempts. Please try again in 15 minutes.',
        },
    },
    standardHeaders: true,   // Return rate limit info in RateLimit-* headers
    legacyHeaders: false,
});

/**
 * General API limiter — applied globally to all routes.
 * 100 requests per IP per minute.
 */
export const apiRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: {
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please slow down.',
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
});
