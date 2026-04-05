// =============================================================================
// media.repository.ts — Supabase version
// All direct Supabase Storage calls live here.
// media.service.ts calls these — never touches Supabase directly.
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import { env } from '../../config/env';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = env.SUPABASE_BUCKET;

export interface SignedUploadResult {
    signedUrl: string;   // client PUTs directly to this
    token: string;       // Supabase upload token
}

/**
 * Generates a signed URL the client can PUT a file to directly.
 * Equivalent to R2's generatePresignedPutUrl.
 */
export const generatePresignedPutUrl = async (
    fileKey: string,
    _mimeType: string,   // kept for API compatibility — Supabase infers from PUT
): Promise<string> => {
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUploadUrl(fileKey);

    if (error || !data) {
        throw new Error(`Failed to generate signed upload URL: ${error?.message}`);
    }

    return data.signedUrl;
};

/**
 * Verifies a file exists in storage after the client claims to have uploaded it.
 * Equivalent to R2's HeadObjectCommand check.
 */
export const verifyFileExists = async (fileKey: string): Promise<boolean> => {
    const folder = fileKey.split('/').slice(0, -1).join('/');
    const filename = fileKey.split('/').pop() ?? '';

    const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(folder, { search: filename });

    if (error) {
        console.warn(`verifyFileExists: error checking ${fileKey}:`, error.message);
        return false;
    }

    return (data?.length ?? 0) > 0;
};

/**
 * Deletes a file from storage.
 * Useful for future cleanup jobs (orphaned file removal).
 */
export const deleteFile = async (fileKey: string): Promise<void> => {
    const { error } = await supabase.storage.from(BUCKET).remove([fileKey]);
    if (error) {
        console.warn(`deleteFile: failed to delete ${fileKey}:`, error.message);
    }
};

/**
 * Builds the public URL for a file after it has been uploaded.
 * Bucket must have public access enabled in Supabase dashboard.
 */
export const getPublicUrl = (fileKey: string): string => {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileKey);
    return data.publicUrl;
};