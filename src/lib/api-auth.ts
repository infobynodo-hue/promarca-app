import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Validates the Bearer token from the Authorization header.
 * Accepts the PROMARCA_API_KEY env var.
 * Returns a Supabase admin client on success, or a 401/500 NextResponse on failure.
 */
export function validateApiKey(request: NextRequest):
  | { ok: true; supabase: ReturnType<typeof createClient> }
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
