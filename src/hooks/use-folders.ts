import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import type { Folder, FolderModule } from "@/types/database";

export function useFolders(module: FolderModule) {
  const { company } = useWorkspace();
  return useQuery({
    queryKey: ["folders", company?.id, module],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folders")
        .select("*")
        .eq("company_id", company!.id)
        .eq("module", module)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Folder[];
    },
  });
}

export function useCreateFolder(module: FolderModule) {
  const { company } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, parentFolderId }: { name: string; parentFolderId?: string | null }) => {
      const { error } = await supabase.from("folders").insert({
        company_id: company!.id,
        module,
        name,
        parent_folder_id: parentFolderId ?? null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["folders", company?.id, module] }),
  });
}
