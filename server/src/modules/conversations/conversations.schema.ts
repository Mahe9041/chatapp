// =============================================================================
// conversations.schema.ts
// =============================================================================

import { z } from 'zod';

export const CreateDirectSchema = z.object({
    targetUserId: z.string().uuid('Invalid user ID'),
});

export const CreateGroupSchema = z.object({
    name: z.string().min(1).max(60).trim(),
    memberIds: z.array(z.string().uuid()).min(1).max(49), // +1 for creator = 50 max
});

export const UpdateGroupSchema = z.object({
    name: z.string().min(1).max(60).trim().optional(),
    avatarUrl: z.string().url().optional(),
});

export const UpdateMemberRoleSchema = z.object({
    role: z.enum(['ADMIN', 'WRITE', 'READ']),
});

export type CreateDirectInput = z.infer<typeof CreateDirectSchema>;
export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;
export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>;
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;
