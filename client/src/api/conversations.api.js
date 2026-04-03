// =============================================================================
// api/conversations.api.ts
// =============================================================================
import { apiClient } from './client';
/** Returns all conversations the current user is a member of */
export const getConversations = async () => {
    const { data } = await apiClient.get('/conversations');
    return data.data;
};
/** Returns a single conversation by ID */
export const getConversation = async (id) => {
    const { data } = await apiClient.get(`/conversations/${id}`);
    return data.data;
};
/** Creates or returns an existing DM with the target user */
export const createDirect = async (targetUserId) => {
    const { data } = await apiClient.post('/conversations/direct', {
        targetUserId,
    });
    return data.data;
};
/** Creates a new group conversation */
export const createGroup = async (name, memberIds) => {
    const { data } = await apiClient.post('/conversations/group', {
        name,
        memberIds,
    });
    return data.data;
};
/** Adds a member to a group conversation */
export const addMember = async (conversationId, userId) => {
    await apiClient.post(`/conversations/${conversationId}/members`, { userId });
};
/** Removes a member (or leaves a group if userId === currentUser.id) */
export const removeMember = async (conversationId, userId) => {
    await apiClient.delete(`/conversations/${conversationId}/members/${userId}`);
};
/** Changes a group member's role */
export const changeMemberRole = async (conversationId, userId, role) => {
    await apiClient.patch(`/conversations/${conversationId}/members/${userId}/role`, { role });
};
