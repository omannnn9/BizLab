import { useState } from "react";
import { Globe, Lock, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCompanyMembers } from "@/hooks/use-members";
import {
  useDocumentPermissions,
  useRevokeDocumentShare,
  useShareDocument,
  useUpdateDocument,
} from "@/hooks/use-documents";
import type { CompanyRole, Document, DocAccessLevel } from "@/types/database";
import { ROLE_LABELS } from "@/lib/permissions";

const ACCESS_LEVELS: DocAccessLevel[] = ["view", "comment", "edit", "full_control"];
const ROLES: CompanyRole[] = ["owner", "admin", "manager", "employee", "guest"];

export function ShareDialog({
  document,
  open,
  onOpenChange,
}: {
  document: Document;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: members } = useCompanyMembers();
  const { data: permissions } = useDocumentPermissions(document.id);
  const shareDocument = useShareDocument(document.id);
  const revokeShare = useRevokeDocumentShare(document.id);
  const updateDocument = useUpdateDocument();

  const [pickedMemberId, setPickedMemberId] = useState<string>("");
  const [pickedRole, setPickedRole] = useState<CompanyRole>("employee");
  const [bulkAccessLevel, setBulkAccessLevel] = useState<DocAccessLevel>("view");

  const sharedMemberIds = new Set((permissions ?? []).map((p) => p.member_id));
  const shareableMembers = members?.filter((m) => !sharedMemberIds.has(m.id)) ?? [];

  async function shareWithRole() {
    const targets = members?.filter((m) => m.role === pickedRole) ?? [];
    for (const m of targets) {
      await shareDocument.mutateAsync({ memberId: m.id, accessLevel: bulkAccessLevel });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share "{document.title}"</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="flex items-center gap-2 text-sm">
              {document.visibility === "company" ? (
                <Globe className="size-4 text-muted-foreground" />
              ) : (
                <Lock className="size-4 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">
                  {document.visibility === "company" ? "Everyone in the workspace" : "Restricted"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {document.visibility === "company"
                    ? "Any member can access this at the level below"
                    : "Only people listed below can access it"}
                </p>
              </div>
            </div>
            <Select
              value={document.visibility}
              onValueChange={(v) => updateDocument.mutate({ id: document.id, visibility: v as Document["visibility"] })}
            >
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="company">Team</SelectItem>
                <SelectItem value="restricted">Restricted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {document.visibility === "company" && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Default access level</span>
              <Select
                value={document.default_access_level}
                onValueChange={(v) =>
                  updateDocument.mutate({ id: document.id, default_access_level: v as DocAccessLevel })
                }
              >
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCESS_LEVELS.map((lvl) => (
                    <SelectItem key={lvl} value={lvl} className="capitalize">{lvl.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Share with a person</p>
            <div className="flex gap-2">
              <Select value={pickedMemberId} onValueChange={setPickedMemberId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Choose a person" /></SelectTrigger>
                <SelectContent>
                  {shareableMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.profile?.full_name ?? m.profile?.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={!pickedMemberId}
                onClick={async () => {
                  await shareDocument.mutateAsync({ memberId: pickedMemberId, accessLevel: "edit" });
                  setPickedMemberId("");
                }}
              >
                Add
              </Button>
            </div>

            <p className="mt-1 text-xs font-medium text-muted-foreground">Share with a whole role</p>
            <div className="flex gap-2">
              <Select value={pickedRole} onValueChange={(v) => setPickedRole(v as CompanyRole)}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={bulkAccessLevel} onValueChange={(v) => setBulkAccessLevel(v as DocAccessLevel)}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCESS_LEVELS.map((lvl) => (
                    <SelectItem key={lvl} value={lvl} className="capitalize">{lvl.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={shareWithRole}>Add</Button>
            </div>
          </div>

          {permissions && permissions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">People with access</p>
              {permissions.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-md px-1 py-1">
                  <Avatar className="size-6">
                    <AvatarFallback className="text-[10px]">
                      {(p.member?.profile?.full_name ?? p.member?.profile?.email ?? "?")[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-sm">
                    {p.member?.profile?.full_name ?? p.member?.profile?.email}
                  </span>
                  <Select
                    value={p.access_level}
                    onValueChange={(v) =>
                      shareDocument.mutate({ memberId: p.member_id, accessLevel: v as DocAccessLevel })
                    }
                  >
                    <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACCESS_LEVELS.map((lvl) => (
                        <SelectItem key={lvl} value={lvl} className="capitalize">{lvl.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="size-6" onClick={() => revokeShare.mutate(p.id)}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
