"use client";

import { use, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
  Loader2,
  GripVertical,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Rnd } from "react-rnd";

interface Template {
  id: string;
  name: string;
  marking_type: string;
  display_order: number;
  mockup_template_images: TemplateImage[];
}

interface TemplateImage {
  id: string;
  storage_path: string;
  display_order: number;
  zone_x: number;
  zone_y: number;
  zone_width: number;
  zone_height: number;
  zone_rotation: number;
}

const MARKING_TYPES = [
  "1 tinta",
  "2 tintas",
  "Grabado láser",
  "Sublimación",
  "Bordado",
  "Full color",
  "Sin marcación",
];

export default function ProductMockupsPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = use(params);
  const supabase = createClient();

  const [product, setProduct] = useState<any>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  // New template dialog
  const [newTemplateOpen, setNewTemplateOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newMarkingType, setNewMarkingType] = useState(MARKING_TYPES[0]);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Zone editor
  const [editingImage, setEditingImage] = useState<TemplateImage | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [containerSize, setContainerSize] = useState({ w: 600, h: 400 });
  const imgRef = useRef<HTMLImageElement>(null);
  const [zone, setZone] = useState({ x: 0, y: 0, w: 0, h: 0, rotation: 0 });

  // Image uploading
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  const load = async () => {
    const [{ data: prod }, { data: tmpl }] = await Promise.all([
      supabase.from("products").select("id, name, reference").eq("id", productId).single(),
      supabase
        .from("mockup_templates")
        .select("*, mockup_template_images(*)")
        .eq("product_id", productId)
        .order("display_order"),
    ]);
    setProduct(prod);
    setTemplates(
      (tmpl ?? []).map((t: any) => ({
        ...t,
        mockup_template_images: (t.mockup_template_images ?? []).sort(
          (a: any, b: any) => a.display_order - b.display_order
        ),
      }))
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const getUrl = (path: string) =>
    supabase.storage.from("mockups").getPublicUrl(path).data.publicUrl;

  // ── Create template
  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) { toast.error("Pon un nombre"); return; }
    setSavingTemplate(true);
    const { error } = await supabase.from("mockup_templates").insert({
      product_id: productId,
      name: newTemplateName.trim(),
      marking_type: newMarkingType,
      display_order: templates.length,
    });
    if (error) { toast.error(error.message); setSavingTemplate(false); return; }
    toast.success("Plantilla creada");
    setSavingTemplate(false);
    setNewTemplateOpen(false);
    setNewTemplateName("");
    load();
  };

  // ── Delete template
  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("¿Eliminar esta plantilla y todas sus imágenes?")) return;
    // Get images to delete from storage
    const tmpl = templates.find((t) => t.id === id);
    if (tmpl?.mockup_template_images.length) {
      await supabase.storage.from("mockups").remove(
        tmpl.mockup_template_images.map((i) => i.storage_path)
      );
    }
    await supabase.from("mockup_templates").delete().eq("id", id);
    toast.success("Plantilla eliminada");
    load();
  };

  // ── Upload image to template
  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeTemplateId) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFor(activeTemplateId);
    const ext = file.name.split(".").pop();
    const path = `${productId}/${activeTemplateId}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("mockups")
      .upload(path, file);

    if (upErr) { toast.error(upErr.message); setUploadingFor(null); return; }

    const tmpl = templates.find((t) => t.id === activeTemplateId);
    const order = tmpl?.mockup_template_images.length ?? 0;

    await supabase.from("mockup_template_images").insert({
      template_id: activeTemplateId,
      storage_path: path,
      display_order: order,
      zone_x: 25,
      zone_y: 30,
      zone_width: 35,
      zone_height: 25,
      zone_rotation: 0,
    });

    toast.success("Imagen subida");
    setUploadingFor(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    load();
  };

  // ── Delete image
  const handleDeleteImage = async (img: TemplateImage) => {
    await supabase.storage.from("mockups").remove([img.storage_path]);
    await supabase.from("mockup_template_images").delete().eq("id", img.id);
    toast.success("Imagen eliminada");
    load();
  };

  // ── Open zone editor
  const openZoneEditor = (img: TemplateImage) => {
    setEditingImage(img);
    setZone({
      x: img.zone_x,
      y: img.zone_y,
      w: img.zone_width,
      h: img.zone_height,
      rotation: img.zone_rotation ?? 0,
    });
    setEditorOpen(true);
  };

  // ── Save zone
  const saveZone = async () => {
    if (!editingImage) return;
    await supabase.from("mockup_template_images").update({
      zone_x: zone.x,
      zone_y: zone.y,
      zone_width: zone.w,
      zone_height: zone.h,
      zone_rotation: zone.rotation,
    }).eq("id", editingImage.id);
    toast.success("Zona guardada");
    setEditorOpen(false);
    load();
  };

  // Convert % to px for Rnd
  const pctToPx = (pct: number, total: number) => (pct / 100) * total;
  const pxToPct = (px: number, total: number) => (px / total) * 100;

  if (loading) return <p className="text-zinc-500">Cargando...</p>;

  return (
    <>
      <div className="flex items-center gap-4">
        <Link href="/admin/mockups">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{product?.name}</h1>
          <p className="font-mono text-xs text-zinc-400">{product?.reference}</p>
        </div>
        <Button onClick={() => setNewTemplateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nueva plantilla
        </Button>
      </div>

      {templates.length === 0 && (
        <div className="mt-16 text-center text-zinc-400 text-sm">
          <p>No hay plantillas aún.</p>
          <p className="mt-1">Crea una para empezar a subir imágenes.</p>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {templates.map((t) => (
          <Card key={t.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-zinc-300" />
                <div>
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <Badge variant="secondary" className="text-xs mt-0.5">
                    {t.marking_type}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleUploadImage}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploadingFor === t.id}
                  onClick={() => {
                    setActiveTemplateId(t.id);
                    fileInputRef.current?.click();
                  }}
                >
                  {uploadingFor === t.id ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="mr-1 h-3 w-3" />
                  )}
                  {t.mockup_template_images.length < 6
                    ? `Subir imagen (${t.mockup_template_images.length}/6)`
                    : "6 imágenes"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteTemplate(t.id)}
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {t.mockup_template_images.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 py-10 cursor-pointer hover:border-orange-300 hover:bg-orange-50/50 transition-colors"
                  onClick={() => { setActiveTemplateId(t.id); fileInputRef.current?.click(); }}
                >
                  <Upload className="h-6 w-6 text-zinc-300 mb-2" />
                  <p className="text-sm text-zinc-400">Subí las imágenes del producto</p>
                  <p className="text-xs text-zinc-300 mt-0.5">Hasta 6 imágenes · JPG, PNG, WEBP</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                  {t.mockup_template_images.map((img, i) => (
                    <div key={img.id} className="group relative">
                      <div className="aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                        <img
                          src={getUrl(img.storage_path)}
                          alt={`Vista ${i + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      {/* Zone indicator */}
                      <div
                        className="absolute border-2 border-orange-400/70 bg-orange-400/10 pointer-events-none rounded"
                        style={{
                          left: `${img.zone_x}%`,
                          top: `${img.zone_y}%`,
                          width: `${img.zone_width}%`,
                          height: `${img.zone_height}%`,
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center gap-1 rounded-lg bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => openZoneEditor(img)}
                          className="rounded bg-white/90 px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-white flex items-center gap-1"
                        >
                          <Pencil className="h-3 w-3" /> Zona
                        </button>
                        <button
                          onClick={() => handleDeleteImage(img)}
                          className="rounded bg-white/90 p-1 hover:bg-white"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </button>
                      </div>
                      <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1 text-[10px] text-white">
                        {i + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New template dialog */}
      <Dialog open={newTemplateOpen} onOpenChange={setNewTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva plantilla</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nombre</Label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Ej: Vista principal"
              />
            </div>
            <div>
              <Label>Tipo de marcación</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {MARKING_TYPES.map((m) => (
                  <button
                    key={m}
                    onClick={() => setNewMarkingType(m)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      newMarkingType === m
                        ? "border-orange-500 bg-orange-500 text-white"
                        : "border-zinc-200 text-zinc-600 hover:border-orange-300"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleCreateTemplate} disabled={savingTemplate} className="w-full">
              {savingTemplate ? "Creando..." : "Crear plantilla"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Zone editor dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Definir zona del logo</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-zinc-400 -mt-2">
            Arrastrá y redimensioná el recuadro naranja para indicar dónde va el logo del cliente.
          </p>

          {editingImage && (
            <div className="space-y-4">
              {/* Canvas */}
              <div
                className="relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 select-none"
                style={{ height: 420 }}
              >
                <img
                  ref={imgRef}
                  src={getUrl(editingImage.storage_path)}
                  alt=""
                  className="h-full w-full object-contain"
                  onLoad={() => {
                    if (imgRef.current) {
                      setContainerSize({
                        w: imgRef.current.clientWidth,
                        h: imgRef.current.clientHeight,
                      });
                    }
                  }}
                />
                <Rnd
                  bounds="parent"
                  position={{
                    x: pctToPx(zone.x, containerSize.w),
                    y: pctToPx(zone.y, containerSize.h),
                  }}
                  size={{
                    width: pctToPx(zone.w, containerSize.w),
                    height: pctToPx(zone.h, containerSize.h),
                  }}
                  onDragStop={(_, d) => {
                    setZone((z) => ({
                      ...z,
                      x: pxToPct(d.x, containerSize.w),
                      y: pxToPct(d.y, containerSize.h),
                    }));
                  }}
                  onResizeStop={(_, __, ref, ___, pos) => {
                    setZone((z) => ({
                      ...z,
                      x: pxToPct(pos.x, containerSize.w),
                      y: pxToPct(pos.y, containerSize.h),
                      w: pxToPct(parseInt(ref.style.width), containerSize.w),
                      h: pxToPct(parseInt(ref.style.height), containerSize.h),
                    }));
                  }}
                  className="border-2 border-orange-500 bg-orange-400/20 cursor-move"
                  style={{ zIndex: 10 }}
                  resizeHandleStyles={{
                    bottomRight: { cursor: "se-resize" },
                    bottomLeft: { cursor: "sw-resize" },
                    topRight: { cursor: "ne-resize" },
                    topLeft: { cursor: "nw-resize" },
                  }}
                >
                  <div className="flex h-full w-full items-center justify-center">
                    <span className="rounded bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white opacity-80 select-none">
                      LOGO
                    </span>
                  </div>
                </Rnd>
              </div>

              {/* Rotation */}
              <div className="flex items-center gap-4">
                <Label className="w-20 flex-shrink-0">Rotación: {Math.round(zone.rotation)}°</Label>
                <input
                  type="range"
                  min={-45}
                  max={45}
                  step={1}
                  value={zone.rotation}
                  onChange={(e) => setZone((z) => ({ ...z, rotation: Number(e.target.value) }))}
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={() => setZone((z) => ({ ...z, rotation: 0 }))}>
                  Reset
                </Button>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setEditorOpen(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={saveZone}>
                  Guardar zona
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
