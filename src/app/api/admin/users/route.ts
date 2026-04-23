import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, serviceRoleClient } from "@/lib/api-auth";

// GET /api/admin/users — list all users with their profiles
export async function GET() {
  const adminUser = await requireAdminSession();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = serviceRoleClient();

  const [{ data: { users: authUsers } }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers(),
    admin.from("user_profiles").select("*").order("created_at"),
  ]);

  const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));

  const result = authUsers.map((u) => ({
    id: u.id,
    email: u.email,
    last_sign_in_at: u.last_sign_in_at,
    created_at: u.created_at,
    ...profileMap[u.id],
  }));

  return NextResponse.json(result);
}

// POST /api/admin/users — create a new user
export async function POST(req: NextRequest) {
  const adminUser = await requireAdminSession();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, password, full_name, role, permissions } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email y contraseña son requeridos" }, { status: 400 });
  }

  const admin = serviceRoleClient();

  // Create auth user
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  // Create profile row
  const { error: profileError } = await (admin as any).from("user_profiles").insert({
    id: newUser.user.id,
    full_name,
    role: role ?? "staff",
    permissions: permissions ?? {},
  });

  if (profileError) {
    // Rollback auth user if profile creation fails
    await admin.auth.admin.deleteUser(newUser.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ id: newUser.user.id });
}
