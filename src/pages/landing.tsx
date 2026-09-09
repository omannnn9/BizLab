import { Link } from "react-router-dom";
import {
  CheckSquare,
  FileText,
  FolderOpen,
  LayoutDashboard,
  MessagesSquare,
  PenTool,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/shared/logo";

const modules = [
  { icon: CheckSquare, name: "Tasks & Projects", desc: "Kanban, lists, timelines & milestones." },
  { icon: FileText, name: "Documents", desc: "Real-time collaborative docs & wikis." },
  { icon: FolderOpen, name: "File Storage", desc: "Secure cloud storage with previews." },
  { icon: MessagesSquare, name: "Team Chat", desc: "Channels, DMs & group conversations." },
  { icon: PenTool, name: "Whiteboards", desc: "Infinite canvas for brainstorming." },
  { icon: LayoutDashboard, name: "Dashboards", desc: "Custom widgets for every team." },
  { icon: BookOpen, name: "Knowledge Hub", desc: "SOPs, policies & onboarding guides." },
];

export function LandingPage() {
  return (
    <div className="min-h-svh bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/signup">Get started free</Link>
          </Button>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-4xl px-6 pt-16 pb-20 text-center">
          <span className="mb-5 inline-block rounded-full border bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            The virtual operating system for modern businesses
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Your entire business, running in one elegant workspace.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground text-balance">
            Tasks, documents, files, chat, whiteboards, dashboards and your company's
            knowledge base — unified into a single, secure, multi-company platform.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/signup">Start free — no credit card</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map((m) => (
              <Card key={m.name} className="transition-shadow hover:shadow-md">
                <CardContent className="pt-5">
                  <m.icon className="mb-3 size-5 text-primary" />
                  <h3 className="text-sm font-semibold">{m.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} BizLab. Built for growing teams.
      </footer>
    </div>
  );
}
