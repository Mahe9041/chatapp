// =============================================================================
// messages.schema.ts
// =============================================================================

import { z } from 'zod';

export const SendMessageSchema = z.object({
    clientMsgId: z.string().uuid('clientMsgId must be a valid UUID'),
    conversationId: z.string().uuid(),
    type: z.enum(['text', 'image', 'audio', 'video', 'document']),
    content: z.object({
        text: z.string().max(4000).optional(),
        url: z.string().url().optional(),
        mimeType: z.string().optional(),
        fileSize: z.number().optional(),
        durationSec: z.number().optional(),
        blurhash: z.string().optional(),
        originalName: z.string().optional(),
    }),
    replyTo: z.string().optional(), // MongoDB ObjectId string
});

export const GetMessagesSchema = z.object({
    before: z.coerce.number().optional(), // seq number for pagination cursor
    limit: z.coerce.number().min(1).max(50).default(30),
});

export const ReactSchema = z.object({
    emoji: z.string().min(1).max(10),
});

export const EditMessageSchema = z.object({
    text: z.string().min(1).max(4000),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type GetMessagesInput = z.infer<typeof GetMessagesSchema>;