// =============================================================================
// users.service.ts
// =============================================================================

import { prisma } from '../../config/database';

/**
 * Searches users by displayName or email (case-insensitive).
 * Excludes the requesting user from results.
 * Used by the "New Conversation" modal.
 */
export const searchUsers = async (query: string, excludeUserId: string) => {
    return prisma.user.findMany({
        where: {
            AND: [
                { id: { not: excludeUserId } },
                {
                    OR: [
                        { displayName: { contains: query, mode: 'insensitive' } },
                        { email: { contains: query, mode: 'insensitive' } },
                    ],
                },
            ],
        },
        select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
            isOnline: true,
            lastSeen: true,
        },
        take: 20,
    });
};

/**
 * Returns a user's public profile by ID.
 */
export const getUserById = async (userId: string) => {
    return prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
            isOnline: true,
            lastSeen: true,
        },
    });
};

/**
 * Updates the current user's profile.
 */
export const updateProfile = async (
    userId: string,
    data: { displayName?: string; avatarUrl?: string },
) => {
    return prisma.user.update({
        where: { id: userId },
        data,
        select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
            isOnline: true,
            lastSeen: true,
        },
    });
};

