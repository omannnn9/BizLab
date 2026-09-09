import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

export function useDocumentComments(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document-comments", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_comments")
        .select("*, author:profiles(*)")
        .eq("document_id", documentId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddDocumentComment(documentId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase
        .from("document_comments")
        .insert({ document_id: documentId!, author_id: user!.id, body });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["document-comments", documentId] }),
  });
}
