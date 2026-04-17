import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function requireAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return me?.role === "admin" ? user : null;
}

// PATCH /api/admin/users/[id] — update profile + optionally reset password
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const admin = adminClient();

  // Update password if provided
  if (body.password) {
    const { error } = await admin.auth.admin.updateUserById(id, {
      password: body.password,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Update email if provided
  if (body.email) {
    const { error } = await admin.auth.admin.updateUserById(id, {
      email: body.email,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Update profile fields
  const profileUpdate: Record<string, unknown> = {};
  if (body.full_name !== undefined) profileUpdate.full_name = body.full_name;
  if (body.role !== undefined) profileUpdate.role = body.role;
  if (body.permissions !== undefined) profileUpdate.permissions = body.permissions;
  if (body.is_active !== undefined) profileUpdate.is_active = body.is_active;

  if (Object.keys(profileUpdate).length > 0) {
    const { error } = await admin
      .from("user_profiles")
      .update(profileUpdate)
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/users/[id] — deactivate (soft delete)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Prevent self-deletion
  if (caller.id === id) {
    return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 });
  }

  const admin = adminClient();
  await admin.auth.admin.deleteUser(id);

  return NextResponse.json({ ok: true });
}
