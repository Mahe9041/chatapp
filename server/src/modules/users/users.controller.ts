// =============================================================================
// users.controller.ts
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import * as UserService from './users.service';
import { z } from 'zod';
import { NotFoundError } from '../../errors/errors';

/** GET /api/users/search?q=mahesh */
export const searchUsers = async (
    req: Request, res: Response, next: NextFunction,
) => {
    try {
        const { q } = z.object({ q: z.string().min(1).max(50) }).parse(req.query);
        const users = await UserService.searchUsers(q, req.user!.id);
        res.status(200).json({ data: users });
    } catch (err) { next(err); }
};

/** GET /api/users/:userId */
export const getUserById = async (
    req: Request, res: Response, next: NextFunction,
) => {
    try {
        const user = await UserService.getUserById(req.params.userId);
        if (!user) throw new NotFoundError('User');
        res.status(200).json({ data: user });
    } catch (err) { next(err); }
};

/** PATCH /api/users/me */
export const updateProfile = async (
    req: Request, res: Response, next: NextFunction,
) => {
    try {
        const data = z.object({
            displayName: z.string().min(2).max(50).optional(),
            avatarUrl: z.string().url().optional(),
        }).parse(req.body);
        const user = await UserService.updateProfile(req.user!.id, data);
        res.status(200).json({ data: user });
    } catch (err) { next(err); }
};
