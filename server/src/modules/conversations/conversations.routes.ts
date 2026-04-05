/**
 * conversations.routes.ts
 * Mounts all conversation endpoints.
 * Also handles the nested messages route:
 *   GET /api/conversations/:conversationId/messages
 * This must live here (not in messages.routes) so Express can
 * merge the :conversationId param correctly.
 */

import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import * as Controller from './conversations.controller';
import * as MessageController from '../messages/messages.controller';

const router = Router();

// All conversation routes require authentication
router.use(authMiddleware);

router.post('/direct', Controller.createDirect);
router.post('/group', Controller.createGroup);
router.get('/', Controller.listConversations);
router.get('/:conversationId', Controller.getConversation);
router.patch('/:conversationId', Controller.updateGroup);

// ── Nested: messages inside a conversation ────────────────────────────────────
// GET /api/conversations/:conversationId/messages
router.get('/:conversationId/messages', MessageController.getMessages);

// ── Member management ─────────────────────────────────────────────────────────
router.post('/:conversationId/members', Controller.addMember);
router.delete('/:conversationId/members/:userId', Controller.removeMember);
router.patch('/:conversationId/members/:userId/role', Controller.changeMemberRole);

export default router;