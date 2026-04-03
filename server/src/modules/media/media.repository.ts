// =============================================================================
// media.repository.ts
// Wraps AWS SDK S3 calls for Cloudflare R2.
// R2 is S3-compatible, so we use the standard AWS SDK with a custom endpoint.
// =============================================================================

import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env';
import { PRESIGN_EXPIRES_SECONDS } from './media.config';

// ── R2 client — uses S3-compatible API ───────────────────────────────────────
const r2Client = new S3Client({
    region: 'auto',     // R2 uses "auto" as the region
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
});

/**
 * Generates a presigned PUT URL for direct client-to-R2 upload.
 * The client uploads directly to R2 — the server never handles the binary.
 *
 * @param fileKey  - The R2 object key (path) for the file
 * @param mimeType - Content-Type header the client must send with the PUT
 */
export const generatePresignedPutUrl = async (
    fileKey: string,
    mimeType: string,
): Promise<string> => {
    const command = new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: fileKey,
        ContentType: mimeType,
    });

    return getSignedUrl(r2Client, command, {
        expiresIn: PRESIGN_EXPIRES_SECONDS,
    });
};

/**
 * Generates a presigned GET URL for private files.
 * Not used for public CDN files — only for restricted access (e.g. documents).
 */
export const generatePresignedGetUrl = async (
    fileKey: string,
): Promise<string> => {
    const command = new GetObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: fileKey,
    });

    return getSignedUrl(r2Client, command, { expiresIn: 3600 }); // 1 hour
};

/**
 * Permanently deletes a file from R2.
 * Called when a message with media is hard-deleted (e.g. admin purge).
 */
export const deleteFile = async (fileKey: string): Promise<void> => {
    await r2Client.send(new DeleteObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: fileKey,
    }));
};
