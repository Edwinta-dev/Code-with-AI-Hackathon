import { supabase } from './supabase';

export const STORAGE_BUCKETS = {
  CHAT_DOCUMENTS: 'chat-documents',
  CLIENT_RECORDS: 'client-records',
} as const;

// Maximum file size in bytes (50MB)
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface UploadError extends Error {
  code: string;
  stage: string;
  details: {
    fileType: string;
    fileSize: number;
    fileName: string;
    timestamp: string;
    bucket: string;
  };
}

function createUploadError(
  message: string,
  code: string,
  stage: UploadError['stage'],
  file: File,
  bucket: string
): UploadError {
  const error = new Error(message) as UploadError;
  error.code = code;
  error.stage = stage;
  error.details = {
    fileType: file.type,
    fileSize: file.size,
    fileName: file.name,
    timestamp: new Date().toISOString(),
    bucket,
  };
  return error;
}

export async function uploadFile(
  bucket: string,
  file: File,
  path: string
) {
  try {
    // Validation stage
    if (file.size > MAX_FILE_SIZE) {
      throw createUploadError(
        'File size exceeds maximum limit of 50MB',
        'FILE_TOO_LARGE',
        'validation',
        file,
        bucket
      );
    }

    if (!file.type) {
      throw createUploadError(
        'File type not detected',
        'INVALID_FILE_TYPE',
        'validation',
        file,
        bucket
      );
    }

    // Check if bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.id === bucket);
    
    if (!bucketExists) {
      throw createUploadError(
        `Storage bucket "${bucket}" not found`,
        'BUCKET_NOT_FOUND',
        'initialization',
        file,
        bucket
      );
    }

    // Initialization stage
    console.log(`Starting upload for ${file.name} to ${bucket}`, {
      fileType: file.type,
      fileSize: file.size,
      timestamp: new Date().toISOString(),
    });

    // Transfer stage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw createUploadError(
        error.message,
        error.name,
        'transfer',
        file,
        bucket
      );
    }

    if (!data) {
      throw createUploadError(
        'Upload completed but no data returned',
        'NO_UPLOAD_DATA',
        'completion',
        file,
        bucket
      );
    }

    // Completion stage
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    console.log(`Upload completed successfully for ${file.name}`, {
      path: data.path,
      publicUrl,
      timestamp: new Date().toISOString(),
    });

    return {
      path: data.path,
      url: publicUrl
    };
  } catch (error) {
    // Log detailed error information
    console.error('File upload failed:', {
      error,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
      },
      bucket,
      timestamp: new Date().toISOString(),
    });

    throw error;
  }
}

export async function deleteFile(
  bucket: string,
  path: string
) {
  try {
    console.log(`Starting file deletion from ${bucket}`, {
      path,
      timestamp: new Date().toISOString(),
    });

    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) throw error;

    console.log(`File deleted successfully from ${bucket}`, {
      path,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('File deletion failed:', {
      error,
      bucket,
      path,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

export function getFileUrl(
  bucket: string,
  path: string
) {
  return supabase.storage
    .from(bucket)
    .getPublicUrl(path).data.publicUrl;
}

// Helper to generate a unique file path
export function generateFilePath(userId: string, fileName: string) {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  return `${userId}/${timestamp}-${randomString}-${fileName}`;
}