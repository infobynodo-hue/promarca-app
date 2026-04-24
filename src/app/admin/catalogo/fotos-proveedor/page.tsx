"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  ImageIcon,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Database,
  AlertCircle,
  Info,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface ProductRow {
  id: string;
  reference: string;
  name: string;
  category: { name: string } | null;
}

type FailReason =
  | "ref_invalid"
  | "no_cache_match"
  | "no_gallery_images"
  | "download_failed"
  | "upload_failed"
  | "db_insert_failed"
  | "unknown";

const FAIL_LABELS: Record<FailReason, { label: string; color: string }> = {
  ref_invalid:       { label: "Referencia inválida",          color: "text-red-600" },
  no_cache_match:    { label: "No está en el índice",         color: "text-orange-600" },
  no_gallery_images: { label: "Sin fotos en el proveedor",    color: "text-amber-600" },
  download_failed:   { label: "Error de descarga",            color: "text-red-500" },
  upload_failed:     { label: "Error al subir a Storage",     color: "text-red-600" },
  db_insert_failed:  { label: "Error al guardar en BD",       color: "text-red-700" },
  unknown:           { label: "Error desconocido",            color: "text-zinc-500" },
};

interface FetchResult {
  found: boolean;
  imagesCount: number;
  reference: string;
  productId: string;
  productName: string;
  descriptionUpdated?: boolean;
  failReason?: FailReason;
  failDetail?: string;
}

interface BulkResult {
  processed: number;
  total: number;
  withImages: number;
  noImages: number;
  details: FetchResult[];
  nextOffset: number | null;
}

interface SyncResult {
  indexed: number;
  categories: number;
  errors: string[];
}

interface CacheStats {
  count: number;
  lastSynced: string | null;
}

interface Stats {
  total: number;
  withPhotos: number;
  withoutPhotos: number;
}

interface RecentProduct {
  id: string;
  name: string;
  reference: string;
  imagesCount: number;
  updatedAt: string;
}

type RowStatus = "idle" | "loading" | "found" | "not_found";

export default function FotosProveedorPage() {
  const supabase = createClient();

  const [stats, setStats] = useState<Stats>({ total: 0, withPhotos: 0, withoutPhotos: 0 });
  const [productsWithout, setProductsWithout] = useState<ProductRow[]>([]);
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([]);
  const [rowStatuses, setRowStatuses] = useState<Record<string, RowStatus>>({});
  const [rowResults, setRowResults] = useState<Record<string, FetchResult>>({});

  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);

  const [showRecent, setShowRecent] = useState(false);
  const [expandedError, setExpandedError] = useState<string | null>(null); // productId with expanded error
  const [loadingData, setLoadingData] = useState(true);

  // Catalog sync state
  const [cacheStats, setCacheStats] = useState<CacheStats>({ count: 0, lastSynced: null });
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Description backfill state
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ updated: number; total: number; cached: number } | null>(null);

  const loadCacheStats = useCallback(async () => {
    try {
      const [countRes, latestRes] = await Promise.all([
        supabase.from("supplier_product_cache").select("id", { count: "exact", head: true }),
        supabase
          .from("supplier_product_cache")
          .select("last_synced_at")
          .order("last_synced_at", { ascending: false })
          .limit(1),
      ]);

      setCacheStats({
        count: countRes.count ?? 0,
        lastSynced: latestRes.data?.[0]?.last_synced_at ?? null,
      });
    } catch {
      // Silently ignore — table may not have data yet
    }
  }, [supabase]);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [productsRes, imagesRes] = await Promise.all([
        supabase.from("products").select("id, reference, name, category:categories(name)").eq("is_active", true).order("name"),
        supabase.from("product_images").select("product_id"),
      ]);

      const allProducts = productsRes.data ?? [];
      const productsWithImages = new Set((imagesRes.data ?? []).map((img) => img.product_id));

      const withPhotos = allProducts.filter((p) => productsWithImages.has(p.id));
      const withoutPhotos = allProducts.filter((p) => !productsWithImages.has(p.id));

      setStats({
        total: allProducts.length,
        withPhotos: withPhotos.length,
        withoutPhotos: withoutPhotos.length,
      });

      setProductsWithout(
        withoutPhotos.map((p) => ({
          id: p.id,
          reference: p.reference,
          name: p.name,
          category: Array.isArray(p.category) ? (p.category[0] ?? null) : (p.category as { name: string } | null),
        }))
      );

      // Recent products with images — last 20 updated
      const recentWithImages = withPhotos.slice(0, 20).map((p) => ({
        id: p.id,
        name: p.name,
        reference: p.reference,
        imagesCount: (imagesRes.data ?? []).filter((img) => img.product_id === p.id).length,
        updatedAt: "",
      }));
      setRecentProducts(recentWithImages);
    } catch (err) {
      toast.error("Error al cargar datos");
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
    loadCacheStats();
  }, [loadData, loadCacheStats]);

  const handleBulkFetch = async () => {
    setBulkLoading(true);
    setBulkResult(null);
    setBulkProgress(0);
    setBulkTotal(0);

    const BATCH_SIZE = 20;
    let offset = 0;
    let accumulated: BulkResult = { processed: 0, total: 0, withImages: 0, noImages: 0, details: [], nextOffset: null };

    try {
      while (true) {
        const res = await fetch("/api/supplier/fetch-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batch: true, offset, limit: BATCH_SIZE }),
        });

        const data = await res.json();

        if (!res.ok) {
          toast.error(data.error ?? "Error en la búsqueda");
          break;
        }

        // Update accumulated results
        accumulated = {
          processed: accumulated.processed + data.processed,
          total: data.total,
          withImages: accumulated.withImages + data.withImages,
          noImages: accumulated.noImages + data.noImages,
          details: [...accumulated.details, ...(data.details ?? [])],
          nextOffset: data.nextOffset,
        };

        setBulkProgress(accumulated.processed);
        setBulkTotal(data.total);
        setBulkResult({ ...accumulated });

        if (data.nextOffset === null) break;
        offset = data.nextOffset;
      }

      toast.success(`Completado: ${accumulated.withImages} productos con imágenes encontradas`);
      await loadData();
    } catch {
      toast.error("Error de red al buscar imágenes");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleSingleFetch = async (productId: string) => {
    setRowStatuses((prev) => ({ ...prev, [productId]: "loading" }));

    try {
      const res = await fetch("/api/supplier/fetch-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });

      const data: FetchResult = await res.json();

      if (!res.ok) {
        toast.error((data as any).error ?? "Error al buscar imagen");
        setRowStatuses((prev) => ({ ...prev, [productId]: "not_found" }));
        return;
      }

      setRowResults((prev) => ({ ...prev, [productId]: data }));
      setRowStatuses((prev) => ({ ...prev, [productId]: data.found ? "found" : "not_found" }));

      if (data.found) {
        const descMsg = data.descriptionUpdated ? " y descripción importada" : "";
        toast.success(`${data.imagesCount} imagen${data.imagesCount !== 1 ? "es" : ""} encontrada${data.imagesCount !== 1 ? "s" : ""} para ${data.reference}${descMsg}`);
        await loadData();
      } else {
        toast.error(`No se encontraron imágenes para ${data.reference}`);
      }
    } catch {
      toast.error("Error de red");
      setRowStatuses((prev) => ({ ...prev, [productId]: "not_found" }));
    }
  };

  const handleSyncCatalog = async () => {
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/supplier/sync-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data: SyncResult = await res.json();
      if (!res.ok) {
        toast.error((data as unknown as { error?: string }).error ?? "Error al sincronizar");
        return;
      }
      setSyncResult(data);
      toast.success(`Catálogo sincronizado: ${data.indexed} productos indexados`);
      await loadCacheStats();
    } catch {
      toast.error("Error de red al sincronizar catálogo");
    } finally {
      setSyncLoading(false);
    }
  };

  const handleBackfillDescriptions = async () => {
    setBackfillLoading(true);
    setBackfillResult(null);
    try {
      const res = await fetch("/api/supplier/backfill-descriptions", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Error al importar descripciones");
        return;
      }
      setBackfillResult(data);
      if (data.updated > 0) {
        toast.success(`${data.updated} descripción${data.updated !== 1 ? "es" : ""} importada${data.updated !== 1 ? "s" : ""}`);
      } else {
        toast.info("No se encontraron descripciones nuevas en el caché");
      }
    } catch {
      toast.error("Error de red al importar descripciones");
    } finally {
      setBackfillLoading(false);
    }
  };

  const progressPercent = bulkTotal > 0 ? Math.round((bulkProgress / bulkTotal) * 100) : 0;

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/catalogo">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Importar fotos del proveedor</h1>
          <p className="text-sm text-zinc-500">
            Busca y descarga automáticamente las fotos de catalogospromocionales.com
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <span className="text-sm text-zinc-500">Total activos</span>
            <span className="text-2xl font-bold text-zinc-800">{stats.total}</span>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="flex items-center justify-between p-4">
            <span className="text-sm text-green-700">Con foto</span>
            <span className="text-2xl font-bold text-green-700">{stats.withPhotos}</span>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="flex items-center justify-between p-4">
            <span className="text-sm text-orange-700">Sin foto</span>
            <span className="text-2xl font-bold text-orange-700">{stats.withoutPhotos}</span>
          </CardContent>
        </Card>
      </div>

      {/* Sync catalog card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-500" />
            Sincronizar catálogo del proveedor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500">
            {cacheStats.lastSynced ? (
              <span>
                Última sincronización:{" "}
                <span className="font-medium text-zinc-700">
                  {new Date(cacheStats.lastSynced).toLocaleString("es-CO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </span>
            ) : (
              <span className="text-zinc-400 italic">Sin sincronizar aún</span>
            )}
            {cacheStats.count > 0 && (
              <Badge variant="secondary">{cacheStats.count} productos en caché</Badge>
            )}
          </div>

          {!syncLoading && !syncResult && (
            <div className="space-y-2">
              <Button onClick={handleSyncCatalog} variant="outline" size="sm" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Sincronizar catálogo
              </Button>
              <p className="text-xs text-zinc-400">
                Esto descarga el índice completo de catalogospromocionales.com (~5 min). Solo
                necesitas hacerlo ocasionalmente.
              </p>
            </div>
          )}

          {syncLoading && (
            <div className="flex items-center gap-3 text-sm text-zinc-600">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" />
              <span>Sincronizando catálogo… esto puede tardar varios minutos.</span>
            </div>
          )}

          {syncResult && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3">
              <p className="font-medium text-zinc-800">Sincronización completada</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white border border-zinc-200 px-3 py-2 text-center">
                  <p className="text-2xl font-bold text-zinc-800">{syncResult.indexed}</p>
                  <p className="text-xs text-zinc-500">Productos indexados</p>
                </div>
                <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-center">
                  <p className="text-2xl font-bold text-blue-700">{syncResult.categories}</p>
                  <p className="text-xs text-blue-600">Categorías procesadas</p>
                </div>
              </div>
              {syncResult.errors.length > 0 && (
                <p className="text-xs text-zinc-400">
                  {syncResult.errors.length} error{syncResult.errors.length !== 1 ? "es" : ""} menores (ver consola del servidor)
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSyncResult(null)}
              >
                Sincronizar de nuevo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backfill descriptions card */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4 text-green-500" />
            Importar descripciones del catálogo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-500">
            Copia las descripciones del caché del proveedor a los productos que aún no las tienen.
            Primero sincroniza el catálogo arriba para actualizar el caché.
          </p>
          {!backfillLoading && !backfillResult && (
            <Button
              onClick={handleBackfillDescriptions}
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={cacheStats.count === 0}
            >
              <RefreshCw className="h-4 w-4" />
              Importar descripciones
            </Button>
          )}
          {backfillLoading && (
            <div className="flex items-center gap-3 text-sm text-zinc-600">
              <Loader2 className="h-4 w-4 animate-spin text-green-500 flex-shrink-0" />
              <span>Importando descripciones…</span>
            </div>
          )}
          {backfillResult && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-center">
                  <p className="text-2xl font-bold text-green-700">{backfillResult.updated}</p>
                  <p className="text-xs text-green-600">Actualizados</p>
                </div>
                <div className="rounded-lg bg-white border border-zinc-200 px-3 py-2 text-center">
                  <p className="text-2xl font-bold text-zinc-800">{backfillResult.cached}</p>
                  <p className="text-xs text-zinc-500">En caché</p>
                </div>
                <div className="rounded-lg bg-white border border-zinc-200 px-3 py-2 text-center">
                  <p className="text-2xl font-bold text-zinc-800">{backfillResult.total}</p>
                  <p className="text-xs text-zinc-500">Sin descripción</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setBackfillResult(null)}>
                Importar de nuevo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main action card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Búsqueda automática masiva</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-500">
            El sistema buscará las fotos de cada producto sin imagen usando su código de referencia en{" "}
            <a
              href="https://catalogospromocionales.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-500 hover:underline"
            >
              catalogospromocionales.com
            </a>
            . No se sobreescriben imágenes existentes.
          </p>

          {!bulkLoading && !bulkResult && (
            <Button
              onClick={handleBulkFetch}
              disabled={stats.withoutPhotos === 0}
              className="w-full sm:w-auto"
              size="lg"
            >
              <Search className="mr-2 h-5 w-5" />
              Buscar y descargar fotos automáticamente
            </Button>
          )}

          {bulkLoading && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-orange-500 flex-shrink-0" />
                <span className="text-sm text-zinc-600">
                  Procesando {bulkProgress} de {bulkTotal} productos...
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full bg-orange-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-zinc-400">
                Esto puede tardar varios minutos dependiendo de la cantidad de productos.
              </p>
            </div>
          )}

          {bulkResult && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3">
              <p className="font-medium text-zinc-800">Resultado de la búsqueda</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-white border border-zinc-200 px-3 py-2 text-center">
                  <p className="text-2xl font-bold text-zinc-800">{bulkResult.processed}</p>
                  <p className="text-xs text-zinc-500">Procesados</p>
                </div>
                <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-center">
                  <p className="text-2xl font-bold text-green-700">{bulkResult.withImages}</p>
                  <p className="text-xs text-green-600">Con imágenes</p>
                </div>
                <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-2 text-center">
                  <p className="text-2xl font-bold text-zinc-500">{bulkResult.noImages}</p>
                  <p className="text-xs text-zinc-400">Sin imágenes</p>
                </div>
              </div>
              {bulkResult.details.some((d) => d.descriptionUpdated) && (
                <p className="text-xs text-blue-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                  {bulkResult.details.filter((d) => d.descriptionUpdated).length} descripción
                  {bulkResult.details.filter((d) => d.descriptionUpdated).length !== 1 ? "es" : ""}{" "}
                  importada{bulkResult.details.filter((d) => d.descriptionUpdated).length !== 1 ? "s" : ""}{" "}
                  del catálogo del proveedor
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setBulkResult(null); setBulkProgress(0); }}
              >
                Volver a buscar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Products without images table */}
      {productsWithout.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-orange-500" />
              Productos sin imágenes
              <Badge variant="secondary">{productsWithout.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-zinc-50 text-xs text-zinc-500">
                    <th className="px-4 py-3 text-left font-medium">Referencia</th>
                    <th className="px-4 py-3 text-left font-medium">Producto</th>
                    <th className="px-4 py-3 text-left font-medium">Categoría</th>
                    <th className="px-4 py-3 text-center font-medium w-48">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {productsWithout.map((p) => {
                    const status = rowStatuses[p.id] ?? "idle";
                    const result = rowResults[p.id];
                    const failInfo = result?.failReason ? FAIL_LABELS[result.failReason] : null;
                    const isExpanded = expandedError === p.id;
                    return (
                      <>
                        <tr key={p.id} className="border-b last:border-0 hover:bg-zinc-50/50">
                          <td className="px-4 py-3 font-mono text-xs font-bold text-zinc-700">
                            {p.reference}
                          </td>
                          <td className="px-4 py-3 font-medium text-zinc-800 max-w-[200px] truncate">
                            {p.name}
                          </td>
                          <td className="px-4 py-3 text-zinc-500 text-xs">
                            {p.category?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {status === "idle" && (
                              <Button size="sm" variant="outline" onClick={() => handleSingleFetch(p.id)}>
                                <Search className="mr-1.5 h-3.5 w-3.5" />
                                Buscar foto
                              </Button>
                            )}
                            {status === "loading" && (
                              <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-500">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Buscando...
                              </div>
                            )}
                            {status === "found" && result && (
                              <div className="flex items-center justify-center gap-1.5 text-xs text-green-600">
                                <CheckCircle2 className="h-4 w-4" />
                                {result.imagesCount} imagen{result.imagesCount !== 1 ? "es" : ""}
                              </div>
                            )}
                            {status === "not_found" && result && (
                              <button
                                onClick={() => setExpandedError(isExpanded ? null : p.id)}
                                className={`flex items-center justify-center gap-1.5 text-xs w-full ${failInfo?.color ?? "text-zinc-400"} hover:opacity-80`}
                              >
                                <XCircle className="h-4 w-4 flex-shrink-0" />
                                <span className="font-medium">{failInfo?.label ?? "Error"}</span>
                                <Info className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" />
                              </button>
                            )}
                          </td>
                        </tr>
                        {/* Expanded error detail row */}
                        {status === "not_found" && result?.failDetail && isExpanded && (
                          <tr key={`${p.id}-detail`} className="bg-amber-50 border-b">
                            <td colSpan={4} className="px-4 py-3">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                <div className="text-xs text-amber-800 leading-relaxed">
                                  <span className="font-semibold">Motivo: </span>
                                  {result.failDetail}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {productsWithout.length === 0 && !loadingData && (
        <Card className="mt-6 border-green-200 bg-green-50/50">
          <CardContent className="flex items-center gap-3 p-6">
            <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-green-800">Todos los productos tienen imágenes</p>
              <p className="text-sm text-green-600">No hay productos sin foto en este momento.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recently updated section */}
      {recentProducts.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <button
              onClick={() => setShowRecent((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Productos con imágenes importadas
                <Badge className="bg-green-600">{recentProducts.length}</Badge>
              </CardTitle>
              {showRecent ? (
                <ChevronUp className="h-4 w-4 text-zinc-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-zinc-400" />
              )}
            </button>
          </CardHeader>
          {showRecent && (
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-zinc-50 text-xs text-zinc-500">
                      <th className="px-4 py-3 text-left font-medium">Referencia</th>
                      <th className="px-4 py-3 text-left font-medium">Producto</th>
                      <th className="px-4 py-3 text-center font-medium">Imágenes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentProducts.map((p) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-zinc-50/50">
                        <td className="px-4 py-3 font-mono text-xs font-bold text-zinc-700">
                          {p.reference}
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-800 max-w-[250px] truncate">
                          {p.name}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                            {p.imagesCount} foto{p.imagesCount !== 1 ? "s" : ""}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Back link */}
      <div className="mt-8">
        <Link href="/admin/catalogo" className="text-sm text-zinc-500 hover:text-orange-500 transition-colors flex items-center gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al catálogo
        </Link>
      </div>
    </>
  );
}
