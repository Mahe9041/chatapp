// =============================================================================
// hooks/useMediaUpload.ts
// Manages the 3-step media upload flow:
//   1. Request presigned URL from server
//   2. PUT file directly to R2 (never goes through our server)
//   3. Return the public CDN URL for use in the message content
//
// Also handles:
//   - Client-side file validation (type + size) before hitting the API
//   - Upload progress tracking
//   - Image compression for images > 1MB
// =============================================================================

import { useState, useCallback } from 'react';
import * as MediaApi from '../api/media.api';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Max file sizes enforced client-side (mirrors server config) */
const CLIENT_LIMITS: Record<string, number> = {
    'image': 10 * 1024 * 1024,  // 10 MB
    'audio': 25 * 1024 * 1024,  // 25 MB
    'video': 100 * 1024 * 1024,  // 100 MB
    'document': 20 * 1024 * 1024,  // 20 MB
};

const ALLOWED_TYPES: Record<string, string> = {
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/webp': 'image',
    'image/gif': 'image',
    'audio/mpeg': 'audio',
    'audio/ogg': 'audio',
    'audio/webm': 'audio',
    'video/mp4': 'video',
    'video/webm': 'video',
    'application/pdf': 'document',
    'application/msword': 'document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UploadResult {
    publicUrl: string;
    fileKey: string;
    mimeType: string;
    fileSize: number;
    originalName: string;
    category: string;
}

export interface UploadState {
    isUploading: boolean;
    progress: number;   // 0–100
    error: string | null;
}

// ── Image compression ─────────────────────────────────────────────────────────

/**
 * Compresses an image file client-side before upload using Canvas API.
 * Images > 1MB are resized to max 1920px and re-encoded as WebP at 85% quality.
 * GIFs are never compressed (Canvas loses animation).
 *
 * @returns The compressed File, or the original if compression isn't needed
 */
async function compressImage(file: File): Promise<File> {
    // Skip compression for GIFs and small files
    if (file.type === 'image/gif' || file.size < 1024 * 1024) return file;

    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            // Calculate new dimensions (max 1920px on longest side)
            const MAX = 1920;
            let { width, height } = img;
            if (width > MAX || height > MAX) {
                if (width > height) {
                    height = Math.round((height * MAX) / width);
                    width = MAX;
                } else {
                    width = Math.round((width * MAX) / height);
                    height = MAX;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (!blob || blob.size >= file.size) {
                        // Compression made it bigger — use original
                        resolve(file);
                    } else {
                        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), {
                            type: 'image/webp',
                        }));
                    }
                },
                'image/webp',
                0.85, // 85% quality — good balance of size vs visual quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(file); // Fall back to original on error
        };

        img.src = url;
    });
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Provides a single `upload` function that handles the complete
 * client-side upload lifecycle.
 *
 * Usage in a component:
 *   const { upload, state } = useMediaUpload();
 *   const result = await upload(file);
 *   // Use result.publicUrl in the message content
 */
export function useMediaUpload() {
    const [state, setState] = useState<UploadState>({
        isUploading: false,
        progress: 0,
        error: null,
    });

    const upload = useCallback(async (file: File): Promise<UploadResult | null> => {
        setState({ isUploading: true, progress: 0, error: null });

        try {
            // ── Step 0: Client-side validation ──────────────────────────────────
            const category = ALLOWED_TYPES[file.type];
            if (!category) {
                throw new Error(`File type "${file.type}" is not supported`);
            }

            const limit = CLIENT_LIMITS[category];
            if (file.size > limit) {
                throw new Error(
                    `File too large. Max size for ${category} is ${Math.round(limit / 1024 / 1024)}MB`,
                );
            }

            // ── Step 0.5: Compress images ────────────────────────────────────────
            let fileToUpload = file;
            if (category === 'image') {
                setState((s) => ({ ...s, progress: 5 }));
                fileToUpload = await compressImage(file);
            }

            setState((s) => ({ ...s, progress: 10 }));

            // ── Step 1: Get presigned URL ────────────────────────────────────────
            const presign = await MediaApi.requestPresignedUrl({
                mimeType: fileToUpload.type,
                fileSize: fileToUpload.size,
                originalName: file.name,
            });

            setState((s) => ({ ...s, progress: 20 }));

            // ── Step 2: PUT directly to R2 ───────────────────────────────────────
            // Use XMLHttpRequest instead of fetch so we get upload progress events
            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const pct = 20 + Math.round((e.loaded / e.total) * 75);
                        setState((s) => ({ ...s, progress: pct }));
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) resolve();
                    else reject(new Error(`Upload failed: HTTP ${xhr.status}`));
                };

                xhr.onerror = () => reject(new Error('Upload failed: network error'));

                xhr.open('PUT', presign.uploadUrl);
                xhr.setRequestHeader('Content-Type', fileToUpload.type);
                xhr.send(fileToUpload);
            });

            setState((s) => ({ ...s, progress: 95 }));

            // ── Step 3: Confirm upload ───────────────────────────────────────────
            await MediaApi.confirmUpload(presign.fileKey);

            setState({ isUploading: false, progress: 100, error: null });

            return {
                publicUrl: presign.publicUrl,
                fileKey: presign.fileKey,
                mimeType: fileToUpload.type,
                fileSize: fileToUpload.size,
                originalName: file.name,
                category,
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Upload failed';
            setState({ isUploading: false, progress: 0, error: message });
            return null;
        }
    }, []);

    return { upload, state };
}