import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { emptyRichContent } from "@/lib/tiptap-content";
import type { Document, DocAccessLevel, Profile } from "@/types/database";

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
        .is("parent_document_id", null)
        .order("updated_at", { ascending: false });
      query = folderId ? query.eq("folder_id", folderId) : query.is("folder_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Document[];
    },
  });
}

export function useTemplates() {
  const { company } = useWorkspace();
  return useQuery({
    queryKey: ["document-templates", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("company_id", company!.id)
        .eq("is_template", true)
        .order("title", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Document[];
    },
  });
}

export function useChildDocuments(parentDocumentId: string | undefined) {
  return useQuery({
    queryKey: ["child-documents", parentDocumentId],
    enabled: !!parentDocumentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("parent_document_id", parentDocumentId!)
        .eq("is_archived", false)
        .order("title", { ascending: true });
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

/** The viewer's own effective access to a document, via the same
 * `document_access_level()` function the RLS policies use — lets the
 * UI hide sharing controls for anyone below full_control instead of
 * showing a Share button whose Add/Revoke actions RLS silently rejects. */
export function useMyDocumentAccessLevel(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document-access-level", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("document_access_level", { p_document_id: documentId! });
      if (error) throw error;
      return data as DocAccessLevel | null;
    },
  });
}

export function useCreateDocument() {
  const { company } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      folderId?: string | null;
      title?: string;
      parentDocumentId?: string | null;
      fromTemplate?: Document;
    }) => {
      const { data, error } = await supabase
        .from("documents")
        .insert({
          company_id: company!.id,
          folder_id: input.folderId ?? null,
          parent_document_id: input.parentDocumentId ?? null,
          title: input.fromTemplate?.title ?? input.title ?? "Untitled",
          content: input.fromTemplate?.content ?? emptyRichContent(),
          created_by: user!.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Document;
    },
    onSuccess: (_d, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["documents", company?.id] });
      if (variables.parentDocumentId) {
        void queryClient.invalidateQueries({ queryKey: ["child-documents", variables.parentDocumentId] });
      }
    },
  });
}

/** Lightweight metadata patch (folder, visibility, defaults, archive,
 * template flag). Content changes always go through save_document_version
 * so the version trail and current_version stay consistent — see
 * useSaveDocumentVersion. */
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

export function useSaveDocumentVersion(documentId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ title, content }: { title: string; content: unknown }) => {
      const { data, error } = await supabase.rpc("save_document_version", {
        p_document_id: documentId!,
        p_title: title,
        p_content: content,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
      void queryClient.invalidateQueries({ queryKey: ["document-versions", documentId] });
    },
  });
}

export interface DocumentVersionSummary {
  id: string;
  version_number: number;
  title: string;
  created_at: string;
  created_by: string;
  author: Profile | null;
}

export function useDocumentVersions(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document-versions", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_versions")
        .select("id, version_number, title, created_at, created_by, author:profiles(*)")
        .eq("document_id", documentId!)
        .order("version_number", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DocumentVersionSummary[];
    },
  });
}

export function useRestoreDocumentVersion(documentId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (versionNumber: number) => {
      const { error } = await supabase.rpc("restore_document_version", {
        p_document_id: documentId!,
        p_version_number: versionNumber,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document", documentId] });
      void queryClient.invalidateQueries({ queryKey: ["document-versions", documentId] });
    },
  });
}

export function useDocumentPermissions(documentId: string | undefined) {
  return useQuery({
    queryKey: ["document-permissions", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_permissions")
        // Same company_members-has-two-FKs-to-profiles ambiguity as
        // useTasks/useCompanyMembers — without naming the constraint this
        // errors on every call instead of listing anyone.
        .select("*, member:company_members(*, profile:profiles!company_members_user_id_fkey(*))")
        .eq("document_id", documentId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useShareDocument(documentId: string | undefined) {
  const { user } = useAuth();
  const { company } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberId, accessLevel }: { memberId: string; accessLevel: DocAccessLevel }) => {
      const { error } = await supabase
        .from("document_permissions")
        .upsert(
          { document_id: documentId!, member_id: memberId, access_level: accessLevel, granted_by: user!.id },
          { onConflict: "document_id,member_id" }
        );
      if (error) throw error;
      await supabase.rpc("log_audit_event", {
        p_company_id: company!.id,
        p_action: "document.shared",
        p_target_type: "document",
        p_target_id: documentId,
        p_metadata: { member_id: memberId, access_level: accessLevel },
      });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["document-permissions", documentId] }),
  });
}

export function useRevokeDocumentShare(documentId: string | undefined) {
  const { company } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (permissionId: string) => {
      const { data, error } = await supabase.from("document_permissions").delete().eq("id", permissionId).select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("You don't have permission to revoke this share.");
      }
      await supabase.rpc("log_audit_event", {
        p_company_id: company!.id,
        p_action: "document.share_revoked",
        p_target_type: "document",
        p_target_id: documentId,
      });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["document-permissions", documentId] }),
  });
}
