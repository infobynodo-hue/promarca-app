import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Map route prefixes → permission key required
const ROUTE_PERMISSIONS: [string, string][] = [
  ["/admin/usuarios",             "usuarios"],
  ["/admin/integraciones",        "integraciones"],
  ["/admin/fotos",                "fotos"],
  ["/admin/mockups",              "mockups"],
  ["/admin/clientes",             "clientes"],
  ["/admin/pro",                  "pro"],
  ["/admin/campanas",             "campanas"],
  ["/admin/cotizaciones",         "cotizaciones"],
  ["/admin/catalogo/categorias",  "categorias"],
  ["/admin/catalogo",             "catalogo"],
];

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // ── Auth client (reads session from request cookies) ──
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const path = request.nextUrl.pathname;
  if (!path.startsWith("/admin")) return supabaseResponse;

  // Validate session against Supabase Auth (network call — safe in Edge)
  const { data: { user } } = await supabase.auth.getUser();

  // Not logged in → login page
  if (!user) {
    // Avoid redirect loop if already on login
    if (path === "/admin/login") return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  // ── Profile lookup via service-role key (bypasses RLS) ──
  // We use a plain fetch call to the PostgREST API so we stay in the Edge
  // runtime without importing the full supabase-js client.
  let profile: { role: string; permissions: Record<string, boolean>; is_active: boolean } | null = null;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_profiles?id=eq.${user.id}&select=role,permissions,is_active&limit=1`,
      {
        headers: {
          apikey:        process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          Accept:        "application/json",
        },
        cache: "no-store",
      }
    );
    if (res.ok) {
      const rows = await res.json();
      profile = rows[0] ?? null;
    }
  } catch {
    // Network error — allow through rather than bouncing the user
  }

  // Already on login page
  if (path === "/admin/login") {
    if (profile?.is_active) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/dashboard";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Profile missing or fetch failed — let through (page can do its own check)
  if (!profile) return supabaseResponse;

  // Deactivated account → send back to login
  if (!profile.is_active) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  // Admins bypass all permission checks
  if (profile.role === "admin") return supabaseResponse;

  // Staff: enforce per-route permission
  const match = ROUTE_PERMISSIONS.find(([prefix]) => path.startsWith(prefix));
  if (match) {
    const permKey = match[1];
    const allowed = profile.permissions?.[permKey] ?? false;
    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/admin/:path*"],
};
