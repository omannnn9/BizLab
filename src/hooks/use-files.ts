import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { sanitizeFileName, validateFile } from "@/lib/file-policy";
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

export function useUploadFile(folderId: string | null) {
  const { company } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) throw new Error(validationError);

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
      await supabase.storage.from(BUCKET).remove([file.storage_path]);
      const { error } = await supabase.from("files").delete().eq("id", file.id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["files", company?.id] }),
  });
}

export async function getFileDownloadUrl(storagePath: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60);
  if (error) throw error;
  return data.signedUrl;
}
