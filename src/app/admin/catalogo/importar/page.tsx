"use client";

import { useRef, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, Loader2, CheckCircle2, Trash2, FileText, AlertCircle, Sparkles, Image as ImageIcon, RefreshCw, SkipForward } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { extractImagesFromPDF, uploadPDFToStorage, type ExtractedImage } from "@/lib/pdf-image-extractor";

interface ExtractedProduct {
  reference: string;
  name: string;
  price: number;
  price_label: string;
  description: string | null;
  _include: boolean;
}

export default function ImportarPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("none");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [products, setProducts] = useState<ExtractedProduct[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [importedProductIds, setImportedProductIds] = useState<Record<string, string>>({});
  const [duplicateRefs, setDuplicateRefs] = useState<string[]>([]);
  const [duplicateMode, setDuplicateMode] = useState<"skip" | "update">("skip");

  // PDF image extraction state
  const [extractingImages, setExtractingImages] = useState(false);
  const [extractImageProgress, setExtractImageProgress] = useState<{ page: number; total: number } | null>(null);
  const [extractedImages, setExtractedImages] = useState<ExtractedImage[]>([]);
  const [showImageExtractor, setShowImageExtractor] = useState(false);

  useEffect(() => {
    supabase
      .from("categories")
      .select("*")
      .order("display_order")
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.type === "application/pdf") {
      setSelectedFile(f);
      setProducts([]);
      setExtractError(null);
      setDone(false);
    } else if (f) {
      toast.error("Solo se aceptan archivos PDF");
    }
  };

  const handleExtract = async () => {
    if (!selectedFile) return;
    setExtracting(true);
    setProducts([]);
    setExtractError(null);
    setDone(false);

    try {
      const formData = new FormData();
      formData.append("pdf", selectedFile);

      // Llamamos a Supabase Edge Function (sin timeout de Vercel)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const res = await fetch(`${supabaseUrl}/functions/v1/import-pdf`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setExtractError(data.error ?? "Error al procesar el PDF");
        return;
      }

      if (!data.products?.length) {
        setExtractError("No se encontraron productos en el PDF. Verificá que el PDF contenga un catálogo con referencias y precios.");
        return;
      }

      setProducts(
        data.products.map((p: any) => ({
          ...p,
          price: Number(p.price) || 0,
          _include: true,
        }))
      );
      toast.success(`¡${data.products.length} productos detectados!`);
    } catch {
      setExtractError("Error de conexión. Verificá tu internet e intentá de nuevo.");
    } finally {
      setExtracting(false);
    }
  };

  const handleImport = async () => {
    const toImport = products.filter((p) => p._include);
    if (!toImport.length) {
      toast.error("Seleccioná al menos un producto");
      return;
    }

    setImporting(true);
    setDuplicateRefs([]);

    const refs = toImport.map((p) => p.reference.trim().toUpperCase());

    // ── Detectar referencias ya existentes ───────────────────────────────────
    const { data: existing } = await supabase
      .from("products")
      .select("id, reference")
      .in("reference", refs);

    const existingMap: Record<string, string> = {};
    for (const row of existing ?? []) {
      existingMap[row.reference] = row.id;
    }
    const dupes = refs.filter((r) => existingMap[r]);

    if (dupes.length > 0) {
      setDuplicateRefs(dupes);
    }

    const newProducts   = toImport.filter((p) => !existingMap[p.reference.trim().toUpperCase()]);
    const dupeProducts  = toImport.filter((p) =>  existingMap[p.reference.trim().toUpperCase()]);

    const idMap: Record<string, string> = { ...existingMap };

    // ── Insertar nuevos ──────────────────────────────────────────────────────
    if (newProducts.length > 0) {
      const payload = newProducts.map((p) => ({
        reference: p.reference.trim().toUpperCase(),
        name: p.name.trim(),
        description: p.description || null,
        price: p.price,
        price_label: p.price_label || "Sin marca",
        category_id: selectedCategory !== "none" ? selectedCategory : null,
        is_active: true,
      }));

      const { data: inserted, error } = await supabase
        .from("products")
        .insert(payload)
        .select("id, reference");

      if (error) {
        toast.error("Error al importar nuevos: " + error.message);
        setImporting(false);
        return;
      }
      for (const row of inserted ?? []) idMap[row.reference] = row.id;
    }

    // ── Actualizar duplicados si el modo es "update" ─────────────────────────
    if (duplicateMode === "update" && dupeProducts.length > 0) {
      for (const p of dupeProducts) {
        const ref = p.reference.trim().toUpperCase();
        const existingId = existingMap[ref];
        if (!existingId) continue;
        await supabase.from("products").update({
          name: p.name.trim(),
          description: p.description || null,
          price: p.price,
          price_label: p.price_label || "Sin marca",
          category_id: selectedCategory !== "none" ? selectedCategory : null,
          updated_at: new Date().toISOString(),
        }).eq("id", existingId);
      }
    }

    setImportedProductIds(idMap);

    const skipped = duplicateMode === "skip" ? dupeProducts.length : 0;
    const updated = duplicateMode === "update" ? dupeProducts.length : 0;

    const msg = [
      newProducts.length > 0 && `${newProducts.length} productos nuevos importados`,
      updated > 0 && `${updated} actualizados`,
      skipped > 0 && `${skipped} omitidos (ya existían)`,
    ].filter(Boolean).join(" · ");

    toast.success(msg || "Importación completada");
    setImporting(false);
    setDone(true);
  };

  // Extract images from the PDF using PDF.js (runs in browser)
  const handleExtractImages = async () => {
    if (!selectedFile) return;
    setExtractingImages(true);
    setExtractedImages([]);
    setShowImageExtractor(false);
    try {
      const images = await extractImagesFromPDF(selectedFile, (page, total) => {
        setExtractImageProgress({ page, total });
      });
      const useful = images.filter((i) => i.quality !== "low");
      setExtractedImages(useful);
      setShowImageExtractor(true);
      if (useful.length === 0) {
        toast.error("No se encontraron imágenes de buena calidad en el PDF");
      } else {
        toast.success(`${useful.length} imágenes extraídas del PDF`);
      }
    } catch (err: any) {
      toast.error("Error al extraer imágenes: " + err.message);
    } finally {
      setExtractingImages(false);
      setExtractImageProgress(null);
    }
  };

  const updateProduct = (i: number, field: keyof ExtractedProduct, value: any) => {
    const updated = [...products];
    (updated[i] as any)[field] = value;
    setProducts(updated);
  };

  const selectedCount = products.filter((p) => p._include).length;

  return (
    <>
      <div className="flex items-center gap-4">
        <Link href="/admin/catalogo">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Importar productos desde PDF</h1>
          <p className="text-sm text-zinc-500">
            Sube un catálogo en PDF y Claude extraerá los productos automáticamente
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Step 1: Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
              1. Seleccionar PDF
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-zinc-200 p-8 cursor-pointer hover:border-orange-300 hover:bg-orange-50/50 transition-colors"
            >
              <FileText className="h-10 w-10 text-zinc-300" />
              {selectedFile ? (
                <div className="text-center">
                  <p className="font-medium text-sm text-zinc-700">{selectedFile.name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-medium text-zinc-600">Clic para seleccionar</p>
                  <p className="text-xs text-zinc-400">PDF · hasta 50 MB</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </CardContent>
        </Card>

        {/* Step 2: Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
              2. Categoría (opcional)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-zinc-400">
              Todos los productos importados se asignarán a esta categoría. Podés cambiarla después.
            </p>
            <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v ?? "none")}>
              <SelectTrigger>
                <SelectValue placeholder="Sin categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin categoría</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Step 3: Extract */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
              3. Extraer con Claude
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-zinc-400">
              Claude AI leerá el PDF y detectará referencias, precios y nombres automáticamente.
              <span className="block mt-1 text-zinc-300">Demora ~15-30 segundos según el tamaño.</span>
            </p>
            <Button
              onClick={handleExtract}
              disabled={!selectedFile || extracting}
              className="w-full"
            >
              {extracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analizando PDF...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Extraer productos
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Error message — visible en pantalla */}
      {extractError && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">No se pudo extraer</p>
            <p className="text-sm text-red-600 mt-0.5">{extractError}</p>
          </div>
        </div>
      )}

      {/* Results table */}
      {products.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-3 space-y-3">
            <div className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Productos detectados</CardTitle>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Revisá y editá antes de importar. Desmarcá los que no querés.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline">{selectedCount} seleccionados</Badge>
                <Button
                  onClick={handleImport}
                  disabled={importing || selectedCount === 0 || done}
                >
                  {importing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importando...</>
                  ) : done ? (
                    <><CheckCircle2 className="mr-2 h-4 w-4" />Importados</>
                  ) : (
                    `Importar ${selectedCount} productos`
                  )}
                </Button>
              </div>
            </div>

            {/* Duplicate handling option */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-amber-800">
                ¿Qué hacer si ya existe un producto con la misma referencia?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDuplicateMode("skip")}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                    duplicateMode === "skip"
                      ? "border-amber-400 bg-amber-100 text-amber-800"
                      : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300"
                  }`}
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  Omitir — no tocar el existente
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicateMode("update")}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                    duplicateMode === "update"
                      ? "border-orange-400 bg-orange-50 text-orange-700"
                      : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300"
                  }`}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Actualizar — sobreescribir nombre y precio
                </button>
              </div>
              {duplicateRefs.length > 0 && (
                <p className="text-xs text-amber-700">
                  {duplicateRefs.length} referencia{duplicateRefs.length > 1 ? "s" : ""} ya existente{duplicateRefs.length > 1 ? "s" : ""}:{" "}
                  <span className="font-mono font-bold">{duplicateRefs.slice(0, 6).join(", ")}{duplicateRefs.length > 6 ? ` +${duplicateRefs.length - 6} más` : ""}</span>
                </p>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-zinc-50 text-xs text-zinc-500">
                    <th className="px-4 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={products.every((p) => p._include)}
                        onChange={(e) =>
                          setProducts(products.map((p) => ({ ...p, _include: e.target.checked })))
                        }
                        className="rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Referencia</th>
                    <th className="px-4 py-3 text-left font-medium">Nombre</th>
                    <th className="px-4 py-3 text-right font-medium">Precio (COP)</th>
                    <th className="px-4 py-3 text-left font-medium">Etiqueta</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => (
                    <tr
                      key={i}
                      className={`border-b last:border-0 transition-colors ${
                        p._include ? "hover:bg-zinc-50" : "opacity-40 bg-zinc-50"
                      }`}
                    >
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={p._include}
                          onChange={(e) => updateProduct(i, "_include", e.target.checked)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          value={p.reference}
                          onChange={(e) => updateProduct(i, "reference", e.target.value)}
                          className="h-7 font-mono text-xs w-28"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          value={p.name}
                          onChange={(e) => updateProduct(i, "name", e.target.value)}
                          className="h-7 text-xs min-w-[200px]"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Input
                          type="number"
                          value={p.price}
                          onChange={(e) => updateProduct(i, "price", Number(e.target.value))}
                          className="h-7 text-xs w-32 text-right ml-auto"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          value={p.price_label}
                          onChange={(e) => updateProduct(i, "price_label", e.target.value)}
                          className="h-7 text-xs w-28"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => setProducts(products.filter((_, idx) => idx !== i))}
                          className="text-zinc-300 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {done && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-4 rounded-lg border border-green-200 bg-green-50 p-4">
            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-green-800">Importación completada</p>
              <p className="text-sm text-green-600">Los productos ya están disponibles en el catálogo.</p>
            </div>
            <div className="flex gap-2">
              {selectedFile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExtractImages}
                  disabled={extractingImages}
                  className="gap-1.5"
                >
                  {extractingImages ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {extractImageProgress ? `Pág. ${extractImageProgress.page}/${extractImageProgress.total}` : "Extrayendo…"}</>
                  ) : (
                    <><ImageIcon className="h-3.5 w-3.5" /> Extraer fotos del PDF</>
                  )}
                </Button>
              )}
              <Link href="/admin/catalogo">
                <Button variant="outline" size="sm">Ver catálogo</Button>
              </Link>
            </div>
          </div>

          {/* Extracted images from PDF → send to photo generator */}
          {showImageExtractor && extractedImages.length > 0 && (
            <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="font-semibold text-zinc-800">{extractedImages.length} imágenes extraídas del PDF</p>
                    <p className="text-xs text-zinc-500">Revisá cuáles son fotos de productos y generá las 3 versiones para el catálogo</p>
                  </div>
                </div>
                <Link href="/admin/fotos">
                  <Button className="gap-2 bg-orange-500 hover:bg-orange-600">
                    <Sparkles className="h-4 w-4" /> Ir al generador de fotos
                  </Button>
                </Link>
              </div>

              {/* Grid preview */}
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                {extractedImages.map((img, i) => (
                  <div key={i} className="relative">
                    <div className="aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-white">
                      <img src={img.dataUrl} alt={`Imagen ${i + 1}`} className="h-full w-full object-contain p-1" />
                    </div>
                    <div className="absolute top-1 right-1">
                      <span className={`inline-block h-2 w-2 rounded-full ${
                        img.quality === "high" ? "bg-green-400" :
                        img.quality === "medium" ? "bg-yellow-400" : "bg-red-400"
                      }`} title={`Calidad: ${img.quality}`} />
                    </div>
                    <p className="mt-0.5 text-center text-[10px] text-zinc-400">p.{img.pageNumber}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-400 inline-block" /> Alta calidad</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-400 inline-block" /> Calidad media</span>
                <span className="text-zinc-400">· Las de baja calidad se omiten</span>
              </div>

              <p className="text-xs text-zinc-500 bg-white rounded-lg border border-zinc-200 p-3">
                💡 <strong>Siguiente paso:</strong> Andá a <strong>Fotos con IA</strong> en el menú lateral, subí las fotos de mayor calidad del proveedor (o las que extrajiste del PDF) y el sistema genera automáticamente las 3 versiones para el catálogo y las asigna al producto.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
