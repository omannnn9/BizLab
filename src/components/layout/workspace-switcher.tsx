import { useNavigate } from "react-router-dom";
import { Building2, ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMyCompanies } from "@/hooks/use-companies";
import { useWorkspace } from "@/hooks/use-workspace";

export function WorkspaceSwitcher() {
  const { data: companies } = useMyCompanies();
  const { company } = useWorkspace();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent">
        <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Building2 className="size-3.5" />
        </div>
        <span className="max-w-40 truncate">{company?.name ?? "Workspace"}</span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Your workspaces</DropdownMenuLabel>
        {companies?.map((m) => (
          <DropdownMenuItem key={m.company_id} onClick={() => navigate(`/w/${m.company.slug}`)}>
            <Building2 />
            <span className="flex-1 truncate">{m.company.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/workspaces")}>
          <Plus />
          New workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
