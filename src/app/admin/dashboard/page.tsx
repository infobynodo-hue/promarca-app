import { createClient } from "@/lib/supabase/server";
import { Package, Users, FileText, FolderOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [products, categories, clients, quotes] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("categories").select("id", { count: "exact", head: true }),
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("quotes").select("id", { count: "exact", head: true }),
  ]);

  const stats = [
    {
      label: "Productos",
      count: products.count ?? 0,
      icon: Package,
      href: "/admin/catalogo",
      color: "text-blue-600",
    },
    {
      label: "Categorías",
      count: categories.count ?? 0,
      icon: FolderOpen,
      href: "/admin/catalogo/categorias",
      color: "text-green-600",
    },
    {
      label: "Clientes",
      count: clients.count ?? 0,
      icon: Users,
      href: "/admin/clientes",
      color: "text-purple-600",
    },
    {
      label: "Cotizaciones",
      count: quotes.count ?? 0,
      icon: FileText,
      href: "/admin/cotizaciones",
      color: "text-orange-600",
    },
  ];

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Panel de administración de ProMarca
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-zinc-500">
                  {s.label}
                </CardTitle>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{s.count}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
