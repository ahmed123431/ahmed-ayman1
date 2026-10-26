import { supabase } from './supabaseClient';

const BUCKET_NAME = 'app-files';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export interface UploadResult {
    success: boolean;
    path?: string;
    publicUrl?: string;
    error?: string;
}

/**
 * Validates a file before upload.
 * Returns an error message if invalid, or null if valid.
 */
export function validateFile(
    file: File,
    options?: {
        maxSize?: number;
        allowedTypes?: string[];
    }
): string | null {
    const maxSize = options?.maxSize ?? MAX_FILE_SIZE;
    const allowedTypes = options?.allowedTypes;

    if (file.size > maxSize) {
        const maxMB = Math.round(maxSize / (1024 * 1024));
        return `File too large. Maximum size is ${maxMB}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`;
    }

    if (allowedTypes && allowedTypes.length > 0) {
        const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
        const matchesType = allowedTypes.some(type => {
            if (type.includes('/')) {
                // MIME type check (e.g. 'image/*')
                if (type.endsWith('/*')) {
                    return file.type.startsWith(type.replace('/*', '/'));
                }
                return file.type === type;
            }
            // Extension check (e.g. '.pdf')
            return `.${fileExt}` === type.toLowerCase();
        });
        if (!matchesType) {
            return `Invalid file format. Allowed formats: ${allowedTypes.join(', ')}`;
        }
    }

    return null;
}

/**
 * Generates a collision-free storage path.
 * Format: {userId}/{category}/{timestamp}_{sanitizedFilename}
 */
function generateStoragePath(userId: string, category: string, fileName: string): string {
    const timestamp = Date.now();
    const sanitized = fileName
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_');
    return `${userId}/${category}/${timestamp}_${sanitized}`;
}

/**
 * Uploads a file to Supabase Storage (app-files bucket).
 */
export async function uploadFile(
    file: File,
    userId: string,
    category: string,
    options?: {
        maxSize?: number;
        allowedTypes?: string[];
    }
): Promise<UploadResult> {
    // Validate
    const validationError = validateFile(file, options);
    if (validationError) {
        return { success: false, error: validationError };
    }

    const filePath = generateStoragePath(userId, category, file.name);

    try {
        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            return { success: false, error: uploadError.message || 'Upload failed. Please try again.' };
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        return {
            success: true,
            path: filePath,
            publicUrl: urlData.publicUrl,
        };
    } catch (err) {
        console.error('Unexpected upload error:', err);
        return { success: false, error: 'An unexpected error occurred during upload.' };
    }
}

/**
 * Deletes a file from Supabase Storage.
 */
export async function deleteFile(filePath: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([filePath]);

        if (error) {
            console.error('Storage delete error:', error);
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (err) {
        console.error('Unexpected delete error:', err);
        return { success: false, error: 'Failed to delete file.' };
    }
}

/**
 * Gets the public URL for a stored file path.
 */
export function getPublicUrl(filePath: string): string {
    const { data } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);
    return data.publicUrl;
}

/**
 * Gets a signed URL for private files (valid for 1 hour).
 */
export async function getSignedUrl(filePath: string, expiresIn = 3600): Promise<string | null> {
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(filePath, expiresIn);

    if (error) {
        console.error('Error creating signed URL:', error);
        return null;
    }
    return data.signedUrl;
}
