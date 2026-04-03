// =============================================================================
// conversations.repository.ts
// All Prisma queries for conversations — no business logic here.
// =============================================================================

import { prisma } from '../../config/database';
import type { MemberRole } from '@prisma/client';

/**
 * Finds an existing direct conversation between exactly two users.
 * Used to prevent duplicate DM conversations being created.
 */
export const findDirectConversation = async (
    userIdA: string,
    userIdB: string,
) => {
    return prisma.conversation.findFirst({
        where: {
            type: 'DIRECT',
            AND: [
                { members: { some: { userId: userIdA } } },
                { members: { some: { userId: userIdB } } },
            ],
        },
        include: { members: true },
    });
};

/**
 * Creates a new conversation with its initial members in a single transaction.
 * Transactions ensure we never have a conversation without members.
 */
export const createConversationWithMembers = async (data: {
    type: 'DIRECT' | 'GROUP';
    name?: string;
    avatarUrl?: string;
    members: Array<{ userId: string; role: MemberRole }>;
}) => {
    return prisma.$transaction(async (tx) => {
        const conversation = await tx.conversation.create({
            data: {
                type: data.type,
                name: data.name,
                avatarUrl: data.avatarUrl,
            },
        });

        await tx.conversationMember.createMany({
            data: data.members.map((m) => ({
                conversationId: conversation.id,
                userId: m.userId,
                role: m.role,
            })),
        });

        return tx.conversation.findUniqueOrThrow({
            where: { id: conversation.id },
            include: { members: true },
        });
    });
};

/**
 * Returns all conversations a user is a member of,
 * ordered by most recently updated (for the sidebar list).
 */
export const findUserConversations = async (userId: string) => {
    return prisma.conversation.findMany({
        where: { members: { some: { userId } } },
        include: {
            members: {
                include: {
                    user: {
                        select: {
                            id: true, displayName: true,
                            avatarUrl: true, isOnline: true, lastSeen: true,
                        },
                    }
                },
            },
        },
        orderBy: { updatedAt: 'desc' },
    });
};

/**
 * Returns a single conversation by ID — only if the requesting user is a member.
 */
export const findConversationById = async (
    conversationId: string,
    userId: string,
) => {
    return prisma.conversation.findFirst({
        where: {
            id: conversationId,
            members: { some: { userId } },
        },
        include: {
            members: {
                include: {
                    user: {
                        select: {
                            id: true, displayName: true,
                            avatarUrl: true, isOnline: true, lastSeen: true,
                        },
                    }
                },
            },
        },
    });
};

/** Returns a single member record (for role checks) */
export const findMember = async (conversationId: string, userId: string) => {
    return prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId, userId } },
    });
};

/** Adds a new member to an existing group conversation */
export const addMember = async (
    conversationId: string,
    userId: string,
    role: MemberRole = 'WRITE',
) => {
    return prisma.conversationMember.create({
        data: { conversationId, userId, role },
    });
};

/** Removes a member from a conversation */
export const removeMember = async (
    conversationId: string,
    userId: string,
) => {
    return prisma.conversationMember.delete({
        where: { conversationId_userId: { conversationId, userId } },
    });
};

/** Updates a member's role */
export const updateMemberRole = async (
    conversationId: string,
    userId: string,
    role: MemberRole,
) => {
    return prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { role },
    });
};

/** Updates the lastReadAt timestamp for unread count calculation */
export const markAsRead = async (
    conversationId: string,
    userId: string,
) => {
    return prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadAt: new Date() },
    });
};

/** Updates a group's name or avatar */
export const updateConversation = async (
    conversationId: string,
    data: { name?: string; avatarUrl?: string },
) => {
    return prisma.conversation.update({
        where: { id: conversationId },
        data,
        include: { members: true },
    });
};

/** Touches updatedAt — called after every new message to keep list sorted */
export const touchConversation = async (conversationId: string) => {
    return prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
    });
};