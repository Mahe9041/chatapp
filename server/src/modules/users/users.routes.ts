// =============================================================================
// users.routes.ts
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import * as Controller from './users.controller';

const router = Router();
router.use(authMiddleware);

router.get('/search', Controller.searchUsers);
router.get('/:userId', Controller.getUserById);
router.patch('/me', Controller.updateProfile);

export default router;