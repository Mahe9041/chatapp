// =============================================================================
// messages.routes.ts
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import * as Controller from './messages.controller';

const router = Router();
router.use(authMiddleware);

// Standalone message operations
router.post('/', Controller.sendMessage);
router.delete('/:messageId', Controller.deleteMessage);
router.patch('/:messageId', Controller.editMessage);
router.post('/:messageId/react', Controller.reactToMessage);

export default router;