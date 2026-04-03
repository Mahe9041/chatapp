// =============================================================================
// media.types.ts
// =============================================================================

export type AllowedMimeType =
    | 'image/jpeg'
    | 'image/png'
    | 'image/webp'
    | 'image/gif'
    | 'audio/mpeg'
    | 'audio/ogg'
    | 'audio/webm'
    | 'video/mp4'
    | 'video/webm'
    | 'application/pdf'
    | 'application/msword'
    | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export type MediaCategory = 'image' | 'audio' | 'video' | 'document';

export interface PresignedUploadResult {
    uploadUrl: string;   // PUT to this URL directly from the client
    fileKey: string;   // R2 object key — stored in the message
    publicUrl: string;   // CDN URL to access the file after upload
    expiresIn: number;   // seconds until the presigned URL expires
}

export interface UploadedMediaMeta {
    fileKey: string;
    publicUrl: string;
    mimeType: AllowedMimeType;
    fileSize: number;
    category: MediaCategory;
    originalName: string;
}
