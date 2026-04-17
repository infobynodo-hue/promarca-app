"use client";

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
  History,
  LogOut,
  ExternalLink,
  Plug,
  Megaphone,
  UserCog,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/catalogo", label: "Productos", icon: Package },
  { href: "/admin/catalogo/categorias", label: "Categorías", icon: FolderOpen },
  { href: "/admin/cotizaciones", label: "Cotizaciones", icon: FileText },
  { href: "/admin/campanas", label: "Ventas B2C", icon: Megaphone },
  { href: "/admin/pro", label: "Pro", icon: BrainCircuit },
  { href: "/admin/pro/historial", label: "Historial Pro", icon: History },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/mockups", label: "Mockups", icon: Palette },
  { href: "/admin/fotos", label: "Fotos con IA", icon: Sparkles },
  { href: "/admin/integraciones/shopify", label: "Integraciones", icon: Plug },
  { href: "/admin/usuarios", label: "Usuarios", icon: UserCog },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-zinc-950 text-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-zinc-800 px-6">
        <img
          src="/img/promarca-logo-dark.png"
          alt="ProMarca"
          className="h-9 w-auto"
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin/dashboard" &&
                pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-orange-600/15 text-orange-400"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-800 p-3 space-y-1">
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
