// =============================================================================
// conversations.service.ts
// =============================================================================

import {
    ConflictError,
    ForbiddenError,
    NotFoundError,
} from '../../errors/errors';
import * as ConvoRepo from './conversations.repository';
import type {
    CreateDirectInput,
    CreateGroupInput,
    UpdateGroupInput,
} from './conversations.schema';

/**
 * Creates a direct (1-to-1) conversation.
 * If one already exists between the two users, returns the existing one
 * instead of creating a duplicate.
 */
export const createDirect = async (
    requesterId: string,
    input: CreateDirectInput,
) => {
    if (requesterId === input.targetUserId) {
        throw new ConflictError('You cannot start a conversation with yourself');
    }

    // Return existing DM if one already exists
    const existing = await ConvoRepo.findDirectConversation(
        requesterId,
        input.targetUserId,
    );
    if (existing) return existing;

    return ConvoRepo.createConversationWithMembers({
        type: 'DIRECT',
        members: [
            { userId: requesterId, role: 'WRITE' },
            { userId: input.targetUserId, role: 'WRITE' },
        ],
    });
};

/**
 * Creates a group conversation.
 * Creator is automatically assigned ADMIN role.
 */
export const createGroup = async (
    creatorId: string,
    input: CreateGroupInput,
) => {
    const members = [
        { userId: creatorId, role: 'ADMIN' as const },
        ...input.memberIds
            .filter((id) => id !== creatorId) // prevent duplicate if creator included
            .map((id) => ({ userId: id, role: 'WRITE' as const })),
    ];

    return ConvoRepo.createConversationWithMembers({
        type: 'GROUP',
        name: input.name,
        members,
    });
};

/**
 * Returns all conversations for a user, with last message injected.
 */
export const getUserConversations = async (userId: string) => {
    return ConvoRepo.findUserConversations(userId);
};

/**
 * Returns a single conversation — throws if user is not a member.
 */
export const getConversation = async (
    conversationId: string,
    userId: string,
) => {
    const convo = await ConvoRepo.findConversationById(conversationId, userId);
    if (!convo) throw new NotFoundError('Conversation');
    return convo;
};

/**
 * Updates a group's name or avatar.
 * Only ADMINs can do this.
 */
export const updateGroup = async (
    conversationId: string,
    requesterId: string,
    input: UpdateGroupInput,
) => {
    const member = await ConvoRepo.findMember(conversationId, requesterId);
    if (!member || member.role !== 'ADMIN') {
        throw new ForbiddenError('Only admins can update group details');
    }
    return ConvoRepo.updateConversation(conversationId, input);
};

/**
 * Adds a new member to a group.
 * Only ADMINs can add members.
 */
export const addMember = async (
    conversationId: string,
    requesterId: string,
    targetUserId: string,
) => {
    const requester = await ConvoRepo.findMember(conversationId, requesterId);
    if (!requester || requester.role !== 'ADMIN') {
        throw new ForbiddenError('Only admins can add members');
    }
    // Will throw Prisma unique constraint error if already a member
    return ConvoRepo.addMember(conversationId, targetUserId);
};

/**
 * Removes a member from a group.
 * ADMINs can remove anyone. Regular members can only remove themselves (leave).
 */
export const removeMember = async (
    conversationId: string,
    requesterId: string,
    targetUserId: string,
) => {
    const requester = await ConvoRepo.findMember(conversationId, requesterId);
    if (!requester) throw new NotFoundError('Conversation');

    const isSelf = requesterId === targetUserId;
    const isAdmin = requester.role === 'ADMIN';

    if (!isSelf && !isAdmin) {
        throw new ForbiddenError('Only admins can remove other members');
    }

    await ConvoRepo.removeMember(conversationId, targetUserId);
};

/**
 * Changes a member's role. Only ADMINs can do this.
 */
export const changeMemberRole = async (
    conversationId: string,
    requesterId: string,
    targetUserId: string,
    role: 'ADMIN' | 'WRITE' | 'READ',
) => {
    const requester = await ConvoRepo.findMember(conversationId, requesterId);
    if (!requester || requester.role !== 'ADMIN') {
        throw new ForbiddenError('Only admins can change member roles');
    }
    return ConvoRepo.updateMemberRole(conversationId, targetUserId, role);
};