import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUpdateCompany } from "@/hooks/use-companies";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";

export function GeneralSettingsPage() {
  const { company } = useWorkspace();
  const { can } = usePermissions();
  const updateCompany = useUpdateCompany();
  const canEdit = can("workspace_settings", "edit");

  const [name, setName] = useState(company?.name ?? "");
  const [industry, setIndustry] = useState(company?.industry ?? "");
  const [website, setWebsite] = useState(company?.website ?? "");

  useEffect(() => {
    setName(company?.name ?? "");
    setIndustry(company?.industry ?? "");
    setWebsite(company?.website ?? "");
  }, [company]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;
    try {
      await updateCompany.mutateAsync({ id: company.id, name, industry, website });
      toast.success("Workspace updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update workspace");
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Company profile</CardTitle>
        <CardDescription>Basic information about your workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Company name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="industry">Industry</Label>
            <Input id="industry" value={industry ?? ""} onChange={(e) => setIndustry(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="website">Website</Label>
            <Input id="website" value={website ?? ""} onChange={(e) => setWebsite(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Workspace URL</Label>
            <Input value={`bizlab.app/w/${company?.slug}`} disabled />
          </div>
          {canEdit && (
            <Button type="submit" className="w-fit" disabled={updateCompany.isPending}>
              {updateCompany.isPending && <Loader2 className="animate-spin" />}
              Save changes
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
