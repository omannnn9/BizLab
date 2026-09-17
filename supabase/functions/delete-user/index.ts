// BizLab — delete-user edge function.
//
// Fully removes a platform-admin-chosen user: the auth.users row (via
// the service-role Admin API — a plain RLS-scoped client can never do
// this) and everything that cascades from it. profiles.id references
// auth.users(id) on delete cascade, so the profile goes too; company
// memberships cascade from there. Content the user created (tasks,
// projects, files, chat messages, audit log entries, ...) survives —
// migration 0032 converted those "author/creator/actor" foreign keys to
// ON DELETE SET NULL specifically so this wouldn't fail outright the
// first time it ran against a real (i.e. non-empty) account.
//
// Same two-client shape as invite-user: "asCaller" (anon key + the
// caller's own JWT) so every authorization/business-rule check runs
// through the exact same RLS-scoped queries the rest of the app
// trusts, and "service" (service role key) used strictly for the one
// thing asCaller can never do — the Admin API call itself.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const asCaller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: callerData, error: callerError } = await asCaller.auth.getUser();
  if (callerError || !callerData.user) return json({ error: "Not authenticated" }, 401);

  let body: { user_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const targetUserId = body.user_id;
  if (!targetUserId) return json({ error: "user_id is required" }, 400);

  // Authorization runs entirely through the caller's own RLS-scoped
  // client — this function trusts the database, not itself, same as
  // invite-user's has_min_role check.
  const { data: isAdmin, error: adminCheckError } = await asCaller.rpc("is_platform_admin");
  if (adminCheckError) return json({ error: adminCheckError.message }, 500);
  if (!isAdmin) return json({ error: "Only a platform admin can delete an account" }, 403);

  if (targetUserId === callerData.user.id) {
    return json({ error: "You can't delete your own account" }, 400);
  }

  // "profiles are viewable by co-members, self, and admins" already
  // lets a platform admin see every profile — no separate authority
  // needed to read this.
  const { data: target, error: targetError } = await asCaller
    .from("profiles")
    .select("id, email, is_platform_admin")
    .eq("id", targetUserId)
    .maybeSingle();
  if (targetError) return json({ error: targetError.message }, 500);
  if (!target) return json({ error: "User not found" }, 404);

  if (target.is_platform_admin) {
    const { count, error: countError } = await asCaller
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_platform_admin", true)
      .is("disabled_at", null)
      .neq("id", targetUserId);
    if (countError) return json({ error: countError.message }, 500);
    if (!count) {
      return json({ error: "Cannot delete the last remaining platform admin — revoke their admin status first" }, 400);
    }
  }

  const service = createClient(supabaseUrl, serviceRoleKey);

  const { error: deleteError } = await service.auth.admin.deleteUser(targetUserId);
  if (deleteError) return json({ error: deleteError.message }, 500);

  // Logged after the fact, as the admin (caller) — not the now-deleted
  // target — so the actor_id FK is always satisfied. log_audit_event
  // is already granted to `authenticated` for exactly this shape of
  // call (admin_set_user_disabled/admin_set_platform_admin use the
  // same function, just from inside SQL instead of from here).
  await asCaller.rpc("log_audit_event", {
    p_company_id: null,
    p_action: "admin.user_deleted",
    p_target_type: "profile",
    p_target_id: targetUserId,
    p_metadata: { email: target.email },
  });

  return json({ deleted: true });
});
