// =============================================================================
// jwt.utils.ts
// JWT signing and verification helpers.
// Never import jsonwebtoken anywhere else — all JWT logic lives here.
// =============================================================================

import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from './logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AccessTokenPayload {
    userId: string;
    type: 'access';
}

export interface RefreshTokenPayload {
    userId: string;
    type: 'refresh';
}

export interface GeneratedTokens {
    accessToken: string;
    refreshToken: string;
    refreshExpiresAt: Date;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parses a duration string like "30d" or "15m" into milliseconds.
 * Used to calculate the absolute expiry date for DB storage.
 */
function parseDurationMs(duration: string): number {
    const unit = duration.slice(-1);
    const value = parseInt(duration.slice(0, -1), 10);
    const map: Record<string, number> = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
    };
    return value * (map[unit] ?? 1000);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Signs a new access + refresh token pair for the given user.
 * Refresh token expiry date is returned so it can be stored in the DB.
 */
export const generateTokens = (userId: string): GeneratedTokens => {
    const accessToken = jwt.sign(
        { userId, type: 'access' } satisfies AccessTokenPayload,
        env.JWT_ACCESS_SECRET,
        { expiresIn: env.JWT_ACCESS_EXPIRES_IN } as jwt.SignOptions,
    );

    const refreshToken = jwt.sign(
        { userId, type: 'refresh' } satisfies RefreshTokenPayload,
        env.JWT_REFRESH_SECRET,
        { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions,
    );

    const refreshExpiresAt = new Date(
        Date.now() + parseDurationMs(env.JWT_REFRESH_EXPIRES_IN),
    );

    return { accessToken, refreshToken, refreshExpiresAt };
};

/**
 * Verifies an access token and returns its payload.
 * Returns null instead of throwing — callers check for null.
 */
export const verifyAccessToken = (token: string): AccessTokenPayload | null => {
    try {
        const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
        if (payload.type !== 'access') return null;
        return payload;
    } catch (err) {
        logger.debug({ err }, 'Access token verification failed');
        return null;
    }
};

/**
 * Verifies a refresh token and returns its payload.
 * Returns null instead of throwing — callers check for null.
 */
export const verifyRefreshToken = (token: string): RefreshTokenPayload | null => {
    try {
        const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
        if (payload.type !== 'refresh') return null;
        return payload;
    } catch (err) {
        logger.debug({ err }, 'Refresh token verification failed');
        return null;
    }
};
