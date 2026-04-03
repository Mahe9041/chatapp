// =============================================================================
// auth.service.ts
// Business logic for register, login, token refresh, and logout.
// Calls the repository for DB access, jwt.utils for token ops.
// =============================================================================

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
    ConflictError,
    UnauthorizedError
} from '../../errors/errors';
import {
    generateTokens,
    verifyRefreshToken
} from '../../utils/jwt.utils';
import * as AuthRepo from './auth.repository';
import type {
    RegisterInput,
    LoginInput
} from './auth.schema';     // ← was auth.types, wrong
import type {
    AuthResponse,
    AuthTokens
} from './auth.types';

const SALT_ROUNDS = 12;

/**
 * Registers a new user.
 * @throws {ConflictError} if the email is already in use
 */
export const register = async (input: RegisterInput): Promise<AuthResponse> => {
    // 1. Check email uniqueness
    const existing = await AuthRepo.findUserByEmail(input.email);
    if (existing) throw new ConflictError('An account with this email already exists');

    // 2. Hash password — never store plaintext
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    // 3. Persist user
    const user = await AuthRepo.createUser({
        email: input.email.toLowerCase().trim(),
        passwordHash,
        displayName: input.displayName,
    });

    // 4. Issue tokens
    const tokens = await issueTokens(user.id);

    return buildAuthResponse(user, tokens);
};

/**
 * Logs in an existing user with email + password.
 * @throws {UnauthorizedError} for invalid credentials (intentionally vague — no email enumeration)
 */
export const login = async (input: LoginInput): Promise<AuthResponse> => {
    // 1. Look up user
    const user = await AuthRepo.findUserByEmail(input.email.toLowerCase().trim());

    // 2. Verify password — use constant-time compare to prevent timing attacks.
    //    Even if user is null we still call bcrypt.compare with a dummy hash
    //    so the response time is identical whether the email exists or not.
    const DUMMY_HASH = '$2b$12$invalidhashforenumerationprotection00000000000000000000';
    const isValid = await bcrypt.compare(
        input.password,
        user?.passwordHash ?? DUMMY_HASH,
    );

    if (!user || !isValid) {
        throw new UnauthorizedError('Invalid email or password');
    }

    // 3. Issue new tokens
    const tokens = await issueTokens(user.id);

    return buildAuthResponse(user, tokens);
};

/**
 * Rotates a refresh token — validates old token, revokes it, issues new pair.
 * This is the "refresh token rotation" pattern: each refresh token can only be used once.
 * @throws {UnauthorizedError} if token is invalid, expired, or revoked
 */
export const refresh = async (rawToken: string): Promise<AuthTokens> => {
    // 1. Verify JWT signature
    const payload = verifyRefreshToken(rawToken);
    if (!payload) throw new UnauthorizedError('Invalid or expired refresh token');

    // 2. Look up stored hash
    const tokenHash = hashToken(rawToken);
    const storedToken = await AuthRepo.findRefreshToken(tokenHash);

    if (!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
        // Possible token reuse attack — revoke all tokens for this user
        if (storedToken?.revoked) {
            await AuthRepo.revokeAllUserTokens(payload.userId);
        }
        throw new UnauthorizedError('Refresh token is invalid or has been revoked');
    }

    // 3. Revoke the used token (one-time use)
    await AuthRepo.revokeRefreshToken(tokenHash);

    // 4. Issue fresh pair
    return issueTokens(storedToken.userId);
};

/**
 * Logs out a user by revoking their current refresh token.
 * Access token expiry is handled naturally (short TTL — 15 min).
 */
export const logout = async (rawRefreshToken: string): Promise<void> => {
    const tokenHash = hashToken(rawRefreshToken);
    await AuthRepo.revokeRefreshToken(tokenHash);
};

// =============================================================================
// Private helpers
// =============================================================================

/**
 * Generates a JWT access + refresh token pair and persists the refresh token hash.
 */
async function issueTokens(userId: string): Promise<AuthTokens> {
    const { accessToken, refreshToken, refreshExpiresAt } = generateTokens(userId);

    // Store only the hash of the refresh token — never the raw value
    await AuthRepo.createRefreshToken({
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
    });

    return { accessToken, refreshToken };
}

/**
 * SHA-256 hash of a token for safe DB storage.
 * We never store raw tokens — only their hash.
 */
function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/** Strips sensitive fields and shapes the auth API response */
function buildAuthResponse(
    user: { id: string; email: string; displayName: string; avatarUrl: string | null },
    tokens: AuthTokens,
): AuthResponse {
    return {
        user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
        },
        tokens,
    };
}
