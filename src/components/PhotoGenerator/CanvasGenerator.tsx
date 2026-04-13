"use client";

import { useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Sparkles,
  Download,
  CheckCircle,
  Loader2,
  X,
  Image as ImageIcon,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { generateProductPhotos, blobToDataUrl } from "@/lib/canvas-photo";
import JSZip from "jszip";
import { saveAs } from "file-saver";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PhotoResult {
  hero: string;      // data URL
  detail: string;
  dynamic: string;
  heroBlob: Blob;
  detailBlob: Blob;
  dynamicBlob: Blob;
}

interface QueueItem {
  id: string;
  file: File;
  previewUrl: string;
  productName: string;
  productId?: string;
  status: "pending" | "processing" | "done" | "error";
  step?: string;
  result?: PhotoResult;
  error?: string;
}

// ── Single product panel ──────────────────────────────────────────────────────
function SingleGenerator() {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<PhotoResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [products, setProducts] = useState<{ id: string; name: string; reference: string }[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("none");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load products for assignment
  useState(() => {
    supabase
      .from("products")
      .select("id, name, reference")
      .order("name")
      .then(({ data }) => setProducts(data ?? []));
  });

  const loadFile = (f: File) => {
    if (!f.type.startsWith("image/")) { toast.error("Solo se aceptan imágenes"); return; }
    setFile(f);
    setResult(null);
    setSaved(false);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  }, []);

  const handleGenerate = async () => {
    if (!file || !preview) return;
    setGenerating(true);
    setResult(null);
    setSaved(false);
    try {
      const { hero, detail, dynamic } = await generateProductPhotos(preview, setStep);
      const [heroUrl, detailUrl, dynamicUrl] = await Promise.all([
        blobToDataUrl(hero),
        blobToDataUrl(detail),
        blobToDataUrl(dynamic),
      ]);
      setResult({ hero: heroUrl, detail: detailUrl, dynamic: dynamicUrl, heroBlob: hero, detailBlob: detail, dynamicBlob: dynamic });
      toast.success("¡3 fotos generadas! ✨");
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setGenerating(false);
      setStep("");
    }
  };

  const handleSaveToProduct = async () => {
    if (!result || selectedProduct === "none") { toast.error("Seleccioná un producto"); return; }
    setSaving(true);
    try {
      const uploads = [
        { blob: result.heroBlob, suffix: "hero" },
        { blob: result.detailBlob, suffix: "detail" },
        { blob: result.dynamicBlob, suffix: "dynamic" },
      ];
      for (let i = 0; i < uploads.length; i++) {
        const { blob, suffix } = uploads[i];
        const path = `${selectedProduct}/${suffix}-${Date.now()}.jpg`;
        await supabase.storage.from("products").upload(path, blob, { contentType: "image/jpeg", upsert: false });
        await supabase.from("product_images").insert({
          product_id: selectedProduct,
          storage_path: path,
          alt_text: `Foto ${suffix}`,
          is_primary: i === 0,
          display_order: i,
        });
      }
      setSaved(true);
      toast.success("3 fotos guardadas en el producto ✓");
    } catch (err: any) {
      toast.error("Error al guardar: " + err.message);
    }
    setSaving(false);
  };

  const handleDownload = () => {
    if (!result) return;
    const name = file?.name.replace(/\.[^.]+$/, "") ?? "producto";
    [
      { url: result.hero, s: "hero" },
      { url: result.detail, s: "detalle" },
      { url: result.dynamic, s: "dinamica" },
    ].forEach(({ url, s }) => {
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}-${s}.jpg`;
      a.click();
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* LEFT: upload + controls */}
      <div className="space-y-4">
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !preview && fileRef.current?.click()}
          className={`relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all ${
            dragging ? "border-orange-400 bg-orange-50" :
            preview ? "border-zinc-200 bg-zinc-50 cursor-default" :
            "border-zinc-300 bg-zinc-50 hover:border-orange-300 hover:bg-orange-50/50"
          }`}
        >
          {preview ? (
            <div className="relative w-full p-3">
              <img src={preview} alt="preview" className="mx-auto max-h-48 rounded-lg object-contain" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setPreview(""); setFile(null); setResult(null); }}
                className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                className="mt-1 block mx-auto text-xs text-orange-600 hover:underline"
              >
                Cambiar imagen
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
                <Upload className="h-6 w-6 text-orange-500" />
              </div>
              <p className="font-medium text-zinc-700">Arrastra la foto del proveedor</p>
              <p className="text-sm text-zinc-500">JPG, PNG, WebP · sin límite de tamaño</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />
        </div>

        {/* Product selector */}
        <div>
          <label className="text-xs font-medium text-zinc-600 mb-1.5 block">Asignar al producto (opcional)</label>
          <Select value={selectedProduct} onValueChange={(v) => setSelectedProduct(v ?? "none")}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar producto…" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="none">No asignar ahora</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="font-mono text-xs text-zinc-400 mr-2">{p.reference}</span>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Generate button */}
        {generating ? (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-orange-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">{step || "Procesando…"}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-orange-100 overflow-hidden">
              <div className="h-full w-2/3 bg-orange-400 rounded-full animate-pulse" />
            </div>
            <p className="text-xs text-orange-500">Corre 100% en el navegador · sin costos ✓</p>
          </div>
        ) : (
          <Button
            onClick={handleGenerate}
            disabled={!preview}
            className="w-full h-12 text-base gap-2 bg-orange-500 hover:bg-orange-600"
          >
            <Sparkles className="h-5 w-5" />
            Generar 3 fotos profesionales
          </Button>
        )}

        {/* Style explanation */}
        <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 space-y-2">
          {[
            { label: "Hero", desc: "Producto centrado con reflejo suave · foto principal del catálogo" },
            { label: "Detalle", desc: "Zoom al área más interesante · tapa, logo, textura" },
            { label: "Dinámica", desc: "Composición editorial con leve rotación · ángulo alternativo" },
          ].map((s) => (
            <div key={s.label} className="flex items-start gap-2">
              <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">{s.label}</Badge>
              <p className="text-xs text-zinc-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: results */}
      <div className="space-y-4">
        {result ? (
          <>
            <p className="text-sm font-semibold text-zinc-700">Resultado — 3 fotos 1200×1200</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { url: result.hero, label: "Hero" },
                { url: result.detail, label: "Detalle" },
                { url: result.dynamic, label: "Dinámica" },
              ].map(({ url, label }) => (
                <div key={label} className="space-y-1">
                  <div className="aspect-square overflow-hidden rounded-xl border border-zinc-200">
                    <img src={url} alt={label} className="h-full w-full object-cover" />
                  </div>
                  <p className="text-center text-xs text-zinc-500">{label}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleDownload} variant="outline" className="flex-1 gap-2">
                <Download className="h-4 w-4" /> Descargar 3 fotos
              </Button>
              {selectedProduct !== "none" && (
                <Button
                  onClick={handleSaveToProduct}
                  disabled={saving || saved}
                  className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                >
                  {saved ? (
                    <><CheckCircle className="h-4 w-4" /> Guardadas</>
                  ) : saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</>
                  ) : (
                    "Guardar en producto"
                  )}
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 text-center p-8">
            <ImageIcon className="h-10 w-10 text-zinc-200 mb-3" />
            <p className="text-sm text-zinc-400">Las 3 fotos aparecerán aquí</p>
            <p className="text-xs text-zinc-300 mt-1">Fondo degradado gris · 1200×1200 px · JPG</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Batch panel ───────────────────────────────────────────────────────────────
function BatchGenerator() {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!arr.length) { toast.error("Solo imágenes"); return; }
    const items: QueueItem[] = arr.map((f) => ({
      id: `${Date.now()}-${Math.random()}`,
      file: f,
      previewUrl: URL.createObjectURL(f),
      productName: f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      status: "pending",
    }));
    setQueue((prev) => [...prev, ...items]);
    toast.success(`${arr.length} imagen(es) añadidas`);
  };

  const updateItem = (id: string, patch: Partial<QueueItem>) =>
    setQueue((prev) => prev.map((i) => i.id === id ? { ...i, ...patch } : i));

  const processOne = async (item: QueueItem) => {
    updateItem(item.id, { status: "processing", step: "Eliminando fondo…" });
    try {
      const dataUrl = await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = (e) => res(e.target?.result as string);
        r.readAsDataURL(item.file);
      });
      const photos = await generateProductPhotos(dataUrl, (step) => updateItem(item.id, { step }));
      const [heroUrl, detailUrl, dynamicUrl] = await Promise.all([
        blobToDataUrl(photos.hero),
        blobToDataUrl(photos.detail),
        blobToDataUrl(photos.dynamic),
      ]);
      updateItem(item.id, {
        status: "done",
        result: { hero: heroUrl, detail: detailUrl, dynamic: dynamicUrl, heroBlob: photos.hero, detailBlob: photos.detail, dynamicBlob: photos.dynamic },
      });

      // Auto-save if product ID assigned
      if (item.productId) {
        const uploads = [
          { blob: photos.hero, suffix: "hero", primary: true, order: 0 },
          { blob: photos.detail, suffix: "detail", primary: false, order: 1 },
          { blob: photos.dynamic, suffix: "dynamic", primary: false, order: 2 },
        ];
        for (const u of uploads) {
          const path = `${item.productId}/${u.suffix}-${Date.now()}.jpg`;
          await supabase.storage.from("products").upload(path, u.blob, { contentType: "image/jpeg" });
          await supabase.from("product_images").insert({ product_id: item.productId, storage_path: path, is_primary: u.primary, display_order: u.order, alt_text: `Foto ${u.suffix}` });
        }
      }
    } catch (err: any) {
      updateItem(item.id, { status: "error", error: err.message });
    }
  };

  const handleRun = async () => {
    const pending = queue.filter((i) => i.status === "pending" || i.status === "error");
    if (!pending.length) { toast.error("No hay imágenes pendientes"); return; }
    setRunning(true);
    // Process sequentially to avoid memory issues with background removal
    for (const item of pending) {
      await processOne(item);
    }
    setRunning(false);
    toast.success("¡Lote completado!");
  };

  const handleDownloadAll = async () => {
    const done = queue.filter((i) => i.status === "done" && i.result);
    if (!done.length) { toast.error("No hay fotos generadas"); return; }
    toast.info("Preparando ZIP…");
    const zip = new JSZip();
    for (const item of done) {
      const name = item.productName.replace(/\s+/g, "-");
      zip.file(`${name}-hero.jpg`, item.result!.heroBlob);
      zip.file(`${name}-detalle.jpg`, item.result!.detailBlob);
      zip.file(`${name}-dinamica.jpg`, item.result!.dynamicBlob);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `fotos-catalogo-${Date.now()}.zip`);
  };

  const done = queue.filter((i) => i.status === "done").length;
  const pending = queue.filter((i) => i.status === "pending" || i.status === "error").length;

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all ${
          dragging ? "border-orange-400 bg-orange-50" : "border-zinc-300 bg-zinc-50 hover:border-orange-300 hover:bg-orange-50/50"
        }`}
      >
        <div className="flex flex-col items-center gap-2 p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
            <Upload className="h-5 w-5 text-orange-500" />
          </div>
          <p className="font-medium text-sm text-zinc-700">Arrastra múltiples fotos del proveedor</p>
          <p className="text-xs text-zinc-500">Se generan 3 fotos por producto · todo en el navegador</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); }} />
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
        💡 Nombrá los archivos con la referencia del producto (ej: <code className="bg-blue-100 px-1 rounded">TM-2201.jpg</code>) para identificarlos. El proceso puede tomar 15-30 seg por foto.
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <div className="space-y-2">
          {/* Progress bar */}
          {done > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-zinc-500">
                <span>{done} de {queue.length} completadas</span>
                <span>{done * 3} fotos generadas</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                <div className="h-full bg-orange-500 transition-all" style={{ width: `${(done / queue.length) * 100}%` }} />
              </div>
            </div>
          )}

          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {queue.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-2.5">
                {/* Thumbnail: show result if done, otherwise source */}
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-zinc-50">
                  {item.status === "done" && item.result ? (
                    <img src={item.result.hero} className="h-full w-full object-cover" alt="hero" />
                  ) : (
                    <img src={item.previewUrl} className="h-full w-full object-contain p-1" alt="src" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.productName}</p>
                  {item.status === "processing" && (
                    <p className="text-xs text-orange-500 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> {item.step}
                    </p>
                  )}
                  {item.status === "error" && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {item.error}
                    </p>
                  )}
                  {item.status === "done" && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> 3 fotos listas
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {item.status === "done" && item.result && (
                    <button
                      onClick={() => {
                        const name = item.productName.replace(/\s+/g, "-");
                        const a = document.createElement("a");
                        a.href = item.result!.hero;
                        a.download = `${name}-hero.jpg`;
                        a.click();
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 hover:bg-zinc-50"
                      title="Descargar hero"
                    >
                      <Download className="h-3.5 w-3.5 text-zinc-500" />
                    </button>
                  )}
                  <button
                    onClick={() => setQueue((prev) => prev.filter((i) => i.id !== item.id))}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 hover:bg-red-50"
                  >
                    <X className="h-3.5 w-3.5 text-zinc-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {queue.length > 0 && (
        <div className="flex gap-3">
          <Button
            onClick={handleRun}
            disabled={running || pending === 0}
            className="flex-1 gap-2 bg-orange-500 hover:bg-orange-600"
          >
            {running ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Procesando…</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Generar {pending} producto(s)</>
            )}
          </Button>
          {done > 0 && (
            <Button variant="outline" onClick={handleDownloadAll} className="gap-2">
              <Download className="h-4 w-4" /> ZIP ({done * 3} fotos)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main exported component ───────────────────────────────────────────────────
interface Props {
  mode?: "single" | "batch";
  // Pre-loaded images from PDF extraction
  preloadedImages?: Array<{ dataUrl: string; productName?: string; productId?: string }>;
}

export function CanvasGenerator({ mode = "single", preloadedImages }: Props) {
  const [activeMode, setActiveMode] = useState<"single" | "batch">(
    preloadedImages?.length ? "batch" : mode
  );

  return (
    <div className="space-y-5">
      {/* Mode selector */}
      <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
        {(["single", "batch"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setActiveMode(m)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
              activeMode === m
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {m === "single" ? "Individual" : "Lote"}
          </button>
        ))}
      </div>

      {activeMode === "single" ? <SingleGenerator /> : <BatchGenerator />}
    </div>
  );
}
