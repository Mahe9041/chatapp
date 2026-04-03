// =============================================================================
// api/conversations.api.ts
// =============================================================================

import { apiClient } from './client';
import type { Conversation } from '@chatapp/shared';

/** Returns all conversations the current user is a member of */
export const getConversations = async (): Promise<Conversation[]> => {
    const { data } = await apiClient.get<{ data: Conversation[] }>('/conversations');
    return data.data;
};

/** Returns a single conversation by ID */
export const getConversation = async (id: string): Promise<Conversation> => {
    const { data } = await apiClient.get<{ data: Conversation }>(`/conversations/${id}`);
    return data.data;
};

/** Creates or returns an existing DM with the target user */
export const createDirect = async (targetUserId: string): Promise<Conversation> => {
    const { data } = await apiClient.post<{ data: Conversation }>('/conversations/direct', {
        targetUserId,
    });
    return data.data;
};

/** Creates a new group conversation */
export const createGroup = async (
    name: string,
    memberIds: string[],
): Promise<Conversation> => {
    const { data } = await apiClient.post<{ data: Conversation }>('/conversations/group', {
        name,
        memberIds,
    });
    return data.data;
};

/** Adds a member to a group conversation */
export const addMember = async (
    conversationId: string,
    userId: string,
): Promise<void> => {
    await apiClient.post(`/conversations/${conversationId}/members`, { userId });
};

/** Removes a member (or leaves a group if userId === currentUser.id) */
export const removeMember = async (
    conversationId: string,
    userId: string,
): Promise<void> => {
    await apiClient.delete(`/conversations/${conversationId}/members/${userId}`);
};

/** Changes a group member's role */
export const changeMemberRole = async (
    conversationId: string,
    userId: string,
    role: 'ADMIN' | 'WRITE' | 'READ',
): Promise<void> => {
    await apiClient.patch(
        `/conversations/${conversationId}/members/${userId}/role`,
        { role },
    );
};