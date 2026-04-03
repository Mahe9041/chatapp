// =============================================================================
// media.routes.ts
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import * as Controller from './media.controller';

const router = Router();
router.use(authMiddleware);

router.post('/presign', Controller.presign);
router.post('/confirm', Controller.confirm);

export default router;