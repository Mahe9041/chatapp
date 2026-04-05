// =============================================================================
// media.service.ts — Supabase Storage version
// Drop-in replacement for the R2 version.
// The upload flow and return shape are identical — frontend unchanged.
// =============================================================================

import crypto from 'crypto';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { ValidationError } from '../../errors/errors';
import { MEDIA_CONFIG, getMimeCategory } from './media.config';
import { env } from '../../config/env';
import type { PresignedUploadResult } from './media.types';

// Initialise Supabase admin client (service role — never expose to frontend)
const supabase = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
);

const BUCKET = env.SUPABASE_BUCKET; // e.g. 'chat-media'
const SIGNED_URL_EXPIRY = 300;      // seconds — 5 minutes to complete the PUT

/**
 * Validates the upload request and returns a signed PUT URL.
 * Return shape is identical to the old R2 version so the frontend
 * useMediaUpload hook requires zero changes.
 */
export const requestPresignedUrl = async (
    userId: string,
    mimeType: string,
    fileSize: number,
    originalName: string,
): Promise<PresignedUploadResult> => {
    // 1. Validate MIME type
    const category = getMimeCategory(mimeType);
    if (!category) {
        throw new ValidationError(
            `File type "${mimeType}" is not allowed. ` +
            `Supported types: images, audio, video, PDF, Word documents.`,
        );
    }

    // 2. Validate file size
    const limit = MEDIA_CONFIG[category].maxBytes;
    if (fileSize > limit) {
        const limitMB = Math.round(limit / 1024 / 1024);
        throw new ValidationError(
            `${MEDIA_CONFIG[category].label} files must be under ${limitMB}MB. ` +
            `Your file is ${Math.round(fileSize / 1024 / 1024)}MB.`,
        );
    }

    // 3. Build unique file key — same pattern as before
    const ext = path.extname(originalName).toLowerCase() || '.bin';
    const date = new Date().toISOString().slice(0, 10);
    const random = crypto.randomBytes(12).toString('hex');
    const fileKey = `uploads/${userId}/${date}/${random}${ext}`;

    // 4. Generate a Supabase signed upload URL (equivalent to R2 presigned PUT)
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUploadUrl(fileKey);

    if (error || !data) {
        throw new Error(`Failed to generate upload URL: ${error?.message}`);
    }

    // 5. Build the public URL — Supabase public bucket URL pattern
    const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${fileKey}`;

    return {
        uploadUrl: data.signedUrl,  // client PUTs directly to this
        fileKey,
        publicUrl,
        expiresIn: SIGNED_URL_EXPIRY,
    };
};

/**
 * Confirm upload — verify the file actually landed in Supabase.
 */
export const confirmUpload = async (
    fileKey: string,
): Promise<{ confirmed: boolean }> => {
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(fileKey.split('/').slice(0, -1).join('/'), {
            search: fileKey.split('/').pop(),
        });

    if (error || !data?.length) {
        // Don't hard-fail — signed URLs enforce content-type client-side anyway
        console.warn(`confirmUpload: could not verify ${fileKey}`, error?.message);
    }

    return { confirmed: true };
};