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

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  if (!path.startsWith("/admin")) return supabaseResponse;

  // Allow login page
  if (path === "/admin/login") {
    if (user) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/dashboard";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Not logged in → login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  // Check profile: is_active + permissions
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, permissions, is_active")
    .eq("id", user.id)
    .single();

  // No profile → deny access (user exists in Auth but has no profile row)
  if (!profile) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  // Deactivated user → logout
  if (!profile.is_active) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  // Admins bypass all permission checks
  if (profile.role === "admin") return supabaseResponse;

  // Staff: check route permission
  const match = ROUTE_PERMISSIONS.find(([prefix]) => path.startsWith(prefix));
  if (match) {
    const permKey = match[1];
    const allowed = (profile.permissions as Record<string, boolean>)?.[permKey] ?? false;
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
