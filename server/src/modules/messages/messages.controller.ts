// =============================================================================
// messages.controller.ts
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import * as MessageService from './messages.service';
import {
    SendMessageSchema,
    GetMessagesSchema,
    ReactSchema,
    EditMessageSchema,
} from './messages.schema';

/** POST /api/messages */
export const sendMessage = async (
    req: Request, res: Response, next: NextFunction,
) => {
    try {
        const input = SendMessageSchema.parse(req.body);
        const result = await MessageService.sendMessage(req.user!.id, input);
        res.status(201).json({ data: result });
    } catch (err) { next(err); }
};

/** GET /api/conversations/:conversationId/messages */
export const getMessages = async (
    req: Request, res: Response, next: NextFunction,
) => {
    try {
        const input = GetMessagesSchema.parse(req.query);
        const result = await MessageService.getMessages(
            req.params.conversationId,
            req.user!.id,
            input,
        );
        res.status(200).json({ data: result });
    } catch (err) { next(err); }
};

/** DELETE /api/messages/:messageId */
export const deleteMessage = async (
    req: Request, res: Response, next: NextFunction,
) => {
    try {
        const result = await MessageService.deleteMessage(
            req.params.messageId,
            req.user!.id,
        );
        res.status(200).json({ data: result });
    } catch (err) { next(err); }
};

/** PATCH /api/messages/:messageId */
export const editMessage = async (
    req: Request, res: Response, next: NextFunction,
) => {
    try {
        const { text } = EditMessageSchema.parse(req.body);
        const result = await MessageService.editMessage(
            req.params.messageId,
            req.user!.id,
            text,
        );
        res.status(200).json({ data: result });
    } catch (err) { next(err); }
};

/** POST /api/messages/:messageId/react */
export const reactToMessage = async (
    req: Request, res: Response, next: NextFunction,
) => {
    try {
        const { emoji } = ReactSchema.parse(req.body);
        const result = await MessageService.reactToMessage(
            req.params.messageId,
            req.user!.id,
            emoji,
        );
        res.status(200).json({ data: result });
    } catch (err) { next(err); }
};


