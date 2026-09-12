import type { CompanyRole } from "@/types/database";

/**
 * Client-side mirror of the RBAC model enforced by Postgres RLS
 * (supabase/migrations/0002_core_tenancy.sql: role_rank / has_min_role).
 * This file is UX-only — hiding/disabling controls the server would
 * reject anyway. Never trust it as the security boundary.
 */

export const ROLE_RANK: Record<CompanyRole, number> = {
  guest: 1,
  employee: 2,
  manager: 3,
  admin: 4,
  owner: 5,
};

export const ROLE_LABELS: Record<CompanyRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
  guest: "Guest",
};

export const ROLE_DESCRIPTIONS: Record<CompanyRole, string> = {
  owner: "Full access to everything, including billing and company deletion.",
  admin: "Manages workspace settings, members, and permissions.",
  manager: "Manages projects, teams, and approves knowledge base content.",
  employee: "Standard access to assigned projects, tasks, and shared content.",
  guest: "Restricted access — limited to explicitly shared items.",
};

export function hasMinRole(role: CompanyRole | undefined, minRole: CompanyRole): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

export type Resource =
  | "workspace_settings"
  | "billing"
  | "members"
  | "projects"
  | "tasks"
  | "documents"
  | "files"
  | "chat"
  | "whiteboards"
  | "dashboards"
  | "knowledge_hub"
  | "crm"
  | "hr"
  | "finance"
  | "audit_logs";

export type Action = "view" | "create" | "edit" | "delete" | "manage";

/** Minimum role required for each (resource, action) pair. */
export const PERMISSION_MATRIX: Record<Resource, Partial<Record<Action, CompanyRole>>> = {
  workspace_settings: { view: "employee", edit: "admin", manage: "owner" },
  billing: { view: "admin", manage: "owner" },
  members: { view: "employee", create: "admin", edit: "admin", delete: "admin" },
  projects: { view: "employee", create: "manager", edit: "manager", delete: "admin" },
  tasks: { view: "employee", create: "employee", edit: "employee", delete: "manager" },
  documents: { view: "employee", create: "employee", edit: "employee", delete: "manager" },
  files: { view: "employee", create: "employee", edit: "employee", delete: "employee" },
  chat: { view: "employee", create: "employee" },
  whiteboards: { view: "employee", create: "employee", delete: "manager" },
  dashboards: { view: "employee", create: "employee", manage: "manager" },
  knowledge_hub: { view: "employee", create: "manager", edit: "manager", delete: "admin" },
  crm: { view: "employee", create: "employee", edit: "employee", delete: "manager" },
  hr: { view: "employee", create: "manager", edit: "manager", delete: "admin" },
  finance: { view: "manager", create: "manager", edit: "manager", delete: "admin" },
  audit_logs: { view: "admin" },
};

export function can(role: CompanyRole | undefined, resource: Resource, action: Action): boolean {
  const required = PERMISSION_MATRIX[resource][action];
  if (!required) return false;
  return hasMinRole(role, required);
}
