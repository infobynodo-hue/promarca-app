import { createClient } from "@/lib/supabase/server";
import {
  Package,
  Users,
  FileText,
  FolderOpen,
  TrendingUp,
  ShoppingCart,
  Layers,
  Megaphone,
  BrainCircuit,
  Globe,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatCOP, formatDate } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada",
  accepted: "Aceptada",
  rejected: "Rechazada",
  expired: "Vencida",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "secondary",
  sent: "outline",
  accepted: "default",
  rejected: "destructive",
  expired: "secondary",
};


export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: productCount },
    { count: categoryCount },
    { count: clientCount },
    { count: quoteCount },
    // Single query for campaigns — filter published count client-side
    { data: allCampaigns, count: campaignCount },
    { count: proSessionCount },
    { data: recentQuotes },
    { data: allItems },
    { data: allProducts },
  ] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("categories").select("id", { count: "exact", head: true }),
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("quotes").select("id", { count: "exact", head: true }),
    // Fetch campaigns with status so we can derive published count from one query
    supabase
      .from("b2c_campaigns")
      .select("id, slug, headline, status, template, created_at, product:products(name)", { count: "exact" })
      .order("created_at", { ascending: false }),
    supabase.from("pro_sessions").select("id", { count: "exact", head: true }),
    supabase
      .from("quotes")
      .select("id, quote_number, status, total, created_at, client:clients(name, company)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("quote_items")
      .select("product_id, product_name, product_reference, quantity, marking_type"),
    supabase
      .from("products")
      .select("id, name, category_id, category:categories(name, icon)"),
  ]);

  // Derive published count and recent campaigns from the single campaigns query
  const campaignPublishedCount = (allCampaigns ?? []).filter((c) => c.status === "published").length;
  const recentCampaigns = (allCampaigns ?? []).slice(0, 4);

  const items = allItems ?? [];
  const products = allProducts ?? [];

  // ── Total units sold
  const totalUnitsSold = items.reduce((acc, i) => acc + (i.quantity ?? 0), 0);

  // ── Top 5 products by qty
  const productQtyMap = new Map<string, { name: string; ref: string; qty: number }>();
  for (const item of items) {
    const key = item.product_name;
    const existing = productQtyMap.get(key);
    if (existing) {
      existing.qty += item.quantity ?? 0;
    } else {
      productQtyMap.set(key, {
        name: item.product_name,
        ref: item.product_reference ?? "",
        qty: item.quantity ?? 0,
      });
    }
  }
  const topProducts = [...productQtyMap.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);
  const maxProductQty = topProducts[0]?.qty ?? 1;

  // ── Category distribution
  const productCategoryMap = new Map<string, string>();
  const categoryMeta = new Map<string, { name: string; icon: string }>();
  for (const p of products) {
    if (p.category_id && p.category) {
      productCategoryMap.set(p.id, p.category_id);
      if (!categoryMeta.has(p.category_id)) {
        categoryMeta.set(p.category_id, {
          name: (p.category as any).name ?? "",
          icon: (p.category as any).icon ?? "📦",
        });
      }
    }
  }
  const catQtyMap = new Map<string, number>();
  for (const item of items) {
    if (!item.product_id) continue;
    const catId = productCategoryMap.get(item.product_id);
    if (!catId) continue;
    catQtyMap.set(catId, (catQtyMap.get(catId) ?? 0) + (item.quantity ?? 0));
  }
  const categoryStats = [...catQtyMap.entries()]
    .map(([catId, qty]) => ({
      ...categoryMeta.get(catId)!,
      qty,
      pct: totalUnitsSold > 0 ? Math.round((qty / totalUnitsSold) * 100) : 0,
    }))
    .filter(Boolean)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);

  // ── Marking type distribution
  const markingMap = new Map<string, number>();
  for (const item of items) {
    const mt = item.marking_type?.trim() || "Sin marcación";
    markingMap.set(mt, (markingMap.get(mt) ?? 0) + (item.quantity ?? 0));
  }
  const markingStats = [...markingMap.entries()]
    .map(([type, qty]) => ({
      type,
      qty,
      pct: totalUnitsSold > 0 ? Math.round((qty / totalUnitsSold) * 100) : 0,
    }))
    .sort((a, b) => b.qty - a.qty);
  const maxMarkingQty = markingStats[0]?.qty ?? 1;

  const TEMPLATE_LABEL: Record<string, string> = {
    "hero": "⚡ Hero", "problema-solucion": "🎯 Prob→Sol",
    "prueba-social": "⭐ Prueba Social", "hispano": "🇨🇴 Hispano",
  };
  const CAMPAIGN_STATUS_COLOR: Record<string, string> = { draft: "bg-zinc-100 text-zinc-600", published: "bg-green-100 text-green-700" };
  const CAMPAIGN_STATUS_LABEL: Record<string, string> = { draft: "Borrador", published: "Publicada" };

  const statCards = [
    { label: "Productos", count: productCount ?? 0, icon: Package, href: "/admin/catalogo", color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Categorías", count: categoryCount ?? 0, icon: FolderOpen, href: "/admin/catalogo/categorias", color: "text-green-600", bg: "bg-green-50" },
    { label: "Clientes", count: clientCount ?? 0, icon: Users, href: "/admin/clientes", color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Cotizaciones", count: quoteCount ?? 0, icon: FileText, href: "/admin/cotizaciones", color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Ventas B2C", count: campaignCount ?? 0, icon: Megaphone, href: "/admin/campanas", color: "text-pink-600", bg: "bg-pink-50" },
    { label: "Sesiones Pro", count: proSessionCount ?? 0, icon: BrainCircuit, href: "/admin/pro", color: "text-violet-600", bg: "bg-violet-50" },
  ];

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">Panel de administración · ProMarca</p>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-zinc-500">{s.label}</CardTitle>
                <div className={`rounded-lg p-2 ${s.bg}`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{s.count}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* ── Row 2: últimas cotizaciones + totales ── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">

        {/* Últimas cotizaciones */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base font-semibold">Últimas cotizaciones</CardTitle>
            <Link href="/admin/cotizaciones" className="text-xs text-orange-500 hover:text-orange-600 font-medium">
              Ver todas →
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {(recentQuotes ?? []).length === 0 ? (
              <p className="px-6 pb-6 text-sm text-zinc-400">No hay cotizaciones aún.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-zinc-400">
                    <th className="px-6 pb-3 text-left font-medium">#</th>
                    <th className="px-3 pb-3 text-left font-medium">Cliente</th>
                    <th className="px-3 pb-3 text-right font-medium">Total</th>
                    <th className="px-3 pb-3 text-left font-medium">Estado</th>
                    <th className="px-6 pb-3 text-right font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentQuotes ?? []).map((q) => (
                    <tr key={q.id} className="border-b last:border-0 hover:bg-zinc-50 transition-colors">
                      <td className="px-6 py-3 font-mono text-xs font-bold text-zinc-600">
                        <Link href={`/admin/cotizaciones/${q.id}`} className="hover:text-orange-500">
                          {q.quote_number}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-zinc-700">
                        {(q.client as any)?.company || (q.client as any)?.name || "—"}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold">{formatCOP(q.total)}</td>
                      <td className="px-3 py-3">
                        <Badge variant={STATUS_COLOR[q.status] as any} className="text-xs">
                          {STATUS_LABEL[q.status]}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-right text-zinc-400 text-xs">{formatDate(q.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Totales rápidos */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">Resumen general</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50">
                <ShoppingCart className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalUnitsSold.toLocaleString("es-CO")}</p>
                <p className="text-xs text-zinc-500">Unidades vendidas (total)</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{quoteCount ?? 0}</p>
                <p className="text-xs text-zinc-500">Cotizaciones totales</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                <Layers className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{categoryStats.length}</p>
                <p className="text-xs text-zinc-500">Categorías con ventas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: top productos + categorías ── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">

        {/* Top 5 productos */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">Top 5 productos más pedidos</CardTitle>
            <p className="text-xs text-zinc-400">Por unidades en cotizaciones</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {topProducts.length === 0 ? (
              <p className="text-sm text-zinc-400">Sin datos aún.</p>
            ) : (
              topProducts.map((p, i) => (
                <div key={p.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-500">
                        {i + 1}
                      </span>
                      <span className="truncate font-medium text-zinc-700">{p.name}</span>
                      {p.ref && <span className="flex-shrink-0 font-mono text-xs text-zinc-400">{p.ref}</span>}
                    </div>
                    <span className="ml-3 flex-shrink-0 font-bold text-zinc-800">{p.qty.toLocaleString("es-CO")} un.</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-100">
                    <div
                      className="h-2 rounded-full bg-orange-400 transition-all"
                      style={{ width: `${Math.round((p.qty / maxProductQty) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Categorías más consumidas */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">Categorías más vendidas</CardTitle>
            <p className="text-xs text-zinc-400">% del total de unidades</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {categoryStats.length === 0 ? (
              <p className="text-sm text-zinc-400">Sin datos aún.</p>
            ) : (
              categoryStats.map((cat) => (
                <div key={cat.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium text-zinc-700">
                      <span>{cat.icon}</span>
                      {cat.name}
                    </span>
                    <span className="font-bold text-zinc-800">{cat.pct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-100">
                    <div
                      className="h-2 rounded-full bg-blue-400 transition-all"
                      style={{ width: `${cat.pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-400">{cat.qty.toLocaleString("es-CO")} unidades</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3b: Ventas B2C ── */}
      <div className="mt-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-pink-500" /> Ventas B2C
              </CardTitle>
              <p className="text-xs text-zinc-400 mt-0.5">
                {campaignPublishedCount ?? 0} publicada{(campaignPublishedCount ?? 0) !== 1 ? "s" : ""} de {campaignCount ?? 0} total
              </p>
            </div>
            <Link href="/admin/campanas/nueva" className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-orange-600 transition-colors">
              + Nueva campaña
            </Link>
          </CardHeader>
          <CardContent>
            {(recentCampaigns ?? []).length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <p className="text-sm text-zinc-400">No hay campañas aún.</p>
                <Link href="/admin/campanas/nueva" className="text-sm text-orange-500 hover:underline">Crear la primera →</Link>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(recentCampaigns ?? []).map((c) => (
                  <Link key={c.id} href={`/admin/campanas/${c.id}/editar`}
                    className="group rounded-xl border border-zinc-200 bg-zinc-50 p-3 space-y-2 hover:border-orange-300 hover:bg-orange-50/50 transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-zinc-800 leading-snug line-clamp-2 flex-1">{c.headline ?? "Sin título"}</p>
                      <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${CAMPAIGN_STATUS_COLOR[c.status]}`}>
                        {CAMPAIGN_STATUS_LABEL[c.status]}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 truncate">{(c.product as any)?.name ?? "—"}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400">{TEMPLATE_LABEL[c.template] ?? c.template}</span>
                      {c.status === "published" && (
                        <a href={`/tienda/${c.slug}`} target="_blank" rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-0.5 text-[10px] text-orange-500 hover:underline">
                          <Globe className="h-2.5 w-2.5" /> Ver
                        </a>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {(campaignCount ?? 0) > 4 && (
              <div className="mt-3 text-center">
                <Link href="/admin/campanas" className="text-xs text-orange-500 hover:text-orange-600 font-medium">Ver todas las campañas →</Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: marcaciones ── */}
      <div className="mt-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">Distribución por tipo de marcación</CardTitle>
            <p className="text-xs text-zinc-400">Qué técnicas de personalización se piden más</p>
          </CardHeader>
          <CardContent>
            {markingStats.length === 0 ? (
              <p className="text-sm text-zinc-400">Sin datos aún.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {markingStats.map((m) => (
                  <div key={m.type} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize text-zinc-700">{m.type}</span>
                      <span className="font-bold text-zinc-800">{m.pct}%</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-zinc-100">
                      <div
                        className="h-2.5 rounded-full bg-purple-400 transition-all"
                        style={{ width: `${Math.round((m.qty / maxMarkingQty) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-zinc-400">{m.qty.toLocaleString("es-CO")} unidades</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
