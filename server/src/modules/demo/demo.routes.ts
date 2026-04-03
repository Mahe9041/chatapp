/**
 * demo.routes.ts
 * Public routes — no auth required.
 * The demo session endpoint issues its own tokens for both demo users.
 */

import { Router } from 'express';
import { getDemoSession } from './demo.controller';

const router = Router();

/** GET /api/demo/session — returns tokens + conversationId for both demo users */
router.get('/session', getDemoSession);

export default router;