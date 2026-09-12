// BizLab — invite-user edge function.
//
// The only way a new BizLab account gets created now that public
// signup is gone. Two client roles are used deliberately:
//   - "asCaller" (anon key + the caller's own JWT) so authorization
//     runs through the exact same has_min_role()/RLS the rest of the
//     app trusts — this function adds no new authority of its own for
//     the *authorization* question, only for the one thing a plain
//     RLS-scoped client can never do: provision an auth.users row.
//   - "service" (service role key, injected automatically by Supabase
//     into every edge function — never present in any frontend bundle)
//     used strictly for auth.admin.inviteUserByEmail, after the caller
//     has already been proven authorized.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROLES = ["owner", "admin", "manager", "employee", "guest"];

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

  let body: {
    email?: string;
    full_name?: string;
    company_id?: string;
    role?: string;
    redirectOrigin?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  const fullName = body.full_name?.trim() || null;
  const companyId = body.company_id;
  const role = body.role;
  const redirectOrigin = body.redirectOrigin;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "A valid email is required" }, 400);
  }
  if (!companyId) return json({ error: "company_id is required" }, 400);
  if (!role || !ROLES.includes(role)) return json({ error: "role must be one of: " + ROLES.join(", ") }, 400);
  if (!redirectOrigin || !/^https?:\/\/[^/]+$/.test(redirectOrigin)) {
    return json({ error: "redirectOrigin must be a valid origin URL" }, 400);
  }

  // Authorization: is the caller a platform admin, or at least an admin
  // of *this specific company*? Runs through the caller's own RLS-scoped
  // client, so it can never be tricked into a "yes" the database itself
  // wouldn't also give — this function trusts the database, not itself.
  const { data: isAdmin, error: roleCheckError } = await asCaller.rpc("has_min_role", {
    p_company_id: companyId,
    p_min_role: "admin",
  });
  if (roleCheckError) return json({ error: roleCheckError.message }, 500);
  if (!isAdmin) return json({ error: "Only a company admin or platform admin can invite users" }, 403);

  const service = createClient(supabaseUrl, serviceRoleKey);

  // Does this email already have a BizLab account? If so this is a
  // multi-company invite (requirement 7) — they just need the
  // invitation row; they'll accept it from inside their existing
  // session, no new auth.users row or email required.
  const { data: existingProfile } = await service
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  // The invitation row goes through asCaller so it's covered by the
  // real "admins create invitations" RLS policy (has_min_role + the
  // invited_by = auth.uid() check) instead of duplicating that logic
  // here — this function does not get to decide who counts as an
  // inviting admin, the database's own policy does.
  const { data: invitation, error: inviteError } = await asCaller
    .from("company_invitations")
    .insert({ company_id: companyId, email, role, invited_by: callerData.user.id, full_name: fullName })
    .select()
    .single();

  if (inviteError) {
    if (inviteError.code === "23505") {
      return json({ error: "An invitation is already pending for this email in this company" }, 409);
    }
    return json({ error: inviteError.message }, 400);
  }

  let accountCreated = false;
  if (!existingProfile) {
    const { error: inviteEmailError } = await service.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo: `${redirectOrigin}/accept-invite?token=${invitation.token}`,
    });
    if (inviteEmailError) {
      // Roll back the invitation row rather than leave an orphaned
      // invite for an account that was never actually provisioned.
      await asCaller.from("company_invitations").delete().eq("id", invitation.id);
      return json({ error: `Could not send invite email: ${inviteEmailError.message}` }, 500);
    }
    accountCreated = true;
  }

  return json({ invitation, accountCreated });
});
