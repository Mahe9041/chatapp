// =============================================================================
// media.controller.ts
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import * as MediaService from './media.service';
import { z } from 'zod';

const PresignSchema = z.object({
    mimeType: z.string().min(1),
    fileSize: z.coerce.number().positive(),
    originalName: z.string().min(1).max(255),
});

/**
 * POST /api/media/presign
 * Returns a presigned PUT URL for direct client-to-R2 upload.
 */
export const presign = async (
    req: Request, res: Response, next: NextFunction,
) => {
    try {
        const { mimeType, fileSize, originalName } = PresignSchema.parse(req.body);
        const result = await MediaService.requestPresignedUrl(
            req.user!.id,
            mimeType,
            fileSize,
            originalName,
        );
        res.status(200).json({ data: result });
    } catch (err) { next(err); }
};

/**
 * POST /api/media/confirm
 * Client calls this after a successful PUT to R2.
 * Allows server to verify the upload completed.
 */
export const confirm = async (
    req: Request, res: Response, next: NextFunction,
) => {
    try {
        const { fileKey } = z.object({ fileKey: z.string() }).parse(req.body);
        const result = await MediaService.confirmUpload(fileKey);
        res.status(200).json({ data: result });
    } catch (err) { next(err); }
};
