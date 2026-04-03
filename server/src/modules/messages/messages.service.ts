/**
 * messages.service.ts — updated for Phase 4
 * ------------------------------------------
 * After persisting a message, we now:
 *   1. Find which conversation members are currently offline
 *   2. Enqueue a delivery job for each offline recipient
 *
 * Online members receive the message immediately via WebSocket broadcast
 * in the socket handler. The queue handles the rest.
 */

import * as MessageRepo from './messages.repository';
import * as ConvoRepo from '../conversations/conversations.repository';
import { messageDeliveryQueue } from '../../queue/queue.client';
import {
    ForbiddenError,
    NotFoundError,
    ConflictError
} from '../../errors/errors';
import { touchConversation } from '../conversations/conversations.repository';
import { prisma } from '../../config/database';
import type {
    SendMessageInput,
    GetMessagesInput
} from './messages.schema';

// =============================================================================
// sendMessage — core function, now queue-aware
// =============================================================================

/**
 * Sends a message:
 *  1. Verifies the sender has write permission
 *  2. Persists to MongoDB with an atomic sequence number
 *  3. Bumps conversation updatedAt for sidebar ordering
 *  4. Enqueues delivery jobs for offline members
 *
 * @throws {NotFoundError}  if sender is not a conversation member
 * @throws {ForbiddenError} if sender only has READ role
 * @throws {ConflictError}  if clientMsgId was already received (duplicate retry)
 */
export const sendMessage = async (
    senderId: string,
    input: SendMessageInput,
) => {
    // 1. Verify membership + write permission
    const member = await ConvoRepo.findMember(input.conversationId, senderId);
    if (!member) throw new NotFoundError('Conversation');
    if (member.role === 'READ') {
        throw new ForbiddenError('You do not have permission to send messages');
    }

    try {
        // 2. Persist message
        const message = await MessageRepo.createMessage(senderId, input);

        // 3. Bump conversation timestamp
        await touchConversation(input.conversationId);

        // 4. Find offline members and enqueue delivery jobs
        await enqueueOfflineDelivery(message._id.toString(), input.conversationId, senderId);

        return message;
    } catch (err: unknown) {
        // Mongo duplicate key (code 11000) = client retrying a message already saved
        if (
            err &&
            typeof err === 'object' &&
            'code' in err &&
            (err as { code: number }).code === 11000
        ) {
            throw new ConflictError(
                'Message already received — duplicate clientMsgId',
            );
        }
        throw err;
    }
};

// =============================================================================
// Read / Edit / Delete / React — unchanged from Phase 2
// =============================================================================

/**
 * Returns paginated messages for a conversation.
 * Caller must be a conversation member.
 */
export const getMessages = async (
    conversationId: string,
    userId: string,
    input: GetMessagesInput,
) => {
    const member = await ConvoRepo.findMember(conversationId, userId);
    if (!member) throw new NotFoundError('Conversation');
    return MessageRepo.getMessages(conversationId, input.before, input.limit);
};

/** Soft-deletes a message. Only the original sender can delete. */
export const deleteMessage = async (
    messageId: string,
    senderId: string,
) => {
    const message = await MessageRepo.softDeleteMessage(messageId, senderId);
    if (!message) throw new ForbiddenError('Cannot delete this message');
    return message;
};

/** Edits a message's text. Only the original sender can edit. */
export const editMessage = async (
    messageId: string,
    senderId: string,
    text: string,
) => {
    const message = await MessageRepo.editMessage(messageId, senderId, text);
    if (!message) throw new ForbiddenError('Cannot edit this message');
    return message;
};

/** Toggles an emoji reaction on a message. */
export const reactToMessage = async (
    messageId: string,
    userId: string,
    emoji: string,
) => {
    const message = await MessageRepo.toggleReaction(messageId, userId, emoji);
    if (!message) throw new NotFoundError('Message');
    return message;
};

// =============================================================================
// Private helpers
// =============================================================================

/**
 * Finds all conversation members who are currently offline
 * and enqueues a delivery job for them.
 *
 * We check isOnline from PostgreSQL (updated on WS connect/disconnect).
 * This is eventually consistent — a user who disconnected 100ms ago
 * might still show as online. That's acceptable: the WebSocket broadcast
 * will fail silently for them and the queue job acts as a safety net.
 */
async function enqueueOfflineDelivery(
    messageId: string,
    conversationId: string,
    senderId: string,
): Promise<void> {
    // Get all members except the sender
    const members = await prisma.conversationMember.findMany({
        where: { conversationId, userId: { not: senderId } },
        include: { user: { select: { id: true, isOnline: true } } },
    });

    const offlineRecipientIds = members
        .filter((m) => !m.user.isOnline)
        .map((m) => m.userId);

    if (offlineRecipientIds.length === 0) return;

    // One job per message covering all offline recipients
    await messageDeliveryQueue.add(
        'deliver',
        {
            messageId,
            conversationId,
            senderId,
            recipientIds: offlineRecipientIds,
        },
        {
            // Delay slightly — gives the user a window to reconnect before we
            // fall back to push notifications
            delay: 3000,
        },
    );
}