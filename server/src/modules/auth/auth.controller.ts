// =============================================================================
// auth.controller.ts
// Thin HTTP handlers — validate → call service → respond.
// Each handler is intentionally ≤ 20 lines.
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import * as AuthService from './auth.service';
import {
    RegisterSchema,
    LoginSchema,
    RefreshSchema
} from './auth.schema';

/** POST /api/auth/register */
export const registerHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const input = RegisterSchema.parse(req.body);
        const result = await AuthService.register(input);
        res.status(201).json({ data: result });
    } catch (err) { next(err); }
};

/** POST /api/auth/login */
export const loginHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const input = LoginSchema.parse(req.body);
        const result = await AuthService.login(input);
        res.status(200).json({ data: result });
    } catch (err) { next(err); }
};

/** POST /api/auth/refresh */
export const refreshHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { refreshToken } = RefreshSchema.parse(req.body);
        const tokens = await AuthService.refresh(refreshToken);
        res.status(200).json({ data: tokens });
    } catch (err) { next(err); }
};

/** POST /api/auth/logout */
export const logoutHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { refreshToken } = RefreshSchema.parse(req.body);
        await AuthService.logout(refreshToken);
        res.status(204).send();
    } catch (err) { next(err); }
};

/** GET /api/auth/me — returns the currently authenticated user */
export const meHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // req.user is attached by auth.middleware.ts
        res.status(200).json({ data: req.user });
    } catch (err) { next(err); }
};


