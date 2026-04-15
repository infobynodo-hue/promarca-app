import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { BrainCircuit, ArrowRight, Clock, MessageSquare, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TEMPLATE_LABEL: Record<string, string> = {
  hero: "⚡ Hero",
  "problema-solucion": "🎯 Problema→Solución",
  "prueba-social": "⭐ Prueba Social",
  hispano: "🇨🇴 Hispano",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export const metadata = { title: "Historial Pro — ProMarca Admin" };

export default async function ProHistorialPage() {
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("pro_sessions")
    .select(`
      id, title, messages, extracted_copy, created_at, updated_at,
      product:products(id, name, reference, product_images(storage_path, is_primary, display_order))
    `)
    .order("updated_at", { ascending: false })
    .limit(100);

  // Group by product
  const grouped = new Map<string, {
    productId: string;
    productName: string;
    productRef: string;
    imageUrl: string | null;
    sessions: typeof sessions;
  }>();

  for (const s of sessions ?? []) {
    const product = s.product as any;
    const key = product?.id ?? "__no_product__";
    if (!grouped.has(key)) {
      // Get primary image URL
      const imgs: any[] = product?.product_images ?? [];
      const sorted = [...imgs].sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
      const primary = sorted.find((i: any) => i.is_primary) ?? sorted[0];
      // Note: server-side, we need the public URL pattern
      const imageUrl = primary?.storage_path
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products/${primary.storage_path}`
        : null;

      grouped.set(key, {
        productId: product?.id ?? "",
        productName: product?.name ?? "Sin producto",
        productRef: product?.reference ?? "",
        imageUrl,
        sessions: [],
      });
    }
    grouped.get(key)!.sessions!.push(s);
  }

  const groups = [...grouped.values()];
  const totalSessions = sessions?.length ?? 0;
  const sessionsWithCopy = sessions?.filter((s) => s.extracted_copy).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Historial Pro</h1>
            <Link href="/admin/pro" className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium bg-violet-50 px-2 py-1 rounded-full">
              <BrainCircuit className="h-3 w-3" /> Ir a Pro →
            </Link>
          </div>
          <p className="text-sm text-zinc-500 mt-0.5">Todas las sesiones guardadas con el Sales Coach</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-zinc-500">
          <div className="text-center">
            <p className="text-2xl font-bold text-zinc-800">{totalSessions}</p>
            <p className="text-xs">sesiones</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-violet-700">{sessionsWithCopy}</p>
            <p className="text-xs">con copy</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-600">{groups.length}</p>
            <p className="text-xs">productos</p>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {groups.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center">
              <BrainCircuit className="h-8 w-8 text-violet-500" />
            </div>
            <p className="text-zinc-600 font-medium">No hay sesiones guardadas aún</p>
            <p className="text-sm text-zinc-400">Las conversaciones con Pro se guardan automáticamente</p>
            <Link href="/admin/pro" className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors">
              <BrainCircuit className="h-4 w-4" /> Abrir Pro
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Groups */}
      {groups.map((group) => (
        <Card key={group.productId} className="overflow-hidden">
          <CardHeader className="pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-3">
              {group.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={group.imageUrl} alt={group.productName} className="h-10 w-10 rounded-lg object-cover flex-shrink-0 border border-zinc-100" />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-zinc-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-zinc-300 text-xs">📦</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <CardTitle className="text-sm font-semibold truncate">{group.productName}</CardTitle>
                {group.productRef && <p className="text-xs text-zinc-400 font-mono">{group.productRef}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">{group.sessions?.length} sesión{(group.sessions?.length ?? 0) !== 1 ? "es" : ""}</span>
                {group.productId && (
                  <Link
                    href={`/admin/pro?product_id=${group.productId}`}
                    className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium bg-violet-50 hover:bg-violet-100 px-2 py-1 rounded-full transition-colors"
                  >
                    Nueva sesión <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-zinc-50">
              {(group.sessions ?? []).map((s) => {
                const extracted = s.extracted_copy as any;
                const msgCount = Array.isArray(s.messages) ? s.messages.length : 0;
                return (
                  <div key={s.id} className="flex items-start gap-4 px-5 py-3 hover:bg-zinc-50/80 transition-colors group">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${extracted ? "bg-green-100" : "bg-violet-100"}`}>
                      {extracted
                        ? <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                        : <MessageSquare className="h-3.5 w-3.5 text-violet-500" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-medium text-zinc-800 truncate">{s.title}</p>
                      {extracted && (
                        <div className="flex flex-wrap gap-1.5">
                          {extracted.headline && (
                            <span className="text-[11px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full truncate max-w-[200px]">
                              &ldquo;{extracted.headline}&rdquo;
                            </span>
                          )}
                          {extracted.template && (
                            <span className="text-[11px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                              {TEMPLATE_LABEL[extracted.template] ?? extracted.template}
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-[11px] text-zinc-400 flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {fmtDate(s.updated_at)}
                        <span>·</span>
                        <MessageSquare className="h-3 w-3" />
                        {msgCount} mensaje{msgCount !== 1 ? "s" : ""}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {extracted && (
                        <Link
                          href={`/admin/campanas/nueva?product_id=${group.productId}&from_pro=1&session_id=${s.id}`}
                          className="text-[11px] bg-orange-500 text-white px-2.5 py-1 rounded-lg font-medium hover:bg-orange-600 transition-colors"
                        >
                          → Crear campaña
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
