// =============================================================================
// conversations.routes.ts
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import * as Controller from './conversations.controller';

const router = Router();

// All conversation routes require authentication
router.use(authMiddleware);

router.post('/', Controller.createDirect);    // kept for simplicity
router.post('/direct', Controller.createDirect);
router.post('/group', Controller.createGroup);
router.get('/', Controller.listConversations);
router.get('/:conversationId', Controller.getConversation);
router.patch('/:conversationId', Controller.updateGroup);

// Member management
router.post('/:conversationId/members', Controller.addMember);
router.delete('/:conversationId/members/:userId', Controller.removeMember);
router.patch('/:conversationId/members/:userId/role', Controller.changeMemberRole);

export default router;