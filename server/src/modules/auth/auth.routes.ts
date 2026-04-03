// =============================================================================
// auth.routes.ts
// Registers all auth endpoints on an Express Router.
// Mounted at /api/auth in app.ts.
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import * as Controller from './auth.controller';

const router = Router();

/** Public routes — no token required */
router.post('/register', Controller.registerHandler);
router.post('/login', Controller.loginHandler);
router.post('/refresh', Controller.refreshHandler);
router.post('/logout', Controller.logoutHandler);

/** Protected route — requires valid access token */
router.get('/me', authMiddleware, Controller.meHandler);

export default router;