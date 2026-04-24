"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, CheckCircle2, Download, ExternalLink, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface SupplierProduct {
  supplier_id: number;
  reference: string;
  name: string;
  thumbnail_url: string;
  category_id: number;
  slug: string;
  page_url: string;
  already_imported: boolean;
  existing_product_id?: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

export default function ImportarProveedorPage() {
  const supabase = createClient();

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SupplierProduct[]>([]);
  const [searchMeta, setSearchMeta] = useState<{ total: number; new_count: number; existing_count: number; matched_url: string } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [targetCategoryId, setTargetCategoryId] = useState<string>("");
  const [fetchImages, setFetchImages] = useState(true);
  const [importing, setImporting] = useState(false);
  const [lastImport, setLastImport] = useState<{ created: number; existed: number; failed: number; total_images_downloaded: number; target_category: string } | null>(null);

  useEffect(() => {
    supabase
      .from("categories")
      .select("id, name")
      .eq("is_active", true)
      .order("display_order")
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    setSelected(new Set());
    setSearchMeta(null);
    setSearchError(null);
    setLastImport(null);

    try {
      const res = await fetch(`/api/supplier/search-supplier?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) { setSearchError(data.error ?? "Error desconocido"); return; }
      if (!data.results || data.results.length === 0) {
        setSearchError(data.message ?? `No se encontraron productos para "${query}"`);
        return;
      }
      setResults(data.results);
      setSearchMeta({
        total: data.total,
        new_count: data.new_count,
        existing_count: data.existing_count,
        matched_url: data.matched_url,
      });
      setSelected(new Set(
        data.results.filter((r: SupplierProduct) => !r.already_imported).map((r: SupplierProduct) => r.supplier_id)
      ));
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setSearching(false);
    }
  };

  const toggleSelect = (supplierId: number, alreadyImported: boolean) => {
    if (alreadyImported) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(supplierId)) next.delete(supplierId); else next.add(supplierId);
      return next;
    });
  };

  const selectAllNew = () =>
    setSelected(new Set(results.filter((r) => !r.already_imported).map((r) => r.supplier_id)));
  const clearSelection = () => setSelected(new Set());

  const handleImport = async () => {
    if (selected.size === 0) { toast.error("Selecciona al menos un producto"); return; }
    if (!targetCategoryId) { toast.error("Elige la categoría destino"); return; }

    const productsToImport = results
      .filter((r) => selected.has(r.supplier_id))
      .map((r) => ({
        supplier_id: r.supplier_id,
        reference: r.reference,
        name: r.name,
        category_id_supplier: r.category_id,
        slug: r.slug,
        page_url: r.page_url,
      }));

    setImporting(true);
    try {
      const res = await fetch("/api/supplier/import-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: productsToImport,
          target_category_id: targetCategoryId,
          fetch_images: fetchImages,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Error al importar"); return; }

      setLastImport(data.summary);
      toast.success(`${data.summary.created} productos importados`);

      // Mark imported ones as imported in the grid
      const importedRefs = new Set(
        (data.results ?? [])
          .filter((r: { status: string; reference: string }) => r.status === "created")
          .map((r: { reference: string }) => r.reference)
      );
      setResults((prev) => prev.map((r) => importedRefs.has(r.reference) ? { ...r, already_imported: true } : r));
      setSelected(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de red");
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar desde proveedor</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Busca una categoría del proveedor y trae los productos que te interesen al catálogo.
          El precio se deja en $0 — tú lo pones después.
        </p>
      </div>

      <Card className="mt-6">
        <CardContent className="pt-6">
          <Label>¿Qué categoría buscas?</Label>
          <div className="flex gap-2 mt-1.5">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Ej: antiestres, termos, gorras, usb, cuadernos..."
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={searching || !query.trim()}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Buscar</span>
            </Button>
          </div>
          <p className="text-xs text-zinc-400 mt-2">
            Busca tal cual en el proveedor: /promocionales/variedades-{query ? query.toLowerCase().replace(/\s+/g, "-") : "[query]"}.html
          </p>
        </CardContent>
      </Card>

      {searchError && (
        <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-900">{searchError}</p>
        </div>
      )}

      {results.length > 0 && searchMeta && (
        <>
          <div className="mt-6 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm text-zinc-600">
                <strong>{searchMeta.total}</strong> productos encontrados {" · "}
                <span className="text-emerald-600">{searchMeta.new_count} nuevos</span> {" · "}
                <span className="text-zinc-400">{searchMeta.existing_count} ya en catálogo</span>
              </p>
              <a href={searchMeta.matched_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-zinc-400 hover:text-orange-500 inline-flex items-center gap-1 mt-1">
                Ver en el proveedor <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAllNew}>Seleccionar todos nuevos</Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>Limpiar</Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {results.map((p) => {
              const isSelected = selected.has(p.supplier_id);
              const disabled = p.already_imported;
              return (
                <div
                  key={p.supplier_id}
                  onClick={() => toggleSelect(p.supplier_id, p.already_imported)}
                  className={`relative rounded-xl border overflow-hidden transition-all ${
                    disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:shadow-md"
                  } ${isSelected ? "border-orange-500 ring-2 ring-orange-500/30" : "border-zinc-200"}`}
                >
                  <div className="aspect-square bg-zinc-50 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.thumbnail_url} alt={p.name}
                      className="w-full h-full object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    {p.already_imported && (
                      <Badge className="absolute top-2 left-2 bg-emerald-500">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> En catálogo
                      </Badge>
                    )}
                    {isSelected && (
                      <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-orange-500 text-white flex items-center justify-center">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-wide">{p.reference}</p>
                    <p className="text-sm font-medium leading-tight mt-0.5 line-clamp-2">{p.name}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {selected.size > 0 && (
            <div className="sticky bottom-4 mt-6 p-4 rounded-xl bg-white shadow-lg border border-zinc-200 flex flex-col md:flex-row gap-3 md:items-end">
              <div className="flex-1">
                <Label>Importar a la categoría:</Label>
                <Select value={targetCategoryId} onValueChange={(v) => setTargetCategoryId(v ?? "")}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Elegir categoría de ProMarca..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <Switch id="fetch-images" checked={fetchImages} onCheckedChange={(v: boolean) => setFetchImages(v)} />
                <Label htmlFor="fetch-images" className="flex items-center gap-1 cursor-pointer">
                  <ImageIcon className="h-4 w-4" /> Traer imágenes
                </Label>
              </div>
              <Button
                onClick={handleImport}
                disabled={importing || !targetCategoryId || selected.size === 0}
                className="md:w-auto"
              >
                {importing
                  ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  : <Download className="h-4 w-4 mr-2" />}
                Importar {selected.size} producto{selected.size !== 1 ? "s" : ""}
              </Button>
            </div>
          )}

          {lastImport && (
            <Card className="mt-6 border-emerald-200 bg-emerald-50">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-emerald-900">
                  ✅ Importación completa a <strong>{lastImport.target_category}</strong>
                </p>
                <div className="mt-2 text-sm text-emerald-800 space-x-4">
                  <span><strong>{lastImport.created}</strong> creados</span>
                  <span><strong>{lastImport.existed}</strong> ya existían</span>
                  {lastImport.failed > 0 && (
                    <span className="text-red-600"><strong>{lastImport.failed}</strong> fallaron</span>
                  )}
                  {lastImport.total_images_downloaded > 0 && (
                    <span><strong>{lastImport.total_images_downloaded}</strong> imágenes descargadas</span>
                  )}
                </div>
                <p className="text-xs text-emerald-700 mt-3">
                  Los productos quedaron con precio $0. Edítalos desde{" "}
                  <a href="/admin/catalogo" className="underline">Catálogo</a> para asignarles precios.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </>
  );
}
