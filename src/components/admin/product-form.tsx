"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Category, Subcategory, ProductImage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Save, ArrowLeft, Upload, Star, Loader2, ImageOff } from "lucide-react";
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

export function ProductForm({ productId }: ProductFormProps) {
  const supabase = createClient();
  const router = useRouter();
  const isEdit = !!productId;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [form, setForm] = useState({
    reference: "",
    name: "",
    description: "",
    price: "",
    price_label: "Sin marca",
    category_id: "",
    subcategory_id: "",
  });

  const [colors, setColors] = useState<ColorInput[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: cats } = await supabase
        .from("categories")
        .select("*")
        .order("display_order");
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
          });
          setColors(
            (product.product_colors ?? []).map((c: any) => ({
              id: c.id,
              name: c.name,
              hex_color: c.hex_color,
            }))
          );
          setImages(
            (product.product_images ?? []).sort(
              (a: any, b: any) => a.display_order - b.display_order
            )
          );

          if (product.category_id) {
            const { data: subs } = await supabase
              .from("subcategories")
              .select("*")
              .eq("category_id", product.category_id)
              .order("display_order");
            setSubcategories(subs ?? []);
          }
        }
      }
    };
    load();
  }, [productId]);

  const handleCategoryChange = async (catId: string) => {
    setForm({ ...form, category_id: catId, subcategory_id: "" });
    const { data } = await supabase
      .from("subcategories")
      .select("*")
      .eq("category_id", catId)
      .order("display_order");
    setSubcategories(data ?? []);
  };

  const addColor = () => {
    setColors([...colors, { name: "", hex_color: "#000000" }]);
  };

  const removeColor = (index: number) => {
    setColors(colors.filter((_, i) => i !== index));
  };

  const updateColor = (index: number, field: keyof ColorInput, value: string) => {
    const updated = [...colors];
    updated[index] = { ...updated[index], [field]: value };
    setColors(updated);
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!productId) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const ext = file.name.split(".").pop();
    const path = `${productId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("products")
      .upload(path, file, { upsert: false });

    if (uploadError) {
      toast.error("Error al subir imagen: " + uploadError.message);
      setUploadingImage(false);
      return;
    }

    const isPrimary = images.length === 0;
    const { data: inserted, error: dbError } = await supabase
      .from("product_images")
      .insert({
        product_id: productId,
        storage_path: path,
        is_primary: isPrimary,
        display_order: images.length,
        alt_text: null,
      })
      .select()
      .single();

    if (dbError) {
      toast.error("Error al guardar imagen: " + dbError.message);
    } else {
      setImages((prev) => [...prev, inserted]);
      toast.success("Imagen subida");
    }

    setUploadingImage(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteImage = async (img: ProductImage) => {
    await supabase.storage.from("products").remove([img.storage_path]);
    await supabase.from("product_images").delete().eq("id", img.id);

    const remaining = images.filter((i) => i.id !== img.id);
    // If we deleted the primary, make the first remaining primary
    if (img.is_primary && remaining.length > 0) {
      await supabase
        .from("product_images")
        .update({ is_primary: true })
        .eq("id", remaining[0].id);
      remaining[0] = { ...remaining[0], is_primary: true };
    }
    setImages(remaining);
    toast.success("Imagen eliminada");
  };

  const handleSetPrimary = async (img: ProductImage) => {
    if (img.is_primary) return;
    await supabase
      .from("product_images")
      .update({ is_primary: false })
      .eq("product_id", productId);
    await supabase
      .from("product_images")
      .update({ is_primary: true })
      .eq("id", img.id);
    setImages(images.map((i) => ({ ...i, is_primary: i.id === img.id })));
  };

  const getImageUrl = (path: string) => {
    const { data } = supabase.storage.from("products").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!form.name || !form.reference || !form.price) {
      toast.error("Completa nombre, referencia y precio");
      return;
    }

    setSaving(true);

    const payload = {
      reference: form.reference,
      name: form.name,
      description: form.description || null,
      price: parseInt(form.price),
      price_label: form.price_label,
      category_id: form.category_id || null,
      subcategory_id: form.subcategory_id || null,
      updated_at: new Date().toISOString(),
    };

    let productIdResult = productId;

    if (isEdit) {
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", productId);
      if (error) {
        toast.error("Error: " + error.message);
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("products")
        .insert(payload)
        .select("id")
        .single();
      if (error) {
        toast.error("Error: " + error.message);
        setSaving(false);
        return;
      }
      productIdResult = data.id;
    }

    // Sync colors: delete all, re-insert
    if (productIdResult) {
      await supabase
        .from("product_colors")
        .delete()
        .eq("product_id", productIdResult);

      const validColors = colors.filter((c) => c.name && c.hex_color);
      if (validColors.length > 0) {
        await supabase.from("product_colors").insert(
          validColors.map((c, i) => ({
            product_id: productIdResult,
            name: c.name,
            hex_color: c.hex_color,
            display_order: i,
          }))
        );
      }
    }

    toast.success(isEdit ? "Producto actualizado" : "Producto creado");
    setSaving(false);
    if (!isEdit) router.push("/admin/catalogo");
  };

  return (
    <>
      <div className="flex items-center gap-4">
        <Link href="/admin/catalogo">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEdit ? "Editar producto" : "Nuevo producto"}
          </h1>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Referencia *</Label>
                  <Input
                    value={form.reference}
                    onChange={(e) =>
                      setForm({ ...form, reference: e.target.value.toUpperCase() })
                    }
                    placeholder="MU-321"
                  />
                </div>
                <div>
                  <Label>Precio (COP) *</Label>
                  <Input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="31311"
                  />
                </div>
              </div>
              <div>
                <Label>Nombre *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Termo acero inoxidable con asa"
                />
              </div>
              <div>
                <Label>Descripción</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Descripción del producto..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Etiqueta de precio</Label>
                <Input
                  value={form.price_label}
                  onChange={(e) =>
                    setForm({ ...form, price_label: e.target.value })
                  }
                  placeholder="Sin marca"
                />
              </div>
            </CardContent>
          </Card>

          {/* Images — only when editing */}
          {isEdit && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Imágenes</CardTitle>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    La imagen con ⭐ se muestra en el catálogo
                  </p>
                </div>
                <div>
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
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="mr-1 h-3 w-3" />
                    )}
                    {uploadingImage ? "Subiendo..." : "Subir imagen"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {images.length === 0 ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-200 p-8 cursor-pointer hover:border-orange-300 hover:bg-orange-50/50 transition-colors"
                  >
                    <ImageOff className="h-8 w-8 text-zinc-300" />
                    <p className="text-sm text-zinc-400">Sin imágenes. Clic para subir.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {images.map((img) => (
                      <div key={img.id} className="group relative">
                        <div className="aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                          <img
                            src={getImageUrl(img.storage_path)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                        {/* Primary badge */}
                        {img.is_primary && (
                          <span className="absolute top-1 left-1 rounded bg-orange-500 px-1 py-0.5 text-[10px] font-bold text-white">
                            Principal
                          </span>
                        )}
                        {/* Actions */}
                        <div className="absolute inset-0 flex items-center justify-center gap-1 rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                          {!img.is_primary && (
                            <button
                              onClick={() => handleSetPrimary(img)}
                              title="Hacer principal"
                              className="rounded bg-white/90 p-1 hover:bg-white"
                            >
                              <Star className="h-3.5 w-3.5 text-orange-500" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteImage(img)}
                            title="Eliminar"
                            className="rounded bg-white/90 p-1 hover:bg-white"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {/* Add more */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square flex items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 cursor-pointer hover:border-orange-300 hover:bg-orange-50/50 transition-colors"
                    >
                      <Plus className="h-5 w-5 text-zinc-300" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Colors */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Colores</CardTitle>
              <Button variant="outline" size="sm" onClick={addColor}>
                <Plus className="mr-1 h-3 w-3" /> Agregar
              </Button>
            </CardHeader>
            <CardContent>
              {colors.length === 0 && (
                <p className="text-sm text-zinc-400">Sin colores agregados</p>
              )}
              <div className="space-y-3">
                {colors.map((color, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <input
                      type="color"
                      value={color.hex_color}
                      onChange={(e) => updateColor(i, "hex_color", e.target.value)}
                      className="h-9 w-12 cursor-pointer rounded border"
                    />
                    <Input
                      value={color.name}
                      onChange={(e) => updateColor(i, "name", e.target.value)}
                      placeholder="Negro"
                      className="flex-1"
                    />
                    <Input
                      value={color.hex_color}
                      onChange={(e) => updateColor(i, "hex_color", e.target.value)}
                      placeholder="#000000"
                      className="w-28 font-mono text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeColor(i)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Categoría</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={form.category_id}
                onValueChange={(v) => v && handleCategoryChange(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {subcategories.length > 0 && (
                <Select
                  value={form.subcategory_id}
                  onValueChange={(v) => setForm({ ...form, subcategory_id: v ?? "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Subcategoría..." />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategories.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          <Button onClick={handleSave} className="w-full" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear producto"}
          </Button>

          {!isEdit && (
            <p className="text-xs text-zinc-400 text-center">
              Podrás subir imágenes después de crear el producto
            </p>
          )}
        </div>
      </div>
    </>
  );
}
