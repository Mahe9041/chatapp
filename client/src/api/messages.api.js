// =============================================================================
// api/messages.api.ts
// =============================================================================
import { apiClient } from './client';
/** Returns paginated messages for a conversation */
export const getMessages = async (conversationId, before, limit = 30) => {
    const { data } = await apiClient.get(`/conversations/${conversationId}/messages`, { params: { before, limit } });
    return data.data;
};
/** Soft-deletes a message */
export const deleteMessage = async (messageId) => {
    await apiClient.delete(`/messages/${messageId}`);
};
/** Edits a message's text */
export const editMessage = async (messageId, text) => {
    const { data } = await apiClient.patch(`/messages/${messageId}`, { text });
    return data.data;
};
/** Toggles an emoji reaction on a message */
export const reactToMessage = async (messageId, emoji) => {
    const { data } = await apiClient.post(`/messages/${messageId}/react`, { emoji });
    return data.data;
};
