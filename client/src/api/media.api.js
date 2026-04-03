// =============================================================================
// api/media.api.ts
// =============================================================================
import { apiClient } from './client';
/** Step 1 — get a presigned PUT URL from the server */
export const requestPresignedUrl = async (payload) => {
    const { data } = await apiClient.post('/media/presign', payload);
    return data.data;
};
/** Step 3 — notify server that upload completed */
export const confirmUpload = async (fileKey) => {
    await apiClient.post('/media/confirm', { fileKey });
};
