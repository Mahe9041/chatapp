// =============================================================================
// auth.schema.ts
// Zod validation schemas for auth request bodies.
// Used by validate.middleware.ts to reject malformed requests early.
// =============================================================================

import { z } from 'zod';

export const RegisterSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password too long')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
    displayName: z.string()
        .min(2, 'Display name must be at least 2 characters')
        .max(50, 'Display name too long')
        .trim(),
});

export const LoginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

export const RefreshSchema = z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Inferred types used in service + controller
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshInput = z.infer<typeof RefreshSchema>;