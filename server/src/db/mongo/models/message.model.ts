/**
 * Message Model — MongoDB / Mongoose
 * ------------------------------------
 * Every chat message across all conversations is stored here.
 * PostgreSQL stores WHO is in WHICH conversation.
 * MongoDB stores WHAT they said.
 *
 * Key design decisions:
 *  - `seq` is a per-conversation sequence number for guaranteed ordering
 *  - `clientMsgId` is client-generated UUID used to deduplicate retries
 *  - `deliveryStatus` is a map of userId → status for read receipts
 *  - Soft deletes via `deletedAt` — we never hard-delete messages
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// =============================================================================
// Types
// =============================================================================

export type MessageType =
    | 'text'
    | 'image'
    | 'audio'
    | 'video'
    | 'document'
    | 'system';

export type DeliveryStatus = 'sent' | 'delivered' | 'read';

export interface IMessageContent {
    text?: string;
    url?: string;
    mimeType?: string;
    fileSize?: number;
    durationSec?: number;
    blurhash?: string;
    originalName?: string;
}

export interface IReaction {
    emoji: string;
    userIds: string[];
}

export interface IMessage extends Document {
    conversationId: string;
    senderId: string;
    seq: number;
    clientMsgId: string;
    type: MessageType;
    content: IMessageContent;
    replyTo: mongoose.Types.ObjectId | null;
    reactions: IReaction[];
    deliveryStatus: Map<string, DeliveryStatus>;
    editedAt: Date | null;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

// =============================================================================
// Schema
// =============================================================================

const MessageContentSchema = new Schema<IMessageContent>(
    {
        text: { type: String },
        url: { type: String },
        mimeType: { type: String },
        fileSize: { type: Number },
        durationSec: { type: Number },
        blurhash: { type: String },
        originalName: { type: String },
    },
    { _id: false }, // embedded doc — no separate _id needed
);

const ReactionSchema = new Schema<IReaction>(
    {
        emoji: { type: String, required: true },
        userIds: { type: [String], default: [] },
    },
    { _id: false },
);

const MessageSchema = new Schema<IMessage>(
    {
        conversationId: {
            type: String,
            required: true,
            index: true, // primary query pattern: all messages in a conversation
        },
        senderId: {
            type: String,
            required: true,
            index: true,
        },
        seq: {
            type: Number,
            required: true,
        },
        clientMsgId: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: ['text', 'image', 'audio', 'video', 'document', 'system'],
            required: true,
            default: 'text',
        },
        content: {
            type: MessageContentSchema,
            required: true,
        },
        replyTo: {
            type: Schema.Types.ObjectId,
            ref: 'Message',
            default: null,
        },
        reactions: {
            type: [ReactionSchema],
            default: [],
        },
        deliveryStatus: {
            type: Map,
            of: String,
            default: {},
        },
        editedAt: { type: Date, default: null },
        deletedAt: { type: Date, default: null },
    },
    {
        timestamps: true, // auto-manages createdAt + updatedAt
    },
);

// =============================================================================
// Indexes
// =============================================================================

/**
 * Primary read pattern: paginate messages in a conversation by sequence number.
 * The compound index makes this O(log n) instead of a full collection scan.
 */
MessageSchema.index({ conversationId: 1, seq: -1 });

/**
 * Deduplication index — prevents the same client message being stored twice
 * if the client retries on network failure. Unique per conversation.
 */
MessageSchema.index(
    { conversationId: 1, clientMsgId: 1 },
    { unique: true },
);

/**
 * Full-text search index on message content.
 * Enables: MessageModel.find({ $text: { $search: "hello" } })
 */
MessageSchema.index({ 'content.text': 'text' });

// =============================================================================
// Counter collection for per-conversation sequence numbers
// =============================================================================

/**
 * Separate schema to track the latest seq number per conversation.
 * Using findOneAndUpdate with $inc gives us atomic, race-condition-free
 * sequence number generation even under concurrent writes.
 */
interface IConversationCounter {
    conversationId: string;
    seq: number;
}

const ConversationCounterSchema = new Schema<IConversationCounter>({
    conversationId: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
});

export const ConversationCounter: Model<IConversationCounter> =
    mongoose.models.ConversationCounter ||
    mongoose.model<IConversationCounter>('ConversationCounter', ConversationCounterSchema);

/**
 * Atomically increments and returns the next sequence number for a conversation.
 * Called by MessageService before every insert.
 *
 * @param conversationId - The conversation to increment the counter for
 * @returns The next sequence number (starts at 1)
 */
export const getNextSeq = async (conversationId: string): Promise<number> => {
    const counter = await ConversationCounter.findOneAndUpdate(
        { conversationId },
        { $inc: { seq: 1 } },
        { upsert: true, new: true },
    );
    return counter.seq;
};

// =============================================================================
// Model export
// =============================================================================

export const MessageModel: Model<IMessage> =
    mongoose.models.Message ||
    mongoose.model<IMessage>('Message', MessageSchema);