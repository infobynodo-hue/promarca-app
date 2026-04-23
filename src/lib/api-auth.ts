import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * Validates the Bearer token from the Authorization header.
 * Accepts the PROMARCA_API_KEY env var.
 * Returns a Supabase admin client on success, or a 401/500 NextResponse on failure.
 */
export function validateApiKey(request: NextRequest):
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { ok: true; supabase: SupabaseClient<any> }
  | { ok: false; response: NextResponse } {
  const apiKey = process.env.PROMARCA_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "API key not configured on server" },
        { status: 500 }
      ),
    };
  }

  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token || token !== apiKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized. Include header: Authorization: Bearer YOUR_API_KEY" },
        { status: 401 }
      ),
    };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  return { ok: true, supabase };
}

/**
 * Shared admin auth guard for internal API routes (/api/admin/*).
 * Verifies the session user exists AND has role === "admin".
 * Returns the user object on success, or null on failure.
 *
 * Usage:
 *   const adminUser = await requireAdminSession();
 *   if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 */
export async function requireAdminSession() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active || profile.role !== "admin") return null;
  return user;
}

/**
 * Shared Supabase service-role client factory for admin API routes.
 */
export function serviceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
