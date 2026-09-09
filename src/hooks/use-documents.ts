import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import type { Document } from "@/types/database";

export function useDocuments(folderId: string | null) {
  const { company } = useWorkspace();
  return useQuery({
    queryKey: ["documents", company?.id, folderId],
    enabled: !!company,
    queryFn: async () => {
      let query = supabase
        .from("documents")
        .select("*")
        .eq("company_id", company!.id)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false });
      query = folderId ? query.eq("folder_id", folderId) : query.is("folder_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Document[];
    },
  });
}

export function useDocument(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("*").eq("id", documentId!).single();
      if (error) throw error;
      return data as Document;
    },
  });
}

export function useCreateDocument() {
  const { company } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ folderId, title }: { folderId?: string | null; title?: string }) => {
      const { data, error } = await supabase
        .from("documents")
        .insert({
          company_id: company!.id,
          folder_id: folderId ?? null,
          title: title ?? "Untitled",
          created_by: user!.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Document;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["documents", company?.id] }),
  });
}

export function useUpdateDocument() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Document> & { id: string }) => {
      const { error } = await supabase
        .from("documents")
        .update({ ...patch, updated_by: user!.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["document", variables.id] });
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}
