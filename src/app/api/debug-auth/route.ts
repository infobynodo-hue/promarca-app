import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// Temporary debug route — remove after confirming auth works
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ authenticated: false, userError: userError?.message });
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("id, role, is_active, full_name")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    authenticated: true,
    userId: user.id,
    email: user.email,
    profile,
    profileError: profileError?.message ?? null,
  });
}
