// =============================================================================
// conversations.controller.ts
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import * as ConvoService from './conversations.service';
import {
    CreateDirectSchema,
    CreateGroupSchema,
    UpdateGroupSchema,
    UpdateMemberRoleSchema,
} from './conversations.schema';

/** POST /api/conversations/direct */
export const createDirect = async (
    req: Request, res: Response, next: NextFunction,
) => {
    try {
        const input = CreateDirectSchema.parse(req.body);
        const result = await ConvoService.createDirect(req.user!.id, input);
        res.status(201).json({ data: result });
    } catch (err) { next(err); }
};

/** POST /api/conversations/group */
export const createGroup = async (
    req: Request, res: Response, next: NextFunction,
) => {
    try {
        const input = CreateGroupSchema.parse(req.body);
        const result = await ConvoService.createGroup(req.user!.id, input);
        res.status(201).json({ data: result });
    } catch (err) { next(err); }
};

/** GET /api/conversations */
export const listConversations = async (
    req: Request, res: Response, next: NextFunction,
) => {
    try {
        const result = await ConvoService.getUserConversations(req.user!.id);
        res.status(200).json({ data: result });
    } catch (err) { next(err); }
};

/** GET /api/conversations/:conversationId */
export const getConversation = async (
    req: Request, res: Response, next: NextFunction,
) => {
    try {
        const result = await ConvoService.getConversation(
            req.params.conversationId,
            req.user!.id,
        );
        res.status(200).json({ data: result });
    } catch (err) { next(err); }
};

/** PATCH /api/conversations/:conversationId */
export const updateGroup = async (
    req: Request, res: Response, next: NextFunction,
) => {
    try {
        const input = UpdateGroupSchema.parse(req.body);
        const result = await ConvoService.updateGroup(
            req.params.conversationId, req.user!.id, input,
        );
        res.status(200).json({ data: result });
    } catch (err) { next(err); }
};

/** POST /api/conversations/:conversationId/members */
export const addMember = async (
    req: Request, res: Response, next: NextFunction,
) => {
    try {
        const { userId } = req.body;
        const result = await ConvoService.addMember(
            req.params.conversationId, req.user!.id, userId,
        );
        res.status(201).json({ data: result });
    } catch (err) { next(err); }
};

/** DELETE /api/conversations/:conversationId/members/:userId */
export const removeMember = async (
    req: Request, res: Response, next: NextFunction,
) => {
    try {
        await ConvoService.removeMember(
            req.params.conversationId, req.user!.id, req.params.userId,
        );
        res.status(204).send();
    } catch (err) { next(err); }
};

/** PATCH /api/conversations/:conversationId/members/:userId/role */
export const changeMemberRole = async (
    req: Request, res: Response, next: NextFunction,
) => {
    try {
        const { role } = UpdateMemberRoleSchema.parse(req.body);
        const result = await ConvoService.changeMemberRole(
            req.params.conversationId, req.user!.id, req.params.userId, role,
        );
        res.status(200).json({ data: result });
    } catch (err) { next(err); }
};
