import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import type { KnowledgeArticle, KnowledgeCategory } from "@/types/database";

export function useKnowledgeArticles(category?: KnowledgeCategory) {
  const { company } = useWorkspace();
  return useQuery({
    queryKey: ["knowledge-articles", company?.id, category ?? "all"],
    enabled: !!company,
    queryFn: async () => {
      let query = supabase
        .from("knowledge_articles")
        .select("*")
        .eq("company_id", company!.id)
        .order("updated_at", { ascending: false });
      if (category) query = query.eq("category", category);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as KnowledgeArticle[];
    },
  });
}

export function useKnowledgeArticle(id: string | undefined) {
  return useQuery({
    queryKey: ["knowledge-article", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("knowledge_articles").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as KnowledgeArticle;
    },
  });
}

export function useCreateKnowledgeArticle() {
  const { company } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, category }: { title: string; category: KnowledgeCategory }) => {
      const { data, error } = await supabase
        .from("knowledge_articles")
        .insert({ company_id: company!.id, title, category, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as KnowledgeArticle;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["knowledge-articles", company?.id] }),
  });
}

export function useDeleteKnowledgeArticle() {
  const { company } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("knowledge_articles").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("You don't have permission to delete this article.");
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["knowledge-articles", company?.id] }),
  });
}

export function useUpdateKnowledgeArticle() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<KnowledgeArticle> & { id: string }) => {
      const { error } = await supabase
        .from("knowledge_articles")
        .update({ ...patch, updated_by: user!.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-article", variables.id] });
      void queryClient.invalidateQueries({ queryKey: ["knowledge-articles"] });
    },
  });
}
