/**
 * Hand-written domain types mirroring supabase/migrations/*.sql.
 *
 * Once a live Supabase project is linked, replace this file with the
 * generated one: `supabase gen types typescript --linked > src/types/database.ts`
 * (see mcp__Supabase__generate_typescript_types). Field names/shapes here
 * are kept 1:1 with the SQL so that swap is a drop-in replacement.
 */

export type CompanyRole = "owner" | "admin" | "manager" | "employee" | "guest";
export type MemberStatus = "invited" | "active" | "suspended" | "removed";

export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "archived";
export type TaskStatus = "backlog" | "todo" | "in_progress" | "in_review" | "done" | "cancelled";
export type TaskPriority = "none" | "low" | "medium" | "high" | "urgent";
export type MilestoneStatus = "upcoming" | "in_progress" | "completed" | "missed";

export type FolderModule = "documents" | "files";
export type DocAccessLevel = "view" | "comment" | "edit" | "full_control";
export type DocVisibility = "company" | "restricted";

export type FileAccessLevel = "view" | "edit";

export type ChannelType = "public" | "private" | "direct" | "group";

export type WidgetType =
  | "task_completion"
  | "team_productivity"
  | "upcoming_deadlines"
  | "storage_usage"
  | "recent_activity"
  | "projects_overview"
  | "my_tasks"
  | "channel_activity"
  | "revenue_metrics";

export type KnowledgeCategory =
  | "sop"
  | "policy"
  | "process"
  | "training"
  | "onboarding"
  | "general";

export type NotificationType =
  | "task_assigned"
  | "task_due_soon"
  | "mentioned"
  | "document_updated"
  | "document_shared"
  | "file_shared"
  | "chat_message"
  | "project_updated"
  | "comment_added"
  | "invitation_received"
  | "member_joined";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete";
export type BillingInterval = "monthly" | "annual";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string;
  phone: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  industry: string | null;
  company_size: string | null;
  website: string | null;
  billing_email: string | null;
  security_settings: {
    require_mfa: boolean;
    session_timeout_minutes: number;
    allowed_ip_ranges: string[];
    sso_enabled: boolean;
  };
  storage_quota_bytes: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: CompanyRole;
  status: MemberStatus;
  title: string | null;
  department: string | null;
  invited_by: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface CompanyInvitation {
  id: string;
  company_id: string;
  email: string;
  role: CompanyRole;
  token: string;
  invited_by: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
}

export interface Project {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  color: string;
  icon: string | null;
  owner_id: string | null;
  start_date: string | null;
  due_date: string | null;
  is_archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: MilestoneStatus;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  company_id: string;
  project_id: string | null;
  milestone_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  recurrence_rule: Record<string, unknown> | null;
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignees?: CompanyMember[];
  project?: Pick<Project, "id" | "name" | "color"> | null;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  mentions: string[];
  created_at: string;
  updated_at: string;
  author?: Profile;
}

export interface Folder {
  id: string;
  company_id: string;
  module: FolderModule;
  parent_folder_id: string | null;
  name: string;
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  company_id: string;
  folder_id: string | null;
  parent_document_id: string | null;
  is_template: boolean;
  title: string;
  icon: string | null;
  cover_image_url: string | null;
  content: Record<string, unknown>;
  visibility: DocVisibility;
  default_access_level: DocAccessLevel;
  is_archived: boolean;
  current_version: number;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FileObject {
  id: string;
  company_id: string;
  folder_id: string | null;
  name: string;
  storage_path: string;
  file_size: number;
  mime_type: string | null;
  extension: string | null;
  version: number;
  description: string | null;
  uploaded_by: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatChannel {
  id: string;
  company_id: string;
  name: string | null;
  description: string | null;
  type: ChannelType;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  author_id: string;
  body: string | null;
  attachments: { name: string; storage_path: string; size: number; mime_type: string }[];
  parent_message_id: string | null;
  mentions: string[];
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  author?: Profile;
}

export interface Whiteboard {
  id: string;
  company_id: string;
  project_id: string | null;
  name: string;
  thumbnail_url: string | null;
  canvas_data: { elements: unknown[]; appState: Record<string, unknown> };
  is_archived: boolean;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Dashboard {
  id: string;
  company_id: string;
  name: string;
  is_default: boolean;
  owner_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardWidget {
  id: string;
  dashboard_id: string;
  widget_type: WidgetType;
  title: string | null;
  config: Record<string, unknown>;
  layout: { x: number; y: number; w: number; h: number };
  created_at: string;
}

export interface KnowledgeArticle {
  id: string;
  company_id: string;
  category: KnowledgeCategory;
  title: string;
  content: Record<string, unknown>;
  tags: string[];
  is_published: boolean;
  view_count: number;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  company_id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  actor?: Profile;
}

export interface ActivityLog {
  id: string;
  company_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor?: Profile;
}

export interface SubscriptionPlan {
  id: string;
  key: "free" | "starter" | "business" | "enterprise";
  name: string;
  description: string | null;
  price_monthly_cents: number;
  price_annual_cents: number;
  max_members: number | null;
  storage_quota_bytes: number;
  features: Record<string, unknown>;
  is_active: boolean;
  position: number;
}

export interface CompanySubscription {
  id: string;
  company_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  billing_interval: BillingInterval;
  seats: number;
  trial_ends_at: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  plan?: SubscriptionPlan;
}

export interface GlobalSearchResult {
  result_type:
    | "task"
    | "project"
    | "document"
    | "file"
    | "chat_message"
    | "knowledge_article"
    | "user";
  id: string;
  title: string;
  snippet: string;
  url_path: string;
  rank: number;
}
