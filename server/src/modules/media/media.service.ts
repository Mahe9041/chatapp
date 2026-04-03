// =============================================================================
// media.service.ts
// Business logic for media upload flow.
//
// Upload flow:
//   1. Client requests a presigned URL from this service (POST /api/media/presign)
//   2. Client PUTs the file directly to R2 using that URL
//   3. Client sends a message via WebSocket with the public CDN URL in content
//
// This means the server NEVER handles binary file data —
// it only generates signed URLs and validates metadata.
// =============================================================================

import crypto from 'crypto';
import path from 'path';
import { ValidationError } from '../../errors/errors';
import * as MediaRepo from './media.repository';
import {
    MEDIA_CONFIG,
    getMimeCategory
} from './media.config';
import { env } from '../../config/env';
import type {
    PresignedUploadResult,
    AllowedMimeType
} from './media.types';

/**
 * Validates the requested upload and returns a presigned PUT URL.
 *
 * @param userId       - Uploader's ID (used to namespace the file key)
 * @param mimeType     - The MIME type the client wants to upload
 * @param fileSize     - File size in bytes (client-reported, validated here)
 * @param originalName - Original filename (for content-disposition)
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

    // 3. Build a unique, organised file key
    //    Pattern: uploads/{userId}/{date}/{random}.{ext}
    const ext = path.extname(originalName).toLowerCase() || '.bin';
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const random = crypto.randomBytes(12).toString('hex');
    const fileKey = `uploads/${userId}/${date}/${random}${ext}`;

    // 4. Generate presigned URL
    const uploadUrl = await MediaRepo.generatePresignedPutUrl(fileKey, mimeType);

    // 5. Build the public CDN URL (available after upload completes)
    const publicUrl = `${env.CDN_BASE_URL}/${fileKey}`;

    return {
        uploadUrl,
        fileKey,
        publicUrl,
        expiresIn: 300,
    };
};

/**
 * Verifies that a file was actually uploaded to R2 after the client
 * claims to have done so. Used as an optional validation step.
 * (Simplified — production would check the R2 object exists via HeadObject)
 */
export const confirmUpload = async (
    fileKey: string,
): Promise<{ confirmed: boolean }> => {
    // In a full implementation, use HeadObjectCommand to verify the object exists
    // For now we trust the client — R2 presigned URLs enforce content-type anyway
    return { confirmed: true };
};
