import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/providers/auth-provider";
import { QueryProvider } from "@/providers/query-provider";
import { WorkspaceProvider } from "@/providers/workspace-provider";
import { RequireAuth } from "@/routes/require-auth";
import { WorkspaceLayout } from "@/components/layout/workspace-layout";
import { LandingPage } from "@/pages/landing";
import { LoginPage } from "@/pages/auth/login";
import { SignupPage } from "@/pages/auth/signup";
import { WorkspacePicker } from "@/pages/onboarding/workspace-picker";
import { CreateWorkspacePage } from "@/pages/onboarding/create-workspace";
import { DashboardPage } from "@/pages/dashboard/dashboard-page";
import { TasksPage } from "@/pages/tasks/tasks-page";
import { ProjectsPage } from "@/pages/projects/projects-page";
import { ProjectDetailPage } from "@/pages/projects/project-detail-page";
import { DocumentsPage } from "@/pages/documents/documents-page";
import { DocumentEditorPage } from "@/pages/documents/document-editor-page";
import { FilesPage } from "@/pages/files/files-page";
import { ChatPage } from "@/pages/chat/chat-page";
import { WhiteboardsPage } from "@/pages/whiteboards/whiteboards-page";
import { WhiteboardEditorPage } from "@/pages/whiteboards/whiteboard-editor-page";
import { KnowledgePage } from "@/pages/knowledge/knowledge-page";
import { KnowledgeArticlePage } from "@/pages/knowledge/knowledge-article-page";
import { NotificationsPage } from "@/pages/notifications/notifications-page";
import { SearchPage } from "@/pages/search/search-page";
import { SettingsLayout } from "@/pages/settings/settings-layout";
import { GeneralSettingsPage } from "@/pages/settings/general-settings-page";
import { MembersSettingsPage } from "@/pages/settings/members-settings-page";
import { BillingSettingsPage } from "@/pages/settings/billing-settings-page";
import { SecuritySettingsPage } from "@/pages/settings/security-settings-page";

export default function App() {
  return (
    <QueryProvider>
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider delayDuration={200}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />

              <Route element={<RequireAuth />}>
                <Route path="/workspaces" element={<WorkspacePicker />} />
                <Route path="/workspaces/new" element={<CreateWorkspacePage />} />

                <Route
                  path="/w/:slug"
                  element={
                    <WorkspaceProvider>
                      <WorkspaceLayout />
                    </WorkspaceProvider>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="tasks" element={<TasksPage />} />
                  <Route path="projects" element={<ProjectsPage />} />
                  <Route path="projects/:projectId" element={<ProjectDetailPage />} />
                  <Route path="documents" element={<DocumentsPage />} />
                  <Route path="documents/:documentId" element={<DocumentEditorPage />} />
                  <Route path="files" element={<FilesPage />} />
                  <Route path="chat" element={<ChatPage />} />
                  <Route path="chat/:channelId" element={<ChatPage />} />
                  <Route path="whiteboards" element={<WhiteboardsPage />} />
                  <Route path="whiteboards/:whiteboardId" element={<WhiteboardEditorPage />} />
                  <Route path="knowledge" element={<KnowledgePage />} />
                  <Route path="knowledge/:articleId" element={<KnowledgeArticlePage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="search" element={<SearchPage />} />
                  <Route path="settings" element={<SettingsLayout />}>
                    <Route index element={<Navigate to="general" replace />} />
                    <Route path="general" element={<GeneralSettingsPage />} />
                    <Route path="members" element={<MembersSettingsPage />} />
                    <Route path="billing" element={<BillingSettingsPage />} />
                    <Route path="security" element={<SecuritySettingsPage />} />
                  </Route>
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </TooltipProvider>
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </QueryProvider>
  );
}
