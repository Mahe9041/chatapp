// =============================================================================
// api/media.api.ts
// =============================================================================

import { apiClient } from './client';

export interface PresignRequest {
    mimeType: string;
    fileSize: number;
    originalName: string;
}

export interface PresignResponse {
    uploadUrl: string;   // PUT directly to this URL
    fileKey: string;   // store this in message content
    publicUrl: string;   // use this as the message URL after upload
    expiresIn: number;
}

/** Step 1 — get a presigned PUT URL from the server */
export const requestPresignedUrl = async (
    payload: PresignRequest,
): Promise<PresignResponse> => {
    const { data } = await apiClient.post<{ data: PresignResponse }>(
        '/media/presign',
        payload,
    );
    return data.data;
};

/** Step 3 — notify server that upload completed */
export const confirmUpload = async (fileKey: string): Promise<void> => {
    await apiClient.post('/media/confirm', { fileKey });
};

