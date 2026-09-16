import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

/** Shared loading/error UI for single-record editor pages (a document
 * or knowledge article fetched by id). Replaces the old
 * `if (isLoading || !record) return null` pattern, which rendered a
 * silent, permanently blank page whenever the fetch actually failed
 * (RLS denial, bad id, network error) instead of just being slow. */
export function EntityLoadGuard({
  isLoading,
  isError,
  backTo,
  backLabel,
  notFoundMessage,
}: {
  isLoading: boolean;
  isError: boolean;
  backTo: string;
  backLabel: string;
  notFoundMessage: string;
}) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-muted-foreground">
        {isError ? "Something went wrong loading this — try again." : notFoundMessage}
      </p>
      <Button variant="outline" size="sm" asChild>
        <Link to={backTo}>{backLabel}</Link>
      </Button>
    </div>
  );
}
