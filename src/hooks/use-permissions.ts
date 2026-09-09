import { useWorkspace } from "@/hooks/use-workspace";
import { can, hasMinRole, type Action, type Resource } from "@/lib/permissions";
import type { CompanyRole } from "@/types/database";

export function usePermissions() {
  const { membership } = useWorkspace();
  const role = membership?.role;

  return {
    role,
    can: (resource: Resource, action: Action) => can(role, resource, action),
    hasMinRole: (minRole: CompanyRole) => hasMinRole(role, minRole),
  };
}
