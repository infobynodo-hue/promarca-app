import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, serviceRoleClient } from "@/lib/api-auth";

// PATCH /api/admin/users/[id] — update profile + optionally reset password
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await requireAdminSession();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const admin = serviceRoleClient();

  // Update password if provided
  if (body.password) {
    const { error } = await admin.auth.admin.updateUserById(id, { password: body.password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Update email if provided
  if (body.email) {
    const { error } = await admin.auth.admin.updateUserById(id, { email: body.email });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Update profile fields
  const profileUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.full_name   !== undefined) profileUpdate.full_name   = body.full_name;
  if (body.role        !== undefined) profileUpdate.role        = body.role;
  if (body.permissions !== undefined) profileUpdate.permissions = body.permissions;
  if (body.is_active   !== undefined) profileUpdate.is_active   = body.is_active;

  if (Object.keys(profileUpdate).length > 1) { // > 1 because updated_at is always added
    const { error } = await (admin as any)
      .from("user_profiles")
      .update(profileUpdate)
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/users/[id] — hard delete from Auth + profile
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await requireAdminSession();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Prevent self-deletion
  if (caller.id === id) {
    return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 });
  }

  const admin = serviceRoleClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
