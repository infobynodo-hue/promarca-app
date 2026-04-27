"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderOpen,
  FileText,
  Users,
  Palette,
  Sparkles,
  BrainCircuit,
  LogOut,
  ExternalLink,
  Plug,
  Megaphone,
  UserCog,
  Star,
  ShoppingBag,
  ChevronDown,
  ImageIcon,
  Layers,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────
type NavItem = {
  type: "link";
  href: string;
  label: string;
  icon: React.ElementType;
  sub?: { href: string; label: string; icon: React.ElementType }[];
};

type NavGroup = {
  type: "group";
  label: string;
  icon: React.ElementType;
  basePaths: string[];      // used to auto-expand when inside
  items: { href: string; label: string; icon: React.ElementType }[];
};

type NavEntry = NavItem | NavGroup;

// ─── Nav structure ───────────────────────────────────────────────────────────
const NAV: NavEntry[] = [
  { type: "link", href: "/admin/dashboard",   label: "Dashboard",    icon: LayoutDashboard },
  { type: "link", href: "/admin/catalogo",     label: "Productos",    icon: Package },
  {
    type: "link",
    href: "/admin/catalogo/categorias",
    label: "Categorías",
    icon: FolderOpen,
    sub: [
      { href: "/admin/destacados", label: "Destacados", icon: Star },
    ],
  },
  { type: "link", href: "/admin/cotizaciones", label: "Cotizaciones", icon: FileText },
  { type: "link", href: "/admin/pedidos",      label: "Pedidos",      icon: ShoppingBag },
  { type: "link", href: "/admin/clientes",     label: "Clientes",     icon: Users },
  {
    type: "group",
    label: "Submarcas",
    icon: Layers,
    basePaths: ["/admin/campanas", "/admin/pro"],
    items: [
      { href: "/admin/campanas", label: "Ventas B2C", icon: Megaphone },
      { href: "/admin/pro",      label: "Pro",         icon: BrainCircuit },
    ],
  },
  {
    type: "group",
    label: "Generación de imágenes",
    icon: ImageIcon,
    basePaths: ["/admin/mockups", "/admin/fotos"],
    items: [
      { href: "/admin/mockups", label: "Mockups",      icon: Palette },
      { href: "/admin/fotos",   label: "Fotos con IA", icon: Sparkles },
    ],
  },
  { type: "link", href: "/admin/integraciones/shopify", label: "Integraciones", icon: Plug },
  { type: "link", href: "/admin/usuarios",              label: "Usuarios",      icon: UserCog },
];

// ─── Component ───────────────────────────────────────────────────────────────
export function AdminSidebar() {
  const pathname = usePathname();
  const supabase = createClient();

  // Track which groups are open — auto-open if current path is inside
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {};
    NAV.forEach((entry) => {
      if (entry.type === "group") {
        state[entry.label] = entry.basePaths.some((p) => pathname.startsWith(p));
      }
    });
    return state;
  });

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  };

  const isActive = (href: string) =>
    pathname === href ||
    (href !== "/admin/dashboard" && href !== "/admin/catalogo" && pathname.startsWith(href));

  const isExactActive = (href: string) => pathname === href;

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-zinc-950 text-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-zinc-800 px-6">
        <img src="/img/promarca-logo-dark.png" alt="ProMarca" className="h-9 w-auto" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {NAV.map((entry) => {
            // ── Regular link (with optional sub-items) ──────────────────────
            if (entry.type === "link") {
              const active = isActive(entry.href) || isExactActive(entry.href);
              const hasSub = entry.sub && entry.sub.length > 0;
              const subActive = hasSub && entry.sub!.some((s) => pathname.startsWith(s.href));

              return (
                <li key={entry.href}>
                  <Link
                    href={entry.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active || subActive
                        ? "bg-orange-600/15 text-orange-400"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    )}
                  >
                    <entry.icon className="h-4 w-4 shrink-0" />
                    {entry.label}
                  </Link>
                  {/* Sub-items (e.g. Destacados under Categorías) */}
                  {hasSub && (
                    <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-zinc-800 pl-3">
                      {entry.sub!.map((sub) => {
                        const subIsActive = pathname.startsWith(sub.href);
                        return (
                          <li key={sub.href}>
                            <Link
                              href={sub.href}
                              className={cn(
                                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                                subIsActive
                                  ? "bg-orange-600/15 text-orange-400"
                                  : "text-zinc-500 hover:bg-zinc-800 hover:text-white"
                              )}
                            >
                              <sub.icon className="h-3.5 w-3.5 shrink-0" />
                              {sub.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            }

            // ── Collapsible group ────────────────────────────────────────────
            const isOpen = openGroups[entry.label] ?? false;
            const groupActive = entry.basePaths.some((p) => pathname.startsWith(p));

            return (
              <li key={entry.label}>
                <button
                  onClick={() => toggleGroup(entry.label)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    groupActive
                      ? "bg-orange-600/15 text-orange-400"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  )}
                >
                  <entry.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{entry.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-200",
                      isOpen ? "rotate-180" : ""
                    )}
                  />
                </button>
                {isOpen && (
                  <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-zinc-800 pl-3">
                    {entry.items.map((item) => {
                      const itemActive = pathname.startsWith(item.href);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                              itemActive
                                ? "bg-orange-600/15 text-orange-400"
                                : "text-zinc-500 hover:bg-zinc-800 hover:text-white"
                            )}
                          >
                            <item.icon className="h-3.5 w-3.5 shrink-0" />
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-800 p-3 space-y-0.5">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <ExternalLink className="h-4 w-4" />
          Ver sitio cliente
        </a>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
