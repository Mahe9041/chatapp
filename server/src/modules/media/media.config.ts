// =============================================================================
// media.config.ts
// File size limits and allowed MIME types per category.
// Change limits here — nowhere else.
// =============================================================================

import type { AllowedMimeType, MediaCategory } from './media.types';

export const MEDIA_CONFIG: Record<MediaCategory, {
    mimeTypes: AllowedMimeType[];
    maxBytes: number;
    label: string;
}> = {
    image: {
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        maxBytes: 10 * 1024 * 1024,   // 10 MB
        label: 'Image',
    },
    audio: {
        mimeTypes: ['audio/mpeg', 'audio/ogg', 'audio/webm'],
        maxBytes: 25 * 1024 * 1024,   // 25 MB
        label: 'Audio',
    },
    video: {
        mimeTypes: ['video/mp4', 'video/webm'],
        maxBytes: 100 * 1024 * 1024,  // 100 MB
        label: 'Video',
    },
    document: {
        mimeTypes: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        maxBytes: 20 * 1024 * 1024,    // 20 MB
        label: 'Document',
    },
};

/** Maps a MIME type to its category */
export const getMimeCategory = (
    mimeType: string,
): MediaCategory | null => {
    for (const [category, cfg] of Object.entries(MEDIA_CONFIG)) {
        if ((cfg.mimeTypes as string[]).includes(mimeType)) {
            return category as MediaCategory;
        }
    }
    return null;
};

/** Presigned URL TTL — 5 minutes is enough for any upload */
export const PRESIGN_EXPIRES_SECONDS = 300;
