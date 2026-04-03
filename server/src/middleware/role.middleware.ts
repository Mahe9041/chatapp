// =============================================================================
// role.middleware.ts
// Factory middleware that guards group conversation actions by member role.
// Depends on authMiddleware running first (req.user must be populated).
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import type { MemberRole } from '@prisma/client';
import { prisma } from '../config/database';
import {
    ForbiddenError,
    NotFoundError
} from '../errors/errors';

// Role hierarchy: ADMIN ≥ WRITE ≥ READ
const ROLE_RANK: Record<MemberRole, number> = {
    ADMIN: 3,
    WRITE: 2,
    READ: 1,
};

/**
 * Creates a middleware that ensures the requesting user has at least
 * the specified role in the target conversation.
 *
 * Expects `req.params.conversationId` to be present.
 *
 * @example
 * router.post('/:conversationId/messages', authMiddleware, requireRole('WRITE'), sendMessage)
 */
export const requireRole = (minimumRole: MemberRole) =>
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { conversationId } = req.params;
            const userId = req.user!.id;

            const member = await prisma.conversationMember.findUnique({
                where: {
                    conversationId_userId: { conversationId, userId },
                },
            });

            if (!member) throw new NotFoundError('Conversation');

            if (ROLE_RANK[member.role] < ROLE_RANK[minimumRole]) {
                throw new ForbiddenError(
                    `This action requires ${minimumRole} role or higher`,
                );
            }

            // Attach role to request for downstream use (avoids re-querying)
            req.memberRole = member.role;
            next();
        } catch (err) {
            next(err);
        }
    };
