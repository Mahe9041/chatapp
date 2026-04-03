// =============================================================================
// messages.repository.ts
// All MongoDB queries for messages.
// =============================================================================

import { MessageModel, getNextSeq } from '../../db/mongo/models/message.model';
import type { SendMessageInput } from './messages.schema';

/**
 * Persists a new message to MongoDB.
 * Uses atomic seq increment to guarantee message ordering.
 * Throws Mongoose duplicate key error (code 11000) if clientMsgId is reused —
 * the service layer catches this to handle retries gracefully.
 */
export const createMessage = async (
    senderId: string,
    input: SendMessageInput,
) => {
    const seq = await getNextSeq(input.conversationId);

    const message = await MessageModel.create({
        conversationId: input.conversationId,
        senderId,
        seq,
        clientMsgId: input.clientMsgId,
        type: input.type,
        content: input.content,
        replyTo: input.replyTo ?? null,
        deliveryStatus: { [senderId]: 'read' }, // sender has implicitly read their own message
    });

    return message;
};

/**
 * Paginates messages in a conversation using cursor-based pagination.
 * `before` is a seq number — returns messages older than that seq.
 * Returns messages in ascending order (oldest first) for chat rendering.
 */
export const getMessages = async (
    conversationId: string,
    before?: number,
    limit = 30,
) => {
    const query: Record<string, unknown> = {
        conversationId,
        deletedAt: null,
        ...(before ? { seq: { $lt: before } } : {}),
    };

    return MessageModel
        .find(query)
        .sort({ seq: -1 })   // fetch newest first (limited)
        .limit(limit)
        .lean()
        .then((msgs) => msgs.reverse()); // reverse to ascending for the client
};

/** Finds a single message by its MongoDB _id */
export const findMessageById = async (messageId: string) => {
    return MessageModel.findById(messageId);
};

/**
 * Soft-deletes a message by setting deletedAt.
 * Returns null if the message doesn't belong to the sender.
 */
export const softDeleteMessage = async (
    messageId: string,
    senderId: string,
) => {
    return MessageModel.findOneAndUpdate(
        { _id: messageId, senderId },
        { deletedAt: new Date() },
        { new: true },
    );
};

/** Updates message text and sets editedAt timestamp */
export const editMessage = async (
    messageId: string,
    senderId: string,
    text: string,
) => {
    return MessageModel.findOneAndUpdate(
        { _id: messageId, senderId, deletedAt: null },
        { 'content.text': text, editedAt: new Date() },
        { new: true },
    );
};

/**
 * Adds or removes a reaction emoji from a message.
 * Toggle behaviour: if the user already reacted with this emoji, remove it.
 */
export const toggleReaction = async (
    messageId: string,
    userId: string,
    emoji: string,
) => {
    const message = await MessageModel.findById(messageId);
    if (!message) return null;

    const existing = message.reactions.find((r) => r.emoji === emoji);

    if (existing) {
        const alreadyReacted = existing.userIds.includes(userId);
        if (alreadyReacted) {
            // Remove user from this emoji's list
            existing.userIds = existing.userIds.filter((id) => id !== userId);
            if (existing.userIds.length === 0) {
                // No users left for this emoji — remove the reaction entirely
                message.reactions = message.reactions.filter((r) => r.emoji !== emoji);
            }
        } else {
            existing.userIds.push(userId);
        }
    } else {
        message.reactions.push({ emoji, userIds: [userId] });
    }

    return message.save();
};

/**
 * Marks all messages in a conversation as 'read' for a specific user.
 * Called when the user opens a conversation or scrolls to the bottom.
 */
export const markMessagesRead = async (
    conversationId: string,
    userId: string,
    upToSeq: number,
) => {
    return MessageModel.updateMany(
        {
            conversationId,
            seq: { $lte: upToSeq },
            deletedAt: null,
            [`deliveryStatus.${userId}`]: { $ne: 'read' },
        },
        { $set: { [`deliveryStatus.${userId}`]: 'read' } },
    );
};

/**
 * Counts unread messages for a user in a conversation.
 * "Unread" = message created after user's lastReadAt AND not sent by the user.
 */
export const countUnread = async (
    conversationId: string,
    userId: string,
    afterSeq: number,
) => {
    return MessageModel.countDocuments({
        conversationId,
        seq: { $gt: afterSeq },
        senderId: { $ne: userId },
        deletedAt: null,
    });
};