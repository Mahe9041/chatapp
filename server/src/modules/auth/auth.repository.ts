// =============================================================================
// auth.repository.ts
// All Prisma queries for the auth module.
// No business logic here — only data access.
// =============================================================================

import { prisma } from '../../config/database';
import type { User } from '@prisma/client';

/**
 * Finds a user by their email address.
 * Returns null if not found (not an error — caller decides).
 */
export const findUserByEmail = async (email: string): Promise<User | null> => {
    return prisma.user.findUnique({ where: { email } });
};

/**
 * Finds a user by their primary key ID.
 */
export const findUserById = async (id: string): Promise<User | null> => {
    return prisma.user.findUnique({ where: { id } });
};

/**
 * Creates a new user record.
 * Password must already be hashed before calling this.
 */
export const createUser = async (data: {
    email: string;
    passwordHash: string;
    displayName: string;
}): Promise<User> => {
    return prisma.user.create({ data });
};

/**
 * Stores a hashed refresh token for a given user session.
 */
export const createRefreshToken = async (data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
}) => {
    return prisma.refreshToken.create({ data });
};

/**
 * Looks up a refresh token record by its hash.
 * Used during token rotation — must be valid (not revoked, not expired).
 */
export const findRefreshToken = async (tokenHash: string) => {
    return prisma.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true },
    });
};

/**
 * Revokes a single refresh token by marking it as invalid.
 * Called on logout or token rotation.
 */
export const revokeRefreshToken = async (tokenHash: string): Promise<void> => {
    await prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { revoked: true },
    });
};

/**
 * Revokes ALL refresh tokens belonging to a user.
 * Called on password change or "log out everywhere".
 */
export const revokeAllUserTokens = async (userId: string): Promise<void> => {
    await prisma.refreshToken.updateMany({
        where: { userId },
        data: { revoked: true },
    });
};

/**
 * Removes expired or revoked tokens older than the given date.
 * Called by a scheduled cleanup job.
 */
export const deleteExpiredTokens = async (before: Date): Promise<void> => {
    await prisma.refreshToken.deleteMany({
        where: {
            OR: [
                { expiresAt: { lt: before } },
                { revoked: true },
            ],
        },
    });
};