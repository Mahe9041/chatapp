// =============================================================================
// auth.middleware.ts
// Verifies the JWT access token on every protected route.
// Attaches the decoded user to req.user for downstream handlers.
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.utils';
import * as AuthRepo from '../modules/auth/auth.repository';
import { UnauthorizedError } from '../errors/errors';

/**
 * Protects a route by requiring a valid Bearer token.
 * Usage: router.get('/me', authMiddleware, handler)
 */
export const authMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        // 1. Extract token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new UnauthorizedError('No token provided');
        }

        const token = authHeader.slice(7); // strip "Bearer "
        const payload = verifyAccessToken(token);

        if (!payload) throw new UnauthorizedError('Invalid or expired token');

        // 2. Verify user still exists (handles deleted accounts mid-session)
        const user = await AuthRepo.findUserById(payload.userId);
        if (!user) throw new UnauthorizedError('User no longer exists');

        // 3. Attach to request — available to all downstream handlers
        req.user = {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
        };

        next();
    } catch (err) {
        next(err);
    }
};









