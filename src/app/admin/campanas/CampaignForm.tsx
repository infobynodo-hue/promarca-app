"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink, Loader2 } from "lucide-react";
interface SimpleProduct {
  id: string;
  name: string;
  reference: string;
  price: number;
  primaryImageUrl: string | null;
}

interface Benefit {
  emoji: string;
  text: string;
}

interface CampaignData {
  id?: string;
  product_id: string | null;
  slug: string;
  brand_name: string;
  brand_logo_url: string;
  headline: string;
  subheadline: string;
  compare_price: string;
  price_override: string;
  benefits: Benefit[];
  fomo_text: string;
  whatsapp_number: string;
  shopify_url: string;
  primary_color: string;
  status: "draft" | "published";
}

interface Props {
  initialData?: Partial<CampaignData> & { id?: string };
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function CampaignForm({ initialData }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const isEditing = !!initialData?.id;

  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [saving, setSaving] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [customImageFile, setCustomImageFile] = useState<File | null>(null);
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(initialData?.brand_logo_url ? null : null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [form, setForm] = useState<CampaignData>({
    product_id: initialData?.product_id ?? null,
    slug: initialData?.slug ?? "",
    brand_name: initialData?.brand_name ?? "",
    brand_logo_url: initialData?.brand_logo_url ?? "",
    headline: initialData?.headline ?? "",
    subheadline: initialData?.subheadline ?? "",
    compare_price: initialData?.compare_price ?? "",
    price_override: initialData?.price_override ?? "",
    benefits: initialData?.benefits?.length
      ? initialData.benefits
      : [{ emoji: "⚡", text: "" }],
    fomo_text: initialData?.fomo_text ?? "🔥 7 personas viendo este producto ahora",
    whatsapp_number: initialData?.whatsapp_number ?? "",
    shopify_url: initialData?.shopify_url ?? "",
    primary_color: initialData?.primary_color ?? "#FF6B2C",
    status: initialData?.status ?? "draft",
  });

  const selectedProduct: SimpleProduct | null = products.find((p) => p.id === form.product_id) ?? null;

  useEffect(() => {
    supabase
      .from("products")
      .select("id, name, reference, price, product_images(storage_path, is_primary, display_order)")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        const mapped = (data ?? []).map((p: any) => {
          const imgs: any[] = p.product_images ?? [];
          const sorted = [...imgs].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
          const primary = sorted.find((i) => i.is_primary) ?? sorted[0];
          const primaryImageUrl = primary?.storage_path
            ? supabase.storage.from("products").getPublicUrl(primary.storage_path).data.publicUrl
            : null;
          return { id: p.id, name: p.name, reference: p.reference, price: p.price, primaryImageUrl };
        });
        setProducts(mapped);
      });
  }, []);

  // Auto-generate slug from headline
  useEffect(() => {
    if (!slugManuallyEdited && form.headline) {
      setForm((prev) => ({ ...prev, slug: toSlug(form.headline) }));
    }
  }, [form.headline, slugManuallyEdited]);

  const set = useCallback(
    <K extends keyof CampaignData>(key: K, value: CampaignData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const addBenefit = () => {
    if (form.benefits.length >= 6) return;
    set("benefits", [...form.benefits, { emoji: "✅", text: "" }]);
  };

  const removeBenefit = (i: number) => {
    set(
      "benefits",
      form.benefits.filter((_, idx) => idx !== i)
    );
  };

  const updateBenefit = (i: number, field: "emoji" | "text", value: string) => {
    const updated = form.benefits.map((b, idx) =>
      idx === i ? { ...b, [field]: value } : b
    );
    set("benefits", updated);
  };

  const handleSave = async (targetStatus: "draft" | "published", preview = false) => {
    if (!form.product_id) {
      toast.error("Selecciona un producto base");
      return;
    }
    if (!form.brand_name.trim()) {
      toast.error("El nombre de la marca es requerido");
      return;
    }
    if (!form.headline.trim()) {
      toast.error("El título principal es requerido");
      return;
    }
    if (!form.slug.trim()) {
      toast.error("El slug es requerido");
      return;
    }

    setSaving(true);

    const payload = {
      product_id: form.product_id,
      slug: form.slug.trim(),
      brand_name: form.brand_name.trim(),
      brand_logo_url: form.brand_logo_url.trim() || null,
      headline: form.headline.trim(),
      subheadline: form.subheadline.trim() || null,
      compare_price: form.compare_price ? parseFloat(form.compare_price) : null,
      price_override: form.price_override ? parseFloat(form.price_override) : null,
      benefits: form.benefits.filter((b) => b.text.trim()),
      fomo_text: form.fomo_text.trim() || null,
      whatsapp_number: form.whatsapp_number.trim() || null,
      shopify_url: form.shopify_url.trim() || null,
      primary_color: form.primary_color,
      status: targetStatus,
    };

    try {
      if (isEditing && initialData?.id) {
        const { error } = await supabase
          .from("b2c_campaigns")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", initialData.id);
        if (error) throw error;
        toast.success(
          targetStatus === "published" ? "Campaña publicada" : "Borrador guardado"
        );
        if (preview) {
          window.open(`/tienda/${form.slug}?preview=true`, "_blank");
        }
      } else {
        const { data, error } = await supabase
          .from("b2c_campaigns")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        toast.success("Campaña creada");
        if (preview && data) {
          window.open(`/tienda/${form.slug}?preview=true`, "_blank");
        }
        router.push(`/admin/campanas/${data.id}/editar`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Error al guardar: " + msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCustomImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const path = `campaign-images/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const { error } = await supabase.storage.from("products").upload(path, file, { upsert: true });
      if (error) throw error;
      const url = supabase.storage.from("products").getPublicUrl(path).data.publicUrl;
      setCustomImageUrl(url);
      setCustomImageFile(file);
      toast.success("Imagen subida");
    } catch (err: unknown) {
      toast.error("Error al subir imagen");
    } finally {
      setUploadingImage(false);
    }
  };

  const fmtPrice = (n: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(n);

  const filteredProducts = products.filter((p) => {
    if (!productSearch) return true;
    const q = productSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Section 1 – Producto base */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Producto base</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Product gallery picker */}
          <div className="space-y-3">
            <Label>Producto del catálogo</Label>
            <div className="relative">
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar por nombre o referencia..."
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1 sm:grid-cols-4">
              {filteredProducts.map((p) => {
                const isSelected = form.product_id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => set("product_id", p.id)}
                    className={`group flex flex-col rounded-xl border-2 overflow-hidden text-left transition-all
                      ${isSelected
                        ? "border-orange-500 shadow-md shadow-orange-100"
                        : "border-zinc-200 hover:border-orange-300"
                      }`}
                  >
                    <div className="aspect-square w-full bg-zinc-100 overflow-hidden">
                      {p.primaryImageUrl ? (
                        <img
                          src={p.primaryImageUrl}
                          alt={p.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-zinc-300 text-[10px] text-center px-1">
                          Sin foto
                        </div>
                      )}
                    </div>
                    <div className={`px-1.5 py-1 ${isSelected ? "bg-orange-50" : "bg-white"}`}>
                      <p className="font-mono text-[9px] text-orange-500 font-bold truncate">{p.reference}</p>
                      <p className="text-[10px] text-zinc-700 leading-tight line-clamp-2">{p.name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {filteredProducts.length === 0 && (
              <p className="text-sm text-zinc-400 text-center py-4">No se encontraron productos</p>
            )}
          </div>

          {/* Selected product summary */}
          {selectedProduct && (
            <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
              {selectedProduct.primaryImageUrl && (
                <img src={selectedProduct.primaryImageUrl} alt="" className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-medium text-zinc-800 truncate">{selectedProduct.name}</p>
                <p className="text-xs text-zinc-500 font-mono">{selectedProduct.reference} · {fmtPrice(selectedProduct.price)}</p>
              </div>
            </div>
          )}

          {/* Custom image upload */}
          <div className="space-y-2 border-t border-zinc-100 pt-4">
            <Label>Imagen personalizada para la campaña <span className="text-zinc-400 font-normal">(opcional — reemplaza la foto del catálogo)</span></Label>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-500 hover:border-orange-400 hover:text-orange-500 transition-colors">
                {uploadingImage ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo...</>
                ) : (
                  <><span className="text-lg">📷</span> Subir imagen</>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCustomImageUpload(file);
                  }}
                />
              </label>
              {(customImageUrl) && (
                <img src={customImageUrl} alt="preview" className="h-12 w-12 rounded-lg object-cover border border-zinc-200" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2 – Marca */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Marca</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brand_name">Nombre de la marca</Label>
            <Input
              id="brand_name"
              value={form.brand_name}
              onChange={(e) => set("brand_name", e.target.value)}
              placeholder="Ej: FitLife Colombia"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand_logo_url">URL del logo (opcional)</Label>
            <Input
              id="brand_logo_url"
              value={form.brand_logo_url}
              onChange={(e) => set("brand_logo_url", e.target.value)}
              placeholder="https://ejemplo.com/logo.png"
            />
            {form.brand_logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.brand_logo_url}
                alt="preview"
                className="h-10 w-auto rounded border border-zinc-200 object-contain"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="primary_color">Color principal</Label>
            <div className="flex items-center gap-3">
              <input
                id="primary_color"
                type="color"
                value={form.primary_color}
                onChange={(e) => set("primary_color", e.target.value)}
                className="h-10 w-16 cursor-pointer rounded border border-zinc-200 p-1"
              />
              <Input
                value={form.primary_color}
                onChange={(e) => set("primary_color", e.target.value)}
                className="w-32 font-mono text-sm"
                placeholder="#FF6B2C"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3 – Contenido */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Contenido de la landing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="headline">Título principal</Label>
            <Textarea
              id="headline"
              value={form.headline}
              onChange={(e) => set("headline", e.target.value)}
              placeholder='Ej: Aspirador inalámbrico + Envío GRATIS ✈️'
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subheadline">Subtítulo (opcional)</Label>
            <Input
              id="subheadline"
              value={form.subheadline}
              onChange={(e) => set("subheadline", e.target.value)}
              placeholder="Ej: La aspiradora más potente del mercado"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="compare_price">Precio tachado (COP)</Label>
              <Input
                id="compare_price"
                type="number"
                value={form.compare_price}
                onChange={(e) => set("compare_price", e.target.value)}
                placeholder="Ej: 150000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price_override">Precio de venta B2C (COP)</Label>
              <Input
                id="price_override"
                type="number"
                value={form.price_override}
                onChange={(e) => set("price_override", e.target.value)}
                placeholder={selectedProduct ? String(selectedProduct.price) : "Ej: 89000"}
              />
              {!form.price_override && selectedProduct && (
                <p className="text-xs text-zinc-400">
                  Si dejas vacío, se usará el precio del producto: {fmtPrice(selectedProduct.price)}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">
              Slug (URL de la landing)
              {isEditing && (
                <a
                  href={`/tienda/${form.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 inline-flex items-center gap-1 text-xs text-orange-500 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Ver
                </a>
              )}
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400 shrink-0">/tienda/</span>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => {
                  setSlugManuallyEdited(true);
                  set("slug", toSlug(e.target.value));
                }}
                className="font-mono"
                placeholder="mi-producto-asombroso"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4 – Beneficios */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">4. Beneficios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.benefits.map((benefit, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={benefit.emoji}
                onChange={(e) => updateBenefit(i, "emoji", e.target.value)}
                className="w-16 text-center text-lg"
                placeholder="⚡"
                maxLength={4}
              />
              <Input
                value={benefit.text}
                onChange={(e) => updateBenefit(i, "text", e.target.value)}
                placeholder="Ej: La más potente del mercado"
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeBenefit(i)}
                disabled={form.benefits.length <= 1}
              >
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            </div>
          ))}
          {form.benefits.length < 6 && (
            <Button variant="outline" size="sm" onClick={addBenefit}>
              <Plus className="mr-2 h-3.5 w-3.5" /> Agregar beneficio
            </Button>
          )}
          <p className="text-xs text-zinc-400">Máximo 6 beneficios</p>
        </CardContent>
      </Card>

      {/* Section 5 – FOMO y contacto */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">5. FOMO y contacto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fomo_text">Texto de urgencia</Label>
            <Input
              id="fomo_text"
              value={form.fomo_text}
              onChange={(e) => set("fomo_text", e.target.value)}
              placeholder="🔥 7 personas viendo este producto ahora"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="whatsapp_number">WhatsApp (con código de país)</Label>
            <Input
              id="whatsapp_number"
              value={form.whatsapp_number}
              onChange={(e) => set("whatsapp_number", e.target.value)}
              placeholder="573001234567"
            />
            <p className="text-xs text-zinc-400">
              Incluye el código de país sin + ni espacios. Ej: 573001234567
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Section 6 – Shopify */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">6. Shopify</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shopify_url">URL del producto en Shopify</Label>
            <Input
              id="shopify_url"
              value={form.shopify_url}
              onChange={(e) => set("shopify_url", e.target.value)}
              placeholder="https://tutienda.myshopify.com/products/..."
            />
          </div>
          <p className="text-sm text-zinc-400 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            Conecta el producto en Shopify después de publicar y pega aquí la URL para activar el botón de compra.
          </p>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex items-center gap-3 pt-2 pb-8">
        <Button
          variant="outline"
          onClick={() => handleSave("draft")}
          disabled={saving}
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar borrador
        </Button>
        <Button
          variant="outline"
          onClick={() => handleSave("draft", true)}
          disabled={saving}
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <ExternalLink className="mr-2 h-4 w-4" />
          Guardar y previsualizar
        </Button>
        <Button
          onClick={() => handleSave("published")}
          disabled={saving}
          className="bg-green-600 hover:bg-green-700"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Publicar
        </Button>
      </div>
    </div>
  );
}
