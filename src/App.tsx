import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/providers/auth-provider";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { WorkspaceProvider } from "@/providers/workspace-provider";
import { RequireAuth } from "@/routes/require-auth";
import { MfaGuard } from "@/routes/mfa-guard";
import { WorkspaceLayout } from "@/components/layout/workspace-layout";
import { HomePage } from "@/pages/home";
import { LoginPage } from "@/pages/auth/login";
import { ForgotPasswordPage } from "@/pages/auth/forgot-password";
import { ResetPasswordPage } from "@/pages/auth/reset-password";
import { AcceptInvitePage } from "@/pages/auth/accept-invite";
import { WorkspacePicker } from "@/pages/onboarding/workspace-picker";

// Route-level code splitting: everything behind the workspace shell is
// lazy-loaded. These pages (rich editors, the kanban board) accounted
// for most of the original 811 KB single bundle; auth/onboarding stay
// eager since they're the actual first paint for a signed-out visitor
// and are small on their own.
const WorkspaceHomePage = lazy(() => import("@/pages/dashboard/home-page").then((m) => ({ default: m.HomePage })));
const MyWorkPage = lazy(() => import("@/pages/dashboard/my-work-page").then((m) => ({ default: m.MyWorkPage })));
const CompaniesPage = lazy(() => import("@/pages/dashboard/companies-page").then((m) => ({ default: m.CompaniesPage })));
const CommandCenterPage = lazy(() =>
  import("@/pages/dashboard/command-center-page").then((m) => ({ default: m.CommandCenterPage }))
);
const TasksPage = lazy(() => import("@/pages/tasks/tasks-page").then((m) => ({ default: m.TasksPage })));
const ProjectsPage = lazy(() => import("@/pages/projects/projects-page").then((m) => ({ default: m.ProjectsPage })));
const ProjectDetailPage = lazy(() =>
  import("@/pages/projects/project-detail-page").then((m) => ({ default: m.ProjectDetailPage }))
);
const DocumentsPage = lazy(() => import("@/pages/documents/documents-page").then((m) => ({ default: m.DocumentsPage })));
const DocumentEditorPage = lazy(() =>
  import("@/pages/documents/document-editor-page").then((m) => ({ default: m.DocumentEditorPage }))
);
const FilesPage = lazy(() => import("@/pages/files/files-page").then((m) => ({ default: m.FilesPage })));
const FileEditorPage = lazy(() => import("@/pages/files/file-editor-page").then((m) => ({ default: m.FileEditorPage })));
const ChatPage = lazy(() => import("@/pages/chat/chat-page").then((m) => ({ default: m.ChatPage })));
const KnowledgePage = lazy(() => import("@/pages/knowledge/knowledge-page").then((m) => ({ default: m.KnowledgePage })));
const KnowledgeArticlePage = lazy(() =>
  import("@/pages/knowledge/knowledge-article-page").then((m) => ({ default: m.KnowledgeArticlePage }))
);
const NotificationsPage = lazy(() =>
  import("@/pages/notifications/notifications-page").then((m) => ({ default: m.NotificationsPage }))
);
const SearchPage = lazy(() => import("@/pages/search/search-page").then((m) => ({ default: m.SearchPage })));
const SettingsLayout = lazy(() => import("@/pages/settings/settings-layout").then((m) => ({ default: m.SettingsLayout })));
const GeneralSettingsPage = lazy(() =>
  import("@/pages/settings/general-settings-page").then((m) => ({ default: m.GeneralSettingsPage }))
);
const MembersSettingsPage = lazy(() =>
  import("@/pages/settings/members-settings-page").then((m) => ({ default: m.MembersSettingsPage }))
);
const SecuritySettingsPage = lazy(() =>
  import("@/pages/settings/security-settings-page").then((m) => ({ default: m.SecuritySettingsPage }))
);
const AdministrationPage = lazy(() =>
  import("@/pages/settings/administration-page").then((m) => ({ default: m.AdministrationPage }))
);

function RouteFallback() {
  return (
    <div className="flex h-full min-h-64 w-full items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <BrowserRouter>
          <AuthProvider>
            <TooltipProvider delayDuration={200}>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<Navigate to="/login" replace />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/accept-invite" element={<AcceptInvitePage />} />

                  <Route element={<RequireAuth />}>
                    <Route element={<MfaGuard />}>
                      <Route path="/workspaces" element={<WorkspacePicker />} />

                      <Route
                        path="/w/:slug"
                        element={
                          <WorkspaceProvider>
                            <WorkspaceLayout />
                          </WorkspaceProvider>
                        }
                      >
                        <Route index element={<WorkspaceHomePage />} />
                        <Route path="my-work" element={<MyWorkPage />} />
                        <Route path="companies" element={<CompaniesPage />} />
                        <Route path="command-center" element={<CommandCenterPage />} />
                        {/* Dashboards was folded into Home — redirect old bookmarks/links instead of 404ing. */}
                        <Route path="dashboards" element={<Navigate to=".." replace />} />
                        <Route path="tasks" element={<TasksPage />} />
                        <Route path="projects" element={<ProjectsPage />} />
                        <Route path="projects/:projectId" element={<ProjectDetailPage />} />
                        <Route path="documents" element={<DocumentsPage />} />
                        <Route path="documents/:documentId" element={<DocumentEditorPage />} />
                        <Route path="files" element={<FilesPage />} />
                        <Route path="files/:fileId" element={<FileEditorPage />} />
                        <Route path="chat" element={<ChatPage />} />
                        <Route path="chat/:channelId" element={<ChatPage />} />
                        <Route path="knowledge" element={<KnowledgePage />} />
                        <Route path="knowledge/:articleId" element={<KnowledgeArticlePage />} />
                        <Route path="notifications" element={<NotificationsPage />} />
                        <Route path="search" element={<SearchPage />} />
                        <Route path="settings" element={<SettingsLayout />}>
                          <Route index element={<Navigate to="general" replace />} />
                          <Route path="general" element={<GeneralSettingsPage />} />
                          <Route path="members" element={<MembersSettingsPage />} />
                          <Route path="security" element={<SecuritySettingsPage />} />
                          <Route path="administration" element={<AdministrationPage />} />
                        </Route>
                      </Route>
                    </Route>
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </TooltipProvider>
            <Toaster position="top-right" richColors />
          </AuthProvider>
        </BrowserRouter>
      </QueryProvider>
    </ThemeProvider>
  );
}
