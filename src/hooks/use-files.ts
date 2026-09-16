import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { sanitizeFileName, validateFile } from "@/lib/file-policy";
import { formatBytes } from "@/lib/utils";
import type { FileObject } from "@/types/database";

const BUCKET = "company-files";

export function useFiles(folderId: string | null) {
  const { company } = useWorkspace();
  return useQuery({
    queryKey: ["files", company?.id, folderId],
    enabled: !!company,
    queryFn: async () => {
      let query = supabase
        .from("files")
        .select("*")
        .eq("company_id", company!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      query = folderId ? query.eq("folder_id", folderId) : query.is("folder_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as FileObject[];
    },
  });
}

export function useFile(fileId: string | undefined) {
  return useQuery({
    queryKey: ["file", fileId],
    enabled: !!fileId,
    queryFn: async () => {
      const { data, error } = await supabase.from("files").select("*").eq("id", fileId!).single();
      if (error) throw error;
      return data as FileObject;
    },
  });
}

/** Overwrites a file's content in place (same storage path) — the save
 * path for in-app editing of an uploaded Word/Excel file. Requires the
 * "uploader or managers update company-files objects" storage policy
 * (0025_file_content_editing.sql); the bucket only allowed insert before. */
export function useReplaceFileContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, blob }: { file: FileObject; blob: Blob }) => {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .update(file.storage_path, blob, { upsert: true, contentType: blob.type || file.mime_type || undefined });
      if (uploadError) throw uploadError;

      const { error } = await supabase
        .from("files")
        .update({ file_size: blob.size, version: file.version + 1 })
        .eq("id", file.id);
      if (error) throw error;
    },
    onSuccess: (_d, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["file", variables.file.id] });
      void queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
}

export function useUploadFile(folderId: string | null) {
  const { company } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) throw new Error(validationError);

      // Soft pre-check so an over-quota upload fails fast with a plain
      // message instead of only after the bytes are already in Storage
      // and the DB trigger (check_storage_quota, the real enforcement
      // boundary) rejects the row.
      const { data: usage } = await supabase
        .from("company_storage_usage")
        .select("used_bytes")
        .eq("company_id", company!.id)
        .maybeSingle();
      const used = usage?.used_bytes ?? 0;
      const quota = company!.storage_quota_bytes;
      if (used + file.size > quota) {
        throw new Error(
          `This upload would exceed your storage quota (${formatBytes(used)} of ${formatBytes(quota)} used, ${formatBytes(file.size)} needed).`
        );
      }

      const safeName = sanitizeFileName(file.name);
      const storagePath = `${company!.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file);
      if (uploadError) throw uploadError;

      const { error } = await supabase.from("files").insert({
        company_id: company!.id,
        folder_id: folderId,
        name: safeName,
        storage_path: storagePath,
        file_size: file.size,
        mime_type: file.type || null,
        extension: safeName.split(".").pop() ?? null,
        uploaded_by: user!.id,
      });
      if (error) {
        // The upload already landed in Storage; don't leave an orphaned
        // object behind if the `files` row insert is rejected (e.g. the
        // storage-quota trigger, SEC-23/FUNC-03).
        await supabase.storage.from(BUCKET).remove([storagePath]);
        throw error;
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["files", company?.id] }),
  });
}

export function useDeleteFile() {
  const { company } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: FileObject) => {
      // Delete the DB row first, and check that a row actually came
      // back: RLS silently filters an unauthorized DELETE to zero rows
      // rather than erroring, so `error` alone can't tell an "unauthorized"
      // delete from a real one. Only remove the storage object once the
      // row delete is confirmed — otherwise a member without delete
      // rights could permanently destroy the file's bytes (storage
      // policy is scoped to company membership) while the `files` row,
      // now pointing at nothing, silently survives.
      const { data, error } = await supabase.from("files").delete().eq("id", file.id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("You don't have permission to delete this file.");
      }
      await supabase.storage.from(BUCKET).remove([file.storage_path]);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["files", company?.id] }),
  });
}

export async function getFileDownloadUrl(storagePath: string, expiresInSeconds = 60) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
