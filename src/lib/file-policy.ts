/**
 * Client-side mirror of the Storage bucket policy set on `company-files`
 * in supabase/migrations/0013_security_hardening.sql (SEC-23). Keep the
 * two in sync — this file exists purely for fast UX feedback (reject
 * before spending a network round-trip); the bucket's own
 * file_size_limit/allowed_mime_types plus the files_size_limit CHECK
 * constraint on the `files` table are the actual enforcement boundary
 * and reject the same upload regardless of what this file says.
 */

export const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/zip",
  "application/json",
]);

export function validateFile(file: File): string | null {
  if (file.size === 0) {
    return `${file.name} is empty.`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `${file.name} is larger than the 200 MB upload limit.`;
  }
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return `${file.name} has an unsupported file type (${file.type}).`;
  }
  return null;
}

/** Strips characters that would otherwise create confusing nested
 * "folders" in the storage bucket or break the signed-URL filename. */
export function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 200);
}
