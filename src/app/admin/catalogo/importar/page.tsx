"use client";

import { useRef, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Upload, Loader2, CheckCircle2, Trash2, FileText,
  AlertCircle, Sparkles, ImageIcon, RefreshCw, SkipForward,
  X, ChevronRight, PackageOpen,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { extractImagesFromPDF, type ExtractedImage } from "@/lib/pdf-image-extractor";
import { generateProductPhotos, blobToDataUrl } from "@/lib/canvas-photo";

// ── Types ─────────────────────────────────────────────────────────────────────
interface WorkingProduct {
  reference: string;
  name: string;
  price: number;
  price_label: string;
  description: string | null;
  _include: boolean;
  _imageDataUrl: string | null;      // image matched from PDF
  _generating: boolean;
  _generated: boolean;
  _heroBlob: Blob | null;
  _detailBlob: Blob | null;
  _dynamicBlob: Blob | null;
  _heroUrl: string | null;           // preview data URL
  _genStep: string;
  _genError: string | null;
}

type Phase = "upload" | "extracting" | "review" | "generating" | "importing" | "done";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ImportarPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("none");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("upload");
  const [extractError, setExtractError] = useState<string | null>(null);

  const [products, setProducts] = useState<WorkingProduct[]>([]);
  const [extractedImages, setExtractedImages] = useState<ExtractedImage[]>([]);

  // Image reassign picker
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  // Duplicate handling
  const [duplicateMode, setDuplicateMode] = useState<"skip" | "update">("skip");
  const [duplicateRefs, setDuplicateRefs] = useState<string[]>([]);

  // Done summary
  const [importSummary, setImportSummary] = useState<{
    created: number; updated: number; skipped: number; noImage: string[];
  } | null>(null);

  useEffect(() => {
    supabase.from("categories").select("*").order("display_order")
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  // ── Step 1: Extract ─────────────────────────────────────────────────────────
  const handleExtract = async () => {
    if (!selectedFile) return;
    setPhase("extracting");
    setExtractError(null);

    // Run text extraction + image extraction in parallel
    const [textResult, imageResult] = await Promise.allSettled([
      extractText(selectedFile),
      extractImages(selectedFile),
    ]);

    const textProducts: any[] = textResult.status === "fulfilled" ? textResult.value : [];
    const images: ExtractedImage[] = imageResult.status === "fulfilled" ? imageResult.value : [];

    if (textResult.status === "rejected") {
      setExtractError("No se pudieron extraer los productos del PDF. Intenta de nuevo.");
      setPhase("upload");
      return;
    }
    if (!textProducts.length) {
      setExtractError("No se encontraron productos en el PDF.");
      setPhase("upload");
      return;
    }

    setExtractedImages(images);

    // Auto-match: zip products with images by order
    // Filter to best quality images only
    const goodImages = images.filter((i) => i.quality !== "low");

    const working: WorkingProduct[] = textProducts.map((p: any, idx: number) => ({
      reference: p.reference ?? "",
      name: p.name ?? "",
      price: Number(p.price) || 0,
      price_label: p.price_label ?? "Sin marca",
      description: p.description ?? null,
      _include: true,
      _imageDataUrl: goodImages[idx]?.dataUrl ?? null,
      _generating: false,
      _generated: false,
      _heroBlob: null,
      _detailBlob: null,
      _dynamicBlob: null,
      _heroUrl: null,
      _genStep: "",
      _genError: null,
    }));

    setProducts(working);
    setPhase("review");
    toast.success(`${textProducts.length} productos · ${goodImages.length} imágenes capturadas`);
  };

  const extractText = async (file: File): Promise<any[]> => {
    const formData = new FormData();
    formData.append("pdf", file);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const res = await fetch(`${supabaseUrl}/functions/v1/import-pdf`, {
      method: "POST", body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Error al procesar PDF");
    return data.products ?? [];
  };

  const extractImages = async (file: File): Promise<ExtractedImage[]> => {
    try {
      return await extractImagesFromPDF(file);
    } catch {
      return [];
    }
  };

  // ── Step 2: Reassign image ──────────────────────────────────────────────────
  const assignImage = (productIdx: number, imageDataUrl: string | null) => {
    setProducts((prev) => prev.map((p, i) =>
      i === productIdx ? { ...p, _imageDataUrl: imageDataUrl, _generated: false, _heroUrl: null } : p
    ));
    setPickerIndex(null);
  };

  const updateProduct = (i: number, field: keyof WorkingProduct, value: any) => {
    setProducts((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  };

  // ── Step 3: Generate photos ────────────────────────────────────────────────
  const handleGenerate = async () => {
    const toGenerate = products.filter((p) => p._include && p._imageDataUrl && !p._generated);
    if (!toGenerate.length) {
      toast.error("No hay productos con imagen para generar");
      return;
    }
    setPhase("generating");

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!p._include || !p._imageDataUrl || p._generated) continue;

      setProducts((prev) => prev.map((x, idx) =>
        idx === i ? { ...x, _generating: true, _genStep: "Iniciando…", _genError: null } : x
      ));

      try {
        const photos = await generateProductPhotos(p._imageDataUrl, (step) => {
          setProducts((prev) => prev.map((x, idx) =>
            idx === i ? { ...x, _genStep: step } : x
          ));
        });

        const heroUrl = await blobToDataUrl(photos.hero);

        setProducts((prev) => prev.map((x, idx) =>
          idx === i ? {
            ...x,
            _generating: false,
            _generated: true,
            _heroBlob: photos.hero,
            _detailBlob: photos.detail,
            _dynamicBlob: photos.dynamic,
            _heroUrl: heroUrl,
            _genStep: "",
          } : x
        ));
      } catch (err: any) {
        setProducts((prev) => prev.map((x, idx) =>
          idx === i ? { ...x, _generating: false, _genError: err.message, _genStep: "" } : x
        ));
      }
    }

    setPhase("review");
    toast.success("¡Fotos generadas! Revisá el resultado y luego importa.");
  };

  // ── Step 4: Import ──────────────────────────────────────────────────────────
  const handleImport = async () => {
    const toImport = products.filter((p) => p._include);
    if (!toImport.length) { toast.error("Seleccioná al menos un producto"); return; }

    setPhase("importing");

    const refs = toImport.map((p) => p.reference.trim().toUpperCase());

    // Detect existing
    const { data: existing } = await supabase
      .from("products").select("id, reference").in("reference", refs);
    const existingMap: Record<string, string> = {};
    for (const row of existing ?? []) existingMap[row.reference] = row.id;
    const dupes = refs.filter((r) => existingMap[r]);
    setDuplicateRefs(dupes);

    const newProds  = toImport.filter((p) => !existingMap[p.reference.trim().toUpperCase()]);
    const dupeProds = toImport.filter((p) =>  existingMap[p.reference.trim().toUpperCase()]);

    const idMap: Record<string, string> = { ...existingMap };

    // Insert new
    if (newProds.length > 0) {
      const { data: inserted, error } = await supabase
        .from("products")
        .insert(newProds.map((p) => ({
          reference: p.reference.trim().toUpperCase(),
          name: p.name.trim(),
          description: p.description || null,
          price: p.price,
          price_label: p.price_label || "Sin marca",
          category_id: selectedCategory !== "none" ? selectedCategory : null,
          is_active: true,
        })))
        .select("id, reference");
      if (error) {
        toast.error("Error al importar: " + error.message);
        setPhase("review");
        return;
      }
      for (const row of inserted ?? []) idMap[row.reference] = row.id;
    }

    // Update duplicates if mode = update
    if (duplicateMode === "update") {
      for (const p of dupeProds) {
        const ref = p.reference.trim().toUpperCase();
        if (!existingMap[ref]) continue;
        await supabase.from("products").update({
          name: p.name.trim(),
          price: p.price,
          price_label: p.price_label || "Sin marca",
          description: p.description || null,
          category_id: selectedCategory !== "none" ? selectedCategory : null,
          updated_at: new Date().toISOString(),
        }).eq("id", existingMap[ref]);
      }
    }

    // Upload generated photos
    for (const p of toImport) {
      const ref = p.reference.trim().toUpperCase();
      const productId = idMap[ref];
      if (!productId || !p._heroBlob || !p._detailBlob || !p._dynamicBlob) continue;

      const uploads = [
        { blob: p._heroBlob,    suffix: "hero",    primary: true,  order: 0 },
        { blob: p._detailBlob,  suffix: "detail",  primary: false, order: 1 },
        { blob: p._dynamicBlob, suffix: "dynamic", primary: false, order: 2 },
      ];
      for (const u of uploads) {
        const path = `${productId}/${u.suffix}-${Date.now()}.jpg`;
        await supabase.storage.from("products").upload(path, u.blob, { contentType: "image/jpeg" });
        await supabase.from("product_images").insert({
          product_id: productId,
          storage_path: path,
          is_primary: u.primary,
          display_order: u.order,
          alt_text: `Foto ${u.suffix}`,
        });
      }
    }

    // Summary
    const noImage = toImport
      .filter((p) => !p._generated)
      .map((p) => `${p.reference} — ${p.name}`);

    const skipped = duplicateMode === "skip" ? dupeProds.length : 0;
    const updated  = duplicateMode === "update" ? dupeProds.length : 0;

    setImportSummary({
      created: newProds.length,
      updated,
      skipped,
      noImage,
    });

    setPhase("done");
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const includedCount   = products.filter((p) => p._include).length;
  const withImage       = products.filter((p) => p._include && p._imageDataUrl).length;
  const withGenerated   = products.filter((p) => p._include && p._generated).length;
  const withoutImage    = products.filter((p) => p._include && !p._imageDataUrl).length;

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex items-center gap-4">
        <Link href="/admin/catalogo">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Importar productos desde PDF</h1>
          <p className="text-sm text-zinc-500">Sube el catálogo del proveedor — extrae productos e imágenes automáticamente</p>
        </div>
      </div>

      {/* ── PHASE: UPLOAD ── */}
      {(phase === "upload" || phase === "extracting") && (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">1. Seleccionar PDF</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-zinc-200 p-8 cursor-pointer hover:border-orange-300 hover:bg-orange-50/50 transition-colors"
              >
                <FileText className="h-10 w-10 text-zinc-300" />
                {selectedFile ? (
                  <div className="text-center">
                    <p className="font-medium text-sm text-zinc-700">{selectedFile.name}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-medium text-zinc-600">Clic para seleccionar</p>
                    <p className="text-xs text-zinc-400">PDF · hasta 50 MB</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f?.type === "application/pdf") { setSelectedFile(f); setExtractError(null); }
                  else if (f) toast.error("Solo se aceptan archivos PDF");
                }}
              />
            </CardContent>
          </Card>

          {/* Category */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">2. Categoría (opcional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-zinc-400">Todos los productos importados quedarán en esta categoría. Puedes cambiarla después.</p>
              <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v ?? "none")}>
                <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Extract */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">3. Extraer todo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-zinc-400">
                Se extraen <strong>productos</strong> (nombre, ref, precio) e <strong>imágenes</strong> al mismo tiempo.
              </p>
              <Button onClick={handleExtract} disabled={!selectedFile || phase === "extracting"} className="w-full">
                {phase === "extracting" ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Extrayendo...</>
                ) : (
                  <><Upload className="mr-2 h-4 w-4" />Extraer productos e imágenes</>
                )}
              </Button>
              {phase === "extracting" && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin text-orange-500" /> Analizando texto con IA…
                  </p>
                  <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin text-orange-500" /> Extrayendo imágenes del PDF…
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {extractError && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">No se pudo extraer</p>
            <p className="text-sm text-red-600 mt-0.5">{extractError}</p>
          </div>
        </div>
      )}

      {/* ── PHASE: REVIEW + GENERATE + IMPORT ── */}
      {(phase === "review" || phase === "generating" || phase === "importing") && products.length > 0 && (
        <div className="mt-6 space-y-5">

          {/* Stats bar */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="gap-1">{includedCount} productos seleccionados</Badge>
            <Badge className="gap-1 bg-green-100 text-green-700 border-green-200">
              <ImageIcon className="h-3 w-3" /> {withImage} con imagen
            </Badge>
            {withGenerated > 0 && (
              <Badge className="gap-1 bg-orange-100 text-orange-700 border-orange-200">
                <Sparkles className="h-3 w-3" /> {withGenerated} fotos generadas
              </Badge>
            )}
            {withoutImage > 0 && (
              <Badge variant="outline" className="text-zinc-400">
                <PackageOpen className="h-3 w-3 mr-1" /> {withoutImage} sin imagen
              </Badge>
            )}
          </div>

          {/* Duplicate handling */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-amber-800">Si ya existe un producto con la misma referencia:</p>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => setDuplicateMode("skip")}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                  duplicateMode === "skip" ? "border-amber-400 bg-amber-100 text-amber-800" : "border-zinc-200 bg-white text-zinc-500"
                }`}>
                <SkipForward className="h-3.5 w-3.5" /> Omitir — no tocar el existente
              </button>
              <button type="button" onClick={() => setDuplicateMode("update")}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                  duplicateMode === "update" ? "border-orange-400 bg-orange-50 text-orange-700" : "border-zinc-200 bg-white text-zinc-500"
                }`}>
                <RefreshCw className="h-3.5 w-3.5" /> Actualizar — sobreescribir nombre y precio
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 flex-wrap">
            {withImage > withGenerated && (
              <Button
                onClick={handleGenerate}
                disabled={phase === "generating"}
                className="gap-2 bg-orange-500 hover:bg-orange-600"
              >
                {phase === "generating" ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Generando fotos…</>
                ) : (
                  <><Sparkles className="h-4 w-4" />Generar fotos para {withImage - withGenerated} productos</>
                )}
              </Button>
            )}
            <Button
              onClick={handleImport}
              disabled={phase === "generating" || phase === "importing" || includedCount === 0}
              variant={withGenerated === 0 ? "outline" : "default"}
              className="gap-2"
            >
              {phase === "importing" ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Importando…</>
              ) : (
                <>Importar {includedCount} productos {withGenerated > 0 ? `con ${withGenerated} fotos` : "sin fotos"}</>
              )}
            </Button>
          </div>

          {/* Product cards grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p, i) => (
              <div
                key={i}
                className={`rounded-xl border bg-white overflow-hidden transition-all ${
                  !p._include ? "opacity-40" : p._generated ? "border-green-200" : p._imageDataUrl ? "border-orange-200" : "border-zinc-200"
                }`}
              >
                {/* Image area */}
                <div className="relative bg-zinc-50 border-b border-zinc-100" style={{ height: 160 }}>
                  {p._generated && p._heroUrl ? (
                    <img src={p._heroUrl} alt="" className="h-full w-full object-cover" />
                  ) : p._imageDataUrl ? (
                    <img src={p._imageDataUrl} alt="" className="h-full w-full object-contain p-3" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1 text-zinc-300">
                      <PackageOpen className="h-8 w-8" />
                      <p className="text-xs">Sin imagen</p>
                    </div>
                  )}

                  {/* Status badge */}
                  {p._generating && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white text-xs gap-1">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>{p._genStep || "Procesando…"}</span>
                    </div>
                  )}
                  {p._generated && (
                    <div className="absolute top-2 left-2">
                      <span className="flex items-center gap-1 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold text-white">
                        <CheckCircle2 className="h-3 w-3" /> 3 fotos listas
                      </span>
                    </div>
                  )}
                  {p._genError && (
                    <div className="absolute bottom-2 left-2 right-2">
                      <span className="block rounded bg-red-500/90 px-2 py-1 text-[10px] text-white truncate">
                        ⚠ {p._genError}
                      </span>
                    </div>
                  )}

                  {/* Checkmark + image reassign */}
                  <div className="absolute top-2 right-2 flex gap-1">
                    {p._imageDataUrl && !p._generating && (
                      <button
                        onClick={() => setPickerIndex(i)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 border border-zinc-200 hover:bg-zinc-100 transition-colors"
                        title="Cambiar imagen"
                      >
                        <RefreshCw className="h-3 w-3 text-zinc-500" />
                      </button>
                    )}
                    {!p._imageDataUrl && !p._generating && (
                      <button
                        onClick={() => setPickerIndex(i)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                        title="Asignar imagen"
                      >
                        <ImageIcon className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => updateProduct(i, "_include", !p._include)}
                      className={`flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${
                        p._include ? "bg-white/90 border-zinc-200 hover:bg-zinc-100" : "bg-zinc-700 border-zinc-600"
                      }`}
                      title={p._include ? "Excluir" : "Incluir"}
                    >
                      <X className="h-3 w-3 text-zinc-500" />
                    </button>
                  </div>
                </div>

                {/* Product info */}
                <div className="p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-400 font-medium uppercase">Referencia</label>
                      <Input
                        value={p.reference}
                        onChange={(e) => updateProduct(i, "reference", e.target.value.toUpperCase())}
                        className="h-7 font-mono text-xs"
                        disabled={phase === "generating" || phase === "importing"}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 font-medium uppercase">Precio COP</label>
                      <Input
                        type="number"
                        value={p.price}
                        onChange={(e) => updateProduct(i, "price", Number(e.target.value))}
                        className="h-7 text-xs text-right"
                        disabled={phase === "generating" || phase === "importing"}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 font-medium uppercase">Nombre</label>
                    <Input
                      value={p.name}
                      onChange={(e) => updateProduct(i, "name", e.target.value)}
                      className="h-7 text-xs"
                      disabled={phase === "generating" || phase === "importing"}
                    />
                  </div>
                  {p.price > 0 && (
                    <p className="text-[10px] text-zinc-400 text-right">{fmt(p.price)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── IMAGE PICKER MODAL ── */}
      {pickerIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setPickerIndex(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl"
            style={{ maxHeight: "85vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold text-zinc-800">Asignar imagen a producto</p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {products[pickerIndex]?.reference} — {products[pickerIndex]?.name}
                </p>
              </div>
              <button onClick={() => setPickerIndex(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <button
              onClick={() => assignImage(pickerIndex, null)}
              className="mb-3 flex w-full items-center gap-2 rounded-lg border border-dashed border-zinc-200 px-3 py-2 text-sm text-zinc-400 hover:border-red-300 hover:text-red-500 transition-colors"
            >
              <X className="h-4 w-4" /> Quitar imagen (importar sin foto)
            </button>

            {extractedImages.filter((i) => i.quality !== "low").length === 0 ? (
              <p className="text-center text-zinc-400 py-8">No hay imágenes extraídas del PDF</p>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {extractedImages
                  .filter((img) => img.quality !== "low")
                  .map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => assignImage(pickerIndex, img.dataUrl)}
                      className="aspect-square overflow-hidden rounded-lg border-2 border-zinc-200 hover:border-orange-400 transition-all"
                    >
                      <img src={img.dataUrl} alt="" className="h-full w-full object-contain" />
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PHASE: DONE ── */}
      {phase === "done" && importSummary && (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
              <div>
                <p className="font-bold text-green-800">Importación completada</p>
                <p className="text-sm text-green-600 mt-0.5">
                  {[
                    importSummary.created > 0 && `${importSummary.created} productos nuevos`,
                    importSummary.updated > 0 && `${importSummary.updated} actualizados`,
                    importSummary.skipped > 0 && `${importSummary.skipped} omitidos (ya existían)`,
                  ].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            <Link href="/admin/catalogo">
              <Button className="gap-2">
                Ver catálogo <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {importSummary.noImage.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3 mb-3">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800">
                    {importSummary.noImage.length} producto{importSummary.noImage.length > 1 ? "s" : ""} quedaron sin foto
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Puedes subirlas manualmente desde el catálogo o generarlas en Fotos con IA.
                  </p>
                </div>
              </div>
              <div className="rounded-lg bg-white border border-amber-200 divide-y divide-amber-100 max-h-48 overflow-y-auto">
                {importSummary.noImage.map((line, i) => (
                  <p key={i} className="px-3 py-2 text-xs font-mono text-zinc-600">{line}</p>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <Link href="/admin/fotos">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Generar fotos manualmente
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
