import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import type { FileAccessLevel, Folder, FolderModule, FolderShare, ItemVisibility } from "@/types/database";

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

export function useFolderShares(folderId: string | undefined) {
  return useQuery({
    queryKey: ["folder-shares", folderId],
    enabled: !!folderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folder_shares")
        .select("*, member:company_members(*, profile:profiles!company_members_user_id_fkey(*))")
        .eq("folder_id", folderId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FolderShare[];
    },
  });
}

export function useUpdateFolderVisibility(module: FolderModule) {
  const { company } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ folderId, visibility }: { folderId: string; visibility: ItemVisibility }) => {
      const { data, error } = await supabase.from("folders").update({ visibility }).eq("id", folderId).select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("You don't have permission to change this folder's access.");
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["folders", company?.id, module] }),
  });
}

export function useShareFolder(folderId: string) {
  const { company } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, accessLevel }: { email: string; accessLevel: FileAccessLevel }) => {
      const normalizedEmail = email.trim().toLowerCase();
      const { data: targetProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!targetProfile) {
        throw new Error("No one with that email is a member of this company.");
      }

      const { data: member, error: memberError } = await supabase
        .from("company_members")
        .select("id")
        .eq("company_id", company!.id)
        .eq("user_id", targetProfile.id)
        .eq("status", "active")
        .maybeSingle();
      if (memberError) throw memberError;
      if (!member) {
        throw new Error("No one with that email is a member of this company.");
      }

      const { error } = await supabase.from("folder_shares").upsert(
        {
          folder_id: folderId,
          member_id: member.id,
          access_level: accessLevel,
          created_by: user!.id,
        },
        { onConflict: "folder_id,member_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["folder-shares", folderId] }),
  });
}

export function useRevokeFolderShare(folderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (shareId: string) => {
      const { data, error } = await supabase.from("folder_shares").delete().eq("id", shareId).select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("You don't have permission to revoke this share.");
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["folder-shares", folderId] }),
  });
}
