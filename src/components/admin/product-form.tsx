"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Category, Subcategory, ProductImage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Trash2, Save, ArrowLeft, Upload, Star, Loader2,
  ImageOff, Link2, FileText, AlertCircle, CheckCircle, X, ExternalLink,
} from "lucide-react";
import { PriceCalculator } from "@/components/admin/PriceCalculator";
import { toast } from "sonner";
import Link from "next/link";

interface ProductFormProps {
  productId?: string;
}

interface ColorInput {
  id?: string;
  name: string;
  hex_color: string;
}

// Image that hasn't been uploaded yet (create mode queue)
interface PendingImage {
  tempId: string;
  file: File;
  previewUrl: string;
}

export function ProductForm({ productId }: ProductFormProps) {
  const supabase = createClient();
  const router = useRouter();
  const isEdit = !!productId;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [saving, setSaving] = useState(false);

  // Saved images (edit mode)
  const [images, setImages] = useState<ProductImage[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Pending images queue (create mode — uploaded after product is created)
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  // PDF import state
  const [pdfImporting, setPdfImporting] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Reference duplicate check
  const [refStatus, setRefStatus] = useState<"idle" | "checking" | "ok" | "duplicate">("idle");
  const [duplicateProductId, setDuplicateProductId] = useState<string | null>(null);

  const [form, setForm] = useState({
    reference: "",
    name: "",
    description: "",
    price: "",
    price_label: "Sin marca",
    category_id: "",
    subcategory_id: "",
    has_variants: false,
  });

  const [colors, setColors] = useState<ColorInput[]>([]);

  // Variants
  interface VariantInput { id?: string; label: string; price: string; reference: string; is_default: boolean; }
  const [variants, setVariants] = useState<VariantInput[]>([]);
  const addVariant = () => setVariants((v) => [...v, { label: "", price: "", reference: "", is_default: v.length === 0 }]);
  const removeVariant = (i: number) => setVariants((v) => v.filter((_, idx) => idx !== i));
  const updateVariant = (i: number, field: keyof VariantInput, value: string | boolean) => {
    setVariants((v) => {
      const updated = [...v];
      if (field === "is_default") {
        updated.forEach((vr, idx) => { updated[idx] = { ...vr, is_default: idx === i }; });
      } else {
        updated[i] = { ...updated[i], [field]: value };
      }
      return updated;
    });
  };

  // Load categories + existing product data
  useEffect(() => {
    const load = async () => {
      const { data: cats } = await supabase.from("categories").select("*").order("display_order");
      setCategories(cats ?? []);

      if (isEdit) {
        const { data: product } = await supabase
          .from("products")
          .select("*, product_colors(*), product_images(*)")
          .eq("id", productId)
          .single();

        if (product) {
          setForm({
            reference: product.reference,
            name: product.name,
            description: product.description ?? "",
            price: String(product.price),
            price_label: product.price_label,
            category_id: product.category_id ?? "",
            subcategory_id: product.subcategory_id ?? "",
            has_variants: product.has_variants ?? false,
          });
          setColors((product.product_colors ?? []).map((c: any) => ({ id: c.id, name: c.name, hex_color: c.hex_color })));
          // Load variants
          const { data: varData } = await supabase.from("product_variants").select("*").eq("product_id", productId).order("display_order");
          setVariants((varData ?? []).map((v: any) => ({ id: v.id, label: v.label, price: String(v.price), reference: v.reference ?? "", is_default: v.is_default })));
          setImages((product.product_images ?? []).sort((a: any, b: any) => a.display_order - b.display_order));
          if (product.category_id) {
            const { data: subs } = await supabase.from("subcategories").select("*").eq("category_id", product.category_id).order("display_order");
            setSubcategories(subs ?? []);
          }
        }
      }
    };
    load();
  }, [productId]);

  // ── Reference duplicate check ─────────────────────────────────────────────
  const checkReference = useCallback(async (ref: string) => {
    if (!ref.trim() || isEdit) return;
    setRefStatus("checking");
    const { data } = await supabase
      .from("products")
      .select("id")
      .eq("reference", ref.trim().toUpperCase())
      .maybeSingle();
    if (data) {
      setRefStatus("duplicate");
      setDuplicateProductId(data.id);
    } else {
      setRefStatus("ok");
      setDuplicateProductId(null);
    }
  }, [isEdit, supabase]);

  const handleCategoryChange = async (catId: string) => {
    setForm({ ...form, category_id: catId, subcategory_id: "" });
    const { data } = await supabase.from("subcategories").select("*").eq("category_id", catId).order("display_order");
    setSubcategories(data ?? []);
  };

  // ── Upload image file to Supabase (edit mode) ────────────────────────────
  const uploadImageFile = useCallback(async (file: File, pid: string, currentCount: number) => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${pid}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("products").upload(path, file, { upsert: false });
    if (uploadError) { toast.error("Error al subir imagen: " + uploadError.message); return null; }
    const isPrimary = currentCount === 0;
    const { data: inserted, error: dbError } = await supabase.from("product_images")
      .insert({ product_id: pid, storage_path: path, is_primary: isPrimary, display_order: currentCount, alt_text: null })
      .select().single();
    if (dbError) { toast.error("Error al guardar imagen: " + dbError.message); return null; }
    return inserted;
  }, [supabase]);

  // ── Edit mode: handle file input ─────────────────────────────────────────
  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!productId) return;
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploadingImage(true);
    let count = images.length;
    for (const file of files) {
      const inserted = await uploadImageFile(file, productId, count);
      if (inserted) { setImages((prev) => [...prev, inserted]); count++; }
    }
    setUploadingImage(false);
    if (files.length > 1) toast.success(`${files.length} imágenes subidas ✓`);
    else toast.success("Imagen subida ✓");
  };

  // ── Create mode: add file(s) to pending queue ─────────────────────────────
  const addPendingFiles = useCallback((files: File[]) => {
    const newItems: PendingImage[] = files
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({ tempId: `${Date.now()}-${Math.random()}`, file: f, previewUrl: URL.createObjectURL(f) }));
    setPendingImages((prev) => [...prev, ...newItems]);
  }, []);

  const removePending = (tempId: string) => {
    setPendingImages((prev) => {
      const item = prev.find((p) => p.tempId === tempId);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => p.tempId !== tempId);
    });
  };

  // ── URL image import ──────────────────────────────────────────────────────
  const handleUrlImport = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setFetchingUrl(true);
    try {
      const res = await fetch("/api/fetch-image-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "No se pudo descargar la imagen"); return; }
      // Convert base64 to File
      const byteArr = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
      const ext = data.contentType.split("/")[1]?.split(";")[0] ?? "jpg";
      const file = new File([byteArr], `imagen-url.${ext}`, { type: data.contentType });

      if (isEdit && productId) {
        setUploadingImage(true);
        const inserted = await uploadImageFile(file, productId, images.length);
        if (inserted) { setImages((prev) => [...prev, inserted]); toast.success("Imagen agregada ✓"); }
        setUploadingImage(false);
      } else {
        addPendingFiles([file]);
        toast.success("Imagen agregada a la cola ✓");
      }
      setUrlInput("");
    } catch {
      toast.error("Error al descargar la imagen");
    } finally {
      setFetchingUrl(false);
    }
  };

  // ── Clipboard paste ───────────────────────────────────────────────────────
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) break;
          if (isEdit && productId) {
            toast.info("Pegando imagen…");
            setUploadingImage(true);
            uploadImageFile(file, productId, images.length).then((ins) => {
              if (ins) { setImages((prev) => [...prev, ins]); toast.success("Imagen pegada ✓"); }
              setUploadingImage(false);
            });
          } else {
            addPendingFiles([file]);
            toast.success("Imagen agregada a la cola ✓");
          }
          break;
        }
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [isEdit, productId, images.length, uploadImageFile, addPendingFiles]);

  // ── PDF import → pre-fill form fields ────────────────────────────────────
  const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (pdfInputRef.current) pdfInputRef.current.value = "";
    setPdfImporting(true);
    try {
      const fd = new FormData();
      fd.append("pdf", file);
      const res = await fetch("/api/import-pdf", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.products?.length) { toast.error("No se encontraron productos en el PDF"); return; }
      const p = data.products[0];
      setForm((prev) => ({
        ...prev,
        reference: p.reference ?? prev.reference,
        name: p.name ?? prev.name,
        description: p.description ?? prev.description,
        price: p.price ? String(p.price) : prev.price,
        price_label: p.price_label ?? prev.price_label,
      }));
      toast.success(`✅ Datos pre-llenados desde PDF${data.products.length > 1 ? ` (${data.products.length} productos encontrados, se usó el primero)` : ""}`);
    } catch {
      toast.error("Error al procesar el PDF");
    } finally {
      setPdfImporting(false);
    }
  };

  // ── Edit mode: delete / set primary ──────────────────────────────────────
  const handleDeleteImage = async (img: ProductImage) => {
    await supabase.storage.from("products").remove([img.storage_path]);
    await supabase.from("product_images").delete().eq("id", img.id);
    const remaining = images.filter((i) => i.id !== img.id);
    if (img.is_primary && remaining.length > 0) {
      await supabase.from("product_images").update({ is_primary: true }).eq("id", remaining[0].id);
      remaining[0] = { ...remaining[0], is_primary: true };
    }
    setImages(remaining);
    toast.success("Imagen eliminada");
  };

  const handleSetPrimary = async (img: ProductImage) => {
    if (img.is_primary) return;
    await supabase.from("product_images").update({ is_primary: false }).eq("product_id", productId);
    await supabase.from("product_images").update({ is_primary: true }).eq("id", img.id);
    setImages(images.map((i) => ({ ...i, is_primary: i.id === img.id })));
  };

  const getImageUrl = (path: string) => supabase.storage.from("products").getPublicUrl(path).data.publicUrl;

  const addColor = () => setColors([...colors, { name: "", hex_color: "#000000" }]);
  const removeColor = (i: number) => setColors(colors.filter((_, idx) => idx !== i));
  const updateColor = (i: number, field: keyof ColorInput, value: string) => {
    const updated = [...colors];
    updated[i] = { ...updated[i], [field]: value };
    setColors(updated);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name || !form.reference) { toast.error("Completa nombre y referencia"); return; }
    if (!form.has_variants && !form.price) { toast.error("Completa el precio o activa variantes"); return; }
    if (form.has_variants && variants.length === 0) { toast.error("Agrega al menos una variante de precio"); return; }
    if (form.has_variants && variants.some((v) => !v.label || !v.price)) { toast.error("Todas las variantes deben tener nombre y precio"); return; }
    if (refStatus === "duplicate") { toast.error("Esa referencia ya existe — edita el producto existente"); return; }

    setSaving(true);
    // If using variants, price = minimum variant price
    const effectivePrice = form.has_variants
      ? Math.min(...variants.map((v) => parseInt(v.price) || 0))
      : parseInt(form.price);

    const payload = {
      reference: form.reference.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description || null,
      price: effectivePrice,
      price_label: form.price_label,
      category_id: form.category_id || null,
      subcategory_id: form.subcategory_id || null,
      has_variants: form.has_variants,
      updated_at: new Date().toISOString(),
    };

    let productIdResult = productId;

    if (isEdit) {
      const { error } = await supabase.from("products").update(payload).eq("id", productId);
      if (error) { toast.error("Error: " + error.message); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("products").insert(payload).select("id").single();
      if (error) {
        if (error.code === "23505") {
          toast.error("Ya existe un producto con esa referencia");
          setRefStatus("duplicate");
        } else {
          toast.error("Error: " + error.message);
        }
        setSaving(false);
        return;
      }
      productIdResult = data.id;

      // Upload pending images now that we have the product ID
      if (pendingImages.length > 0) {
        for (let i = 0; i < pendingImages.length; i++) {
          const inserted = await uploadImageFile(pendingImages[i].file, productIdResult!, i);
          if (inserted) URL.revokeObjectURL(pendingImages[i].previewUrl);
        }
        setPendingImages([]);
      }
    }

    // Sync colors
    if (productIdResult) {
      await supabase.from("product_colors").delete().eq("product_id", productIdResult);
      const validColors = colors.filter((c) => c.name && c.hex_color);
      if (validColors.length > 0) {
        await supabase.from("product_colors").insert(
          validColors.map((c, i) => ({ product_id: productIdResult, name: c.name, hex_color: c.hex_color, display_order: i }))
        );
      }

      // Sync variants
      await supabase.from("product_variants").delete().eq("product_id", productIdResult);
      if (form.has_variants && variants.length > 0) {
        await supabase.from("product_variants").insert(
          variants.map((v, i) => ({
            product_id: productIdResult,
            label: v.label.trim(),
            price: parseInt(v.price) || 0,
            reference: v.reference.trim() || null,
            is_default: v.is_default,
            display_order: i,
          }))
        );
      }
    }

    toast.success(isEdit ? "Producto actualizado" : "Producto creado");
    setSaving(false);
    if (!isEdit) router.push("/admin/catalogo");
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const allImagesCount = isEdit ? images.length : pendingImages.length;

  return (
    <>
      <div className="flex items-center gap-4">
        <Link href="/admin/catalogo">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{isEdit ? "Editar producto" : "Nuevo producto"}</h1>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* ── Main form ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Product info */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Información</CardTitle>
                {/* PDF pre-fill button */}
                {!isEdit && (
                  <div>
                    <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={handlePdfImport} />
                    <Button
                      variant="outline" size="sm"
                      onClick={() => pdfInputRef.current?.click()}
                      disabled={pdfImporting}
                      className="gap-1.5 text-xs"
                    >
                      {pdfImporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                      {pdfImporting ? "Leyendo PDF..." : "Pre-llenar desde PDF"}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Reference field with duplicate check */}
                <div className="space-y-1">
                  <Label>Referencia *</Label>
                  <div className="relative">
                    <Input
                      value={form.reference}
                      onChange={(e) => {
                        setForm({ ...form, reference: e.target.value.toUpperCase() });
                        setRefStatus("idle");
                      }}
                      onBlur={(e) => checkReference(e.target.value)}
                      placeholder="MU-321"
                      className={
                        refStatus === "duplicate" ? "border-red-400 pr-8 focus-visible:ring-red-300" :
                        refStatus === "ok" ? "border-green-400 pr-8" : "pr-8"
                      }
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      {refStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
                      {refStatus === "ok" && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {refStatus === "duplicate" && <AlertCircle className="h-4 w-4 text-red-500" />}
                    </div>
                  </div>
                  {refStatus === "duplicate" && duplicateProductId && (
                    <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                      <p className="text-xs text-red-700 flex-1">Esa referencia ya existe en el catálogo</p>
                      <Link
                        href={`/admin/catalogo/${duplicateProductId}`}
                        target="_blank"
                        className="flex items-center gap-0.5 text-xs font-semibold text-red-600 hover:text-red-800 whitespace-nowrap"
                      >
                        Editar <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  )}
                  {refStatus === "ok" && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Referencia disponible
                    </p>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>Precio publicado (COP) {!form.has_variants && "*"}</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400">Variantes</span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !form.has_variants;
                          setForm({ ...form, has_variants: next });
                          if (next && variants.length === 0) addVariant();
                        }}
                        className={`relative h-5 w-9 rounded-full transition-colors focus:outline-none ${form.has_variants ? "bg-orange-500" : "bg-zinc-300"}`}
                      >
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.has_variants ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                    </div>
                  </div>
                  <Input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder={form.has_variants ? "Se calcula del mínimo" : "31311"}
                    disabled={form.has_variants}
                    className={form.has_variants ? "opacity-40 cursor-not-allowed" : ""}
                  />
                  {form.has_variants && (
                    <p className="mt-1 text-xs text-orange-600">El precio base se toma del mínimo de variantes</p>
                  )}
                </div>
              </div>

              {/* ── Variants table ── */}
              {form.has_variants && (
                <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-zinc-700">Variantes de precio</p>
                    <Button type="button" variant="outline" size="sm" onClick={addVariant} className="gap-1 text-xs">
                      <Plus className="h-3 w-3" /> Agregar variante
                    </Button>
                  </div>
                  {variants.length === 0 && (
                    <p className="text-xs text-zinc-400 text-center py-2">Sin variantes — agrega al menos una</p>
                  )}
                  <div className="space-y-2">
                    {variants.map((v, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg bg-white border border-zinc-200 px-3 py-2">
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <div>
                            <p className="text-[10px] text-zinc-400 mb-0.5">Nombre</p>
                            <Input
                              value={v.label}
                              onChange={(e) => updateVariant(i, "label", e.target.value)}
                              placeholder="Ej: 8 GB"
                              className="h-7 text-xs"
                            />
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-400 mb-0.5">Precio (COP)</p>
                            <Input
                              type="number"
                              value={v.price}
                              onChange={(e) => updateVariant(i, "price", e.target.value)}
                              placeholder="28500"
                              className="h-7 text-xs"
                            />
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-400 mb-0.5">Ref. variante (opcional)</p>
                            <Input
                              value={v.reference}
                              onChange={(e) => updateVariant(i, "reference", e.target.value)}
                              placeholder="USB-8G"
                              className="h-7 text-xs"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-1">
                          <button
                            type="button"
                            onClick={() => updateVariant(i, "is_default", true)}
                            title="Marcar como predeterminada"
                            className={`h-5 w-5 rounded-full border-2 transition-colors ${v.is_default ? "border-orange-500 bg-orange-500" : "border-zinc-300 hover:border-orange-300"}`}
                          >
                            {v.is_default && <span className="flex items-center justify-center h-full w-full text-white text-[8px] font-bold">✓</span>}
                          </button>
                          <button type="button" onClick={() => removeVariant(i)} className="text-zinc-300 hover:text-red-500 transition-colors">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {variants.length > 0 && (
                    <p className="text-[10px] text-zinc-400">● = variante predeterminada (la que aparece seleccionada por defecto)</p>
                  )}
                </div>
              )}

              <PriceCalculator
                currentPrice={!form.has_variants ? (parseInt(form.price) || undefined) : undefined}
                onApply={(price) => {
                  if (!form.has_variants) setForm({ ...form, price: String(price) });
                }}
              />
              <div>
                <Label>Nombre *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Termo acero inoxidable con asa" />
              </div>
              <div>
                <Label>Descripción</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción del producto..." rows={3} />
              </div>
              <div>
                <Label>Etiqueta de precio</Label>
                <Input value={form.price_label} onChange={(e) => setForm({ ...form, price_label: e.target.value })} placeholder="Sin marca" />
              </div>
            </CardContent>
          </Card>

          {/* ── Images ── */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Imágenes</CardTitle>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Sube, pega con <kbd className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[10px]">Ctrl+V</kbd>, importa por URL o desde PDF
                  {!isEdit && allImagesCount === 0 && <span className="ml-1 text-orange-500">· se subirán al crear el producto</span>}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {/* File upload */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={isEdit ? handleUploadImage : (e) => { addPendingFiles(Array.from(e.target.files ?? [])); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                />
                <Button
                  variant="outline" size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
                  {uploadingImage ? "Subiendo..." : "Subir"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* URL import row */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                  <Input
                    ref={urlInputRef}
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleUrlImport(); }}
                    placeholder="Pega una URL de imagen y presiona Enter..."
                    className="pl-8 text-sm"
                  />
                </div>
                <Button
                  variant="outline" size="sm"
                  onClick={handleUrlImport}
                  disabled={!urlInput.trim() || fetchingUrl}
                  className="shrink-0"
                >
                  {fetchingUrl ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Agregar"}
                </Button>
              </div>

              {/* Image grid */}
              {isEdit ? (
                images.length === 0 ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-200 p-8 cursor-pointer hover:border-orange-300 hover:bg-orange-50/50 transition-colors"
                  >
                    <ImageOff className="h-8 w-8 text-zinc-300" />
                    <p className="text-sm text-zinc-400 text-center">
                      Clic para subir · pega con <kbd className="rounded bg-zinc-100 px-1 font-mono text-xs">Ctrl+V</kbd>
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {images.map((img) => (
                      <div key={img.id} className="group relative">
                        <div className="aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                          <img src={getImageUrl(img.storage_path)} alt="" className="h-full w-full object-cover" />
                        </div>
                        {img.is_primary && (
                          <span className="absolute top-1 left-1 rounded bg-orange-500 px-1 py-0.5 text-[10px] font-bold text-white">Principal</span>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center gap-1 rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                          {!img.is_primary && (
                            <button onClick={() => handleSetPrimary(img)} title="Hacer principal" className="rounded bg-white/90 p-1 hover:bg-white">
                              <Star className="h-3.5 w-3.5 text-orange-500" />
                            </button>
                          )}
                          <button onClick={() => handleDeleteImage(img)} title="Eliminar" className="rounded bg-white/90 p-1 hover:bg-white">
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square flex items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 cursor-pointer hover:border-orange-300 hover:bg-orange-50/50 transition-colors"
                    >
                      <Plus className="h-5 w-5 text-zinc-300" />
                    </div>
                  </div>
                )
              ) : (
                /* Create mode — pending queue */
                pendingImages.length === 0 ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-200 p-8 cursor-pointer hover:border-orange-300 hover:bg-orange-50/50 transition-colors"
                  >
                    <ImageOff className="h-8 w-8 text-zinc-300" />
                    <p className="text-sm text-zinc-400 text-center">
                      Clic para subir · pega con <kbd className="rounded bg-zinc-100 px-1 font-mono text-xs">Ctrl+V</kbd> · importa por URL
                    </p>
                    <p className="text-xs text-zinc-300">Las imágenes se subirán automáticamente al guardar el producto</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                      {pendingImages.map((p, i) => (
                        <div key={p.tempId} className="group relative">
                          <div className="aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                            <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
                          </div>
                          {i === 0 && (
                            <span className="absolute top-1 left-1 rounded bg-orange-500 px-1 py-0.5 text-[10px] font-bold text-white">Principal</span>
                          )}
                          <button
                            onClick={() => removePending(p.tempId)}
                            className="absolute top-1 right-1 rounded-full bg-black/50 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square flex items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 cursor-pointer hover:border-orange-300 hover:bg-orange-50/50 transition-colors"
                      >
                        <Plus className="h-5 w-5 text-zinc-300" />
                      </div>
                    </div>
                    <p className="text-xs text-orange-600 flex items-center gap-1">
                      <Loader2 className="h-3 w-3" />
                      {pendingImages.length} imagen{pendingImages.length !== 1 ? "es" : ""} lista{pendingImages.length !== 1 ? "s" : ""} — se subirán al crear el producto
                    </p>
                  </div>
                )
              )}
            </CardContent>
          </Card>

          {/* Colors */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Colores</CardTitle>
              <Button variant="outline" size="sm" onClick={addColor}><Plus className="mr-1 h-3 w-3" /> Agregar</Button>
            </CardHeader>
            <CardContent>
              {colors.length === 0 && <p className="text-sm text-zinc-400">Sin colores agregados</p>}
              <div className="space-y-3">
                {colors.map((color, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <input type="color" value={color.hex_color} onChange={(e) => updateColor(i, "hex_color", e.target.value)} className="h-9 w-12 cursor-pointer rounded border" />
                    <Input value={color.name} onChange={(e) => updateColor(i, "name", e.target.value)} placeholder="Negro" className="flex-1" />
                    <Input value={color.hex_color} onChange={(e) => updateColor(i, "hex_color", e.target.value)} placeholder="#000000" className="w-28 font-mono text-xs" />
                    <Button variant="ghost" size="icon" onClick={() => removeColor(i)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Categoría</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Select value={form.category_id} onValueChange={(v) => v && handleCategoryChange(v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {subcategories.length > 0 && (
                <Select value={form.subcategory_id} onValueChange={(v) => setForm({ ...form, subcategory_id: v ?? "" })}>
                  <SelectTrigger><SelectValue placeholder="Subcategoría..." /></SelectTrigger>
                  <SelectContent>
                    {subcategories.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          <Button
            onClick={handleSave}
            className="w-full"
            disabled={saving || refStatus === "duplicate"}
          >
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : <><Save className="mr-2 h-4 w-4" />{isEdit ? "Guardar cambios" : "Crear producto"}</>}
          </Button>

          {!isEdit && pendingImages.length > 0 && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
              <p className="text-xs text-orange-700 font-medium">
                📸 {pendingImages.length} imagen{pendingImages.length !== 1 ? "es" : ""} en cola
              </p>
              <p className="text-xs text-orange-600 mt-0.5">Se subirán automáticamente al crear el producto</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
