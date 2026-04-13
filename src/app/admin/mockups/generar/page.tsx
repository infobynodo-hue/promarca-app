"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Upload, Loader2, Download, Wand2, X, ImageOff } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import JSZip from "jszip";
import { saveAs } from "file-saver";

interface Template {
  id: string;
  name: string;
  marking_type: string;
  mockup_template_images: {
    id: string;
    storage_path: string;
    display_order: number;
    zone_x: number;
    zone_y: number;
    zone_width: number;
    zone_height: number;
    zone_rotation: number;
  }[];
}

interface ProductOption {
  id: string;
  name: string;
  reference: string;
  mockup_templates: Template[];
}

// Composite: draw base image + logo at zone position
async function compositeImage(
  baseUrl: string,
  logoImg: HTMLImageElement,
  zone: { zone_x: number; zone_y: number; zone_width: number; zone_height: number; zone_rotation: number },
  logoScale: number // 0.1 – 2.0
): Promise<string> {
  return new Promise((resolve, reject) => {
    const base = new Image();
    base.crossOrigin = "anonymous";
    base.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = base.naturalWidth;
      canvas.height = base.naturalHeight;
      const ctx = canvas.getContext("2d")!;

      // Draw background image
      ctx.drawImage(base, 0, 0);

      // Calculate zone in pixels
      const zx = (zone.zone_x / 100) * base.naturalWidth;
      const zy = (zone.zone_y / 100) * base.naturalHeight;
      const zw = (zone.zone_width / 100) * base.naturalWidth * logoScale;
      const zh = (zone.zone_height / 100) * base.naturalHeight * logoScale;

      // Maintain logo aspect ratio within zone
      const logoAspect = logoImg.naturalWidth / logoImg.naturalHeight;
      const zoneAspect = zw / zh;
      let drawW = zw;
      let drawH = zh;
      if (logoAspect > zoneAspect) {
        drawH = zw / logoAspect;
      } else {
        drawW = zh * logoAspect;
      }

      const cx = zx + (zone.zone_width / 100 * base.naturalWidth) / 2;
      const cy = zy + (zone.zone_height / 100 * base.naturalHeight) / 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((zone.zone_rotation * Math.PI) / 180);
      ctx.drawImage(logoImg, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      resolve(canvas.toDataURL("image/png", 1.0));
    };
    base.onerror = reject;
    base.src = baseUrl;
  });
}

function GenerarContent() {
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState(searchParams.get("producto") ?? "");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [removingBg, setRemovingBg] = useState(false);
  const [logoScale, setLogoScale] = useState(1.0);
  const [previews, setPreviews] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    supabase
      .from("products")
      .select("id, name, reference, mockup_templates(id, name, marking_type, mockup_template_images(*))")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setProducts((data as any) ?? []));
  }, []);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const selectedTemplate = selectedProduct?.mockup_templates.find(
    (t) => t.id === selectedTemplateId
  );

  const getUrl = (path: string) =>
    supabase.storage.from("mockups").getPublicUrl(path).data.publicUrl;

  // ── Handle logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setPreviews([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoDataUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // ── Remove background
  const handleRemoveBg = async () => {
    if (!logoFile) return;
    setRemovingBg(true);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(logoFile);
      const url = URL.createObjectURL(blob);
      setLogoDataUrl(url);
      toast.success("Fondo eliminado");
    } catch {
      toast.error("Error al eliminar fondo. Intenta con un PNG con fondo sólido.");
    } finally {
      setRemovingBg(false);
    }
  };

  // Load logo into img element for canvas compositing
  const loadLogoImg = useCallback((): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      if (!logoDataUrl) { reject("No logo"); return; }
      const img = new Image();
      img.onload = () => { logoImgRef.current = img; resolve(img); };
      img.onerror = reject;
      img.src = logoDataUrl;
    });
  }, [logoDataUrl]);

  // ── Generate previews
  const handleGenerate = async () => {
    if (!selectedTemplate || !logoDataUrl) {
      toast.error("Seleccioná un producto, plantilla y subí el logo");
      return;
    }
    setGenerating(true);
    setPreviews([]);

    try {
      const logoImg = await loadLogoImg();
      const sorted = [...selectedTemplate.mockup_template_images].sort(
        (a, b) => a.display_order - b.display_order
      );

      const results: string[] = [];
      for (const img of sorted) {
        const dataUrl = await compositeImage(getUrl(img.storage_path), logoImg, img, logoScale);
        results.push(dataUrl);
      }
      setPreviews(results);
      toast.success(`${results.length} mockups generados`);
    } catch (err) {
      console.error(err);
      toast.error("Error al generar mockups");
    } finally {
      setGenerating(false);
    }
  };

  // ── Download ZIP
  const handleDownload = async () => {
    if (!previews.length) return;
    setDownloading(true);
    const zip = new JSZip();
    const productRef = selectedProduct?.reference ?? "producto";
    const templateName = selectedTemplate?.name ?? "mockup";

    previews.forEach((dataUrl, i) => {
      const base64 = dataUrl.split(",")[1];
      zip.file(`${productRef}_${templateName}_${i + 1}.png`, base64, { base64: true });
    });

    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `mockups_${productRef}_${templateName}.zip`);
    setDownloading(false);
  };

  return (
    <>
      <div className="flex items-center gap-4">
        <Link href="/admin/mockups">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Generar mockup</h1>
          <p className="text-sm text-zinc-500">
            Subí el logo del cliente y generá las imágenes del producto en segundos
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Left panel — config */}
        <div className="space-y-4">
          {/* Step 1: Product */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
                1. Producto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={selectedProductId} onValueChange={(v) => { setSelectedProductId(v ?? ""); setSelectedTemplateId(""); setPreviews([]); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="font-mono text-xs text-zinc-400 mr-2">{p.reference}</span>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedProduct && selectedProduct.mockup_templates.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-zinc-500 font-medium">Tipo de marcación</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProduct.mockup_templates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => { setSelectedTemplateId(t.id); setPreviews([]); }}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          selectedTemplateId === t.id
                            ? "border-orange-500 bg-orange-500 text-white"
                            : "border-zinc-200 text-zinc-600 hover:border-orange-300"
                        }`}
                      >
                        {t.name}
                        <span className="ml-1 opacity-60">· {t.marking_type}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedProduct && selectedProduct.mockup_templates.length === 0 && (
                <p className="text-xs text-zinc-400">
                  Este producto no tiene plantillas.{" "}
                  <Link href={`/admin/mockups/${selectedProduct.id}`} className="text-orange-500 hover:underline">
                    Agregar
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Logo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
                2. Logo del cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoUpload}
              />

              {!logoDataUrl ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-200 p-6 cursor-pointer hover:border-orange-300 hover:bg-orange-50/50 transition-colors"
                >
                  <Upload className="h-6 w-6 text-zinc-300" />
                  <p className="text-xs text-zinc-400 text-center">
                    PNG, JPG, WEBP<br />
                    <span className="text-zinc-300">PNG transparente = mejor resultado</span>
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                    <img
                      src={logoDataUrl}
                      alt="Logo"
                      className="mx-auto max-h-20 object-contain"
                      style={{ background: "repeating-conic-gradient(#ddd 0% 25%, white 0% 50%) 0 0 / 12px 12px" }}
                    />
                    <button
                      onClick={() => { setLogoDataUrl(null); setLogoFile(null); setPreviews([]); }}
                      className="absolute top-1 right-1 rounded-full bg-white border border-zinc-200 p-0.5 hover:bg-zinc-100"
                    >
                      <X className="h-3 w-3 text-zinc-500" />
                    </button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleRemoveBg}
                    disabled={removingBg}
                  >
                    {removingBg ? (
                      <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Eliminando fondo...</>
                    ) : (
                      <><Wand2 className="mr-1 h-3 w-3" /> Eliminar fondo (IA)</>
                    )}
                  </Button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full text-xs text-zinc-400 hover:text-zinc-600 text-center"
                  >
                    Cambiar logo
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Scale */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
                3. Tamaño del logo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-6">S</span>
                <input
                  type="range"
                  min={0.3}
                  max={2.0}
                  step={0.05}
                  value={logoScale}
                  onChange={(e) => { setLogoScale(Number(e.target.value)); setPreviews([]); }}
                  className="flex-1"
                />
                <span className="text-xs text-zinc-400 w-6 text-right">XL</span>
              </div>
              <p className="text-center text-xs text-zinc-400">{Math.round(logoScale * 100)}% del tamaño base</p>
            </CardContent>
          </Card>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={!selectedTemplateId || !logoDataUrl || generating}
            className="w-full"
            size="lg"
          >
            {generating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando...</>
            ) : (
              <><Wand2 className="mr-2 h-4 w-4" /> Generar mockups</>
            )}
          </Button>

          {previews.length > 0 && (
            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={downloading}
              className="w-full"
              size="lg"
            >
              {downloading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparando ZIP...</>
              ) : (
                <><Download className="mr-2 h-4 w-4" /> Descargar {previews.length} imágenes (.zip)</>
              )}
            </Button>
          )}
        </div>

        {/* Right panel — previews */}
        <div className="lg:col-span-2">
          {previews.length === 0 ? (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 text-zinc-300">
              <ImageOff className="h-12 w-12 mb-3" />
              <p className="text-sm">Los mockups aparecerán aquí</p>
              {selectedTemplate && (
                <Badge variant="secondary" className="mt-2 text-xs">
                  {selectedTemplate.mockup_template_images.length} imágenes listas
                </Badge>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {previews.map((src, i) => (
                <div key={i} className="group relative">
                  <div className="aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm">
                    <img
                      src={src}
                      alt={`Mockup ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <a
                    href={src}
                    download={`mockup_${i + 1}.png`}
                    className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Download className="h-6 w-6 text-white" />
                  </a>
                  <span className="absolute bottom-2 left-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {i + 1}/{previews.length}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function GenerarPage() {
  return (
    <Suspense>
      <GenerarContent />
    </Suspense>
  );
}
