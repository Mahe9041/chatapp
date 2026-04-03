/**
 * Environment Configuration
 * --------------------------
 * Validates ALL environment variables at startup using Zod.
 * The app will REFUSE to start if any required variable is missing or malformed.
 * Import `env` everywhere instead of accessing `process.env` directly.
 *
 * Copy `.env.example` → `.env` and fill in your values before running.
 */

import { z } from 'zod';

// =============================================================================
// SCHEMA — define every variable the app needs
// =============================================================================

const envSchema = z.object({
    // ── Runtime ────────────────────────────────────────────────────────────────
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(4000),

    // ── JWT ────────────────────────────────────────────────────────────────────
    /** Must be at least 32 chars. Generate with: openssl rand -hex 32 */
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be ≥ 32 chars'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be ≥ 32 chars'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

    // ── Databases ──────────────────────────────────────────────────────────────
    /** PostgreSQL connection string (Supabase / Railway) */
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
    /** MongoDB connection string (Atlas free tier) */
    MONGODB_URI: z.string().url('MONGODB_URI must be a valid URL'),
    /** Redis connection string (Upstash free tier) */
    REDIS_URL: z.string().url('REDIS_URL must be a valid URL'),

    // ── Object Storage (Cloudflare R2) ─────────────────────────────────────────
    R2_ACCOUNT_ID: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_BUCKET_NAME: z.string().min(1),
    /** Public CDN URL for serving uploaded files */
    CDN_BASE_URL: z.string().url(),

    // ── Push Notifications (optional in dev) ───────────────────────────────────
    FCM_SERVER_KEY: z.string().optional(),

    // ── Observability ──────────────────────────────────────────────────────────
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    // ── CORS ───────────────────────────────────────────────────────────────────
    /** Comma-separated list of allowed origins, e.g. "http://localhost:5173,https://chatapp.vercel.app" */
    CORS_ORIGINS: z.string().default('http://localhost:5173'),
});

// =============================================================================
// PARSE — crash immediately on invalid config
// =============================================================================

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('\n❌  Invalid environment variables — app cannot start:\n');
    const errors = parsed.error.flatten().fieldErrors;
    Object.entries(errors).forEach(([field, messages]) => {
        console.error(`  ${field}: ${messages?.join(', ')}`);
    });
    console.error('\nCheck your .env file against .env.example\n');
    process.exit(1);
}

// =============================================================================
// EXPORT — typed, validated config object
// =============================================================================

export const env = parsed.data;

/** Convenience flag — use instead of checking NODE_ENV string directly */
export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';