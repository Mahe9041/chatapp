// =============================================================================
// api/messages.api.ts
// =============================================================================

import { apiClient } from './client';
import type { Message } from '@chatapp/shared';

/** Returns paginated messages for a conversation */
export const getMessages = async (
    conversationId: string,
    before?: number,
    limit = 30,
): Promise<Message[]> => {
    const { data } = await apiClient.get<{ data: Message[] }>(
        `/conversations/${conversationId}/messages`,
        { params: { before, limit } },
    );
    return data.data;
};

/** Soft-deletes a message */
export const deleteMessage = async (messageId: string): Promise<void> => {
    await apiClient.delete(`/messages/${messageId}`);
};

/** Edits a message's text */
export const editMessage = async (
    messageId: string,
    text: string,
): Promise<Message> => {
    const { data } = await apiClient.patch<{ data: Message }>(`/messages/${messageId}`, { text });
    return data.data;
};

/** Toggles an emoji reaction on a message */
export const reactToMessage = async (
    messageId: string,
    emoji: string,
): Promise<Message> => {
    const { data } = await apiClient.post<{ data: Message }>(
        `/messages/${messageId}/react`,
        { emoji },
    );
    return data.data;
};
