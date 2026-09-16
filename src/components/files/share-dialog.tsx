import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { CompanyMember, FileAccessLevel, ItemVisibility } from "@/types/database";

interface ShareEntry {
  id: string;
  access_level: FileAccessLevel;
  member?: CompanyMember | null;
}

/** Google-Drive-style access UI, shared between files and folders — same
 * visibility toggle + add-by-email + grant list, driven entirely by
 * props so it stays agnostic of which table/hooks it's backed by. */
export function ShareDialog({
  open,
  onOpenChange,
  itemName,
  itemKind,
  visibility,
  onUpdateVisibility,
  updatingVisibility,
  shares,
  sharesLoading,
  onShare,
  sharing,
  onRevoke,
  revokingId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  itemKind: "file" | "folder";
  visibility: ItemVisibility;
  onUpdateVisibility: (v: ItemVisibility) => void;
  updatingVisibility: boolean;
  shares: ShareEntry[];
  sharesLoading: boolean;
  onShare: (email: string, accessLevel: FileAccessLevel) => Promise<void>;
  sharing: boolean;
  onRevoke: (shareId: string) => void;
  revokingId: string | null;
}) {
  const [email, setEmail] = useState("");
  const [accessLevel, setAccessLevel] = useState<FileAccessLevel>("view");

  async function handleShare(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await onShare(email, accessLevel);
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not share this ${itemKind}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="truncate">Share "{itemName}"</DialogTitle>
          <DialogDescription>
            {itemKind === "folder"
              ? "Sharing this folder also grants access to everything inside it."
              : "Control who at the company can see this file."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {visibility === "company" ? "Everyone at the company" : "Restricted"}
              </p>
              <p className="text-xs text-muted-foreground">
                {visibility === "company"
                  ? "Any company member can view this."
                  : "Only people added below (and managers) can view this."}
              </p>
            </div>
            <Select
              value={visibility}
              onValueChange={(v) => onUpdateVisibility(v as ItemVisibility)}
              disabled={updatingVisibility}
            >
              <SelectTrigger size="sm" className="w-36 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company">Everyone</SelectItem>
                <SelectItem value="restricted">Restricted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {visibility === "restricted" && (
            <>
              <form onSubmit={(e) => void handleShare(e)} className="flex items-center gap-2">
                <Input
                  type="email"
                  placeholder="Add person by email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                />
                <Select value={accessLevel} onValueChange={(v) => setAccessLevel(v as FileAccessLevel)}>
                  <SelectTrigger size="sm" className="w-28 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">Can view</SelectItem>
                    <SelectItem value="edit">Can edit</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" size="sm" disabled={sharing || !email.trim()}>
                  {sharing && <Loader2 className="size-3.5 animate-spin" />}
                  Add
                </Button>
              </form>

              <div className="flex flex-col gap-1">
                {sharesLoading ? (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                ) : shares.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No one has been added yet.</p>
                ) : (
                  shares.map((share) => {
                    const profile = share.member?.profile;
                    return (
                      <div
                        key={share.id}
                        className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent/50"
                      >
                        <Avatar className="size-7 shrink-0">
                          <AvatarFallback className="text-[10px]">
                            {(profile?.full_name ?? "?")
                              .split(" ")
                              .map((p) => p[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{profile?.full_name ?? "Unknown"}</p>
                          <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {share.access_level === "edit" ? "Can edit" : "Can view"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 shrink-0"
                          onClick={() => onRevoke(share.id)}
                          disabled={revokingId === share.id}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
