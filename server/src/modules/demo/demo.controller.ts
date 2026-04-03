/**
 * demo.controller.ts
 * Thin handler — calls demo service and returns the session.
 */

import type { Request, Response, NextFunction } from 'express';
import { getOrCreateDemoSession } from './demo.service';

/** GET /api/demo/session */
export const getDemoSession = async (
    _req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const session = await getOrCreateDemoSession();
        res.status(200).json({ data: session });
    } catch (err) {
        next(err);
    }
};