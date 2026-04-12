"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Category, Subcategory, Product } from "@/lib/types";
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
import { Plus, Trash2, Save, ArrowLeft } from "lucide-react";
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

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [saving, setSaving] = useState(false);

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
          .select("*, product_colors(*)")
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

          // Load subcategories for this category
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
    router.push("/admin/catalogo");
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
        </div>
      </div>
    </>
  );
}
