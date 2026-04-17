"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { X, ChevronLeft, ChevronRight, Pencil } from "lucide-react";

interface ProductVariant {
  id: string;
  label: string;
  price: number;
  reference: string | null;
  is_default: boolean;
  display_order: number;
}

interface ProductDetail {
  id: string;
  reference: string;
  name: string;
  description: string | null;
  price: number;
  price_label: string;
  has_variants: boolean;
  product_colors: { id: string; name: string; hex_color: string }[];
  product_images: { id: string; storage_path: string; is_primary: boolean; display_order: number }[];
}

interface Props {
  productId: string | null;
  onClose: () => void;
  isAdmin?: boolean;
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

// WhatsApp SVG icon
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

export function ProductDetailModal({ productId, onClose, isAdmin = false }: Props) {
  const supabase = createClient();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => {
    if (!productId) { setProduct(null); setVariants([]); setSelectedVariant(null); return; }
    setLoading(true);
    setImgIndex(0);
    setVariants([]);
    setSelectedVariant(null);
    setDescExpanded(false);

    supabase
      .from("products")
      .select("*, product_colors(*), product_images(*)")
      .eq("id", productId)
      .single()
      .then(async ({ data }) => {
        if (data) {
          const sorted = [...(data.product_images ?? [])].sort(
            (a: any, b: any) => a.display_order - b.display_order
          );
          const primary = sorted.findIndex((i: any) => i.is_primary);
          setProduct({ ...data, product_images: sorted });
          setImgIndex(primary >= 0 ? primary : 0);

          if (data.has_variants) {
            const { data: varData } = await supabase
              .from("product_variants")
              .select("*")
              .eq("product_id", productId)
              .order("display_order");
            const vList = varData ?? [];
            setVariants(vList);
            const def = vList.find((v: ProductVariant) => v.is_default) ?? vList[0] ?? null;
            setSelectedVariant(def);
          }
        }
        setLoading(false);
      });
  }, [productId]);

  useEffect(() => {
    if (!productId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setImgIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight" && product)
        setImgIndex((i) => Math.min(product.product_images.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [productId, product, onClose]);

  if (!productId) return null;

  const getUrl = (path: string) =>
    supabase.storage.from("products").getPublicUrl(path).data.publicUrl;

  const images = product?.product_images ?? [];
  const currentImg = images[imgIndex];
  const displayPrice = selectedVariant ? selectedVariant.price : (product?.price ?? 0);
  const DESC_LIMIT = 160;
  const desc = product?.description ?? "";
  const descTruncated = desc.length > DESC_LIMIT && !descExpanded ? desc.slice(0, DESC_LIMIT) + "…" : desc;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col md:flex-row"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Close button — always top-right of whole modal ── */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/8 text-zinc-600 hover:bg-black/15 transition-colors"
          style={{ background: "rgba(0,0,0,0.07)" }}
        >
          <X className="h-4 w-4" />
        </button>

        {/* ── LEFT: Photo panel ── */}
        <div className="relative flex flex-col bg-zinc-50 md:w-[52%] shrink-0">

          {/* Main image */}
          <div className="relative flex flex-1 items-center justify-center overflow-hidden" style={{ minHeight: 280 }}>
            {loading && (
              <div className="flex h-full w-full items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-orange-500" />
              </div>
            )}

            {!loading && currentImg && (
              <img
                key={currentImg.id}
                src={getUrl(currentImg.storage_path)}
                alt={product?.name}
                className="h-full w-full object-contain p-6"
                style={{ maxHeight: 440 }}
              />
            )}

            {!loading && !currentImg && (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 py-20 text-zinc-300">
                <span className="text-5xl">📦</span>
                <p className="text-sm">Sin imagen</p>
              </div>
            )}

            {/* Prev / Next arrows */}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setImgIndex((i) => Math.max(0, i - 1))}
                  disabled={imgIndex === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-md border border-zinc-100 disabled:opacity-25 hover:bg-white transition-all"
                >
                  <ChevronLeft className="h-4 w-4 text-zinc-700" />
                </button>
                <button
                  onClick={() => setImgIndex((i) => Math.min(images.length - 1, i + 1))}
                  disabled={imgIndex === images.length - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-md border border-zinc-100 disabled:opacity-25 hover:bg-white transition-all"
                >
                  <ChevronRight className="h-4 w-4 text-zinc-700" />
                </button>

                {/* Image counter */}
                <span className="absolute bottom-3 right-3 rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-medium text-white tabular-nums">
                  {imgIndex + 1}/{images.length}
                </span>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 pb-4 pt-2 scrollbar-hide">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setImgIndex(i)}
                  className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                    i === imgIndex
                      ? "border-orange-500 shadow-sm scale-105"
                      : "border-zinc-200 opacity-55 hover:opacity-90 hover:border-zinc-300"
                  }`}
                >
                  <img src={getUrl(img.storage_path)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Info panel ── */}
        <div className="flex flex-1 flex-col overflow-y-auto px-6 py-6 min-w-0">
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-orange-500" />
            </div>
          ) : product ? (
            <div className="flex flex-col gap-3 h-full">

              {/* Reference */}
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                {product.reference}
              </p>

              {/* Name */}
              <h2 className="text-xl font-bold text-zinc-900 leading-snug -mt-1 pr-6">
                {product.name}
              </h2>

              {/* Price */}
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-zinc-900 tracking-tight">
                  {formatPrice(displayPrice)}
                </span>
                {!product.has_variants && product.price_label && (
                  <span className="text-xs font-medium text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">
                    {product.price_label}
                  </span>
                )}
              </div>

              {/* Variants */}
              {product.has_variants && variants.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Versión / Capacidad
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariant(v)}
                        className={`rounded-lg border-2 px-3 py-1.5 text-sm font-semibold transition-all ${
                          selectedVariant?.id === v.id
                            ? "border-orange-500 bg-orange-50 text-orange-700"
                            : "border-zinc-200 text-zinc-600 hover:border-zinc-300 bg-white"
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {desc && (
                <div>
                  <p className="text-sm text-zinc-500 leading-relaxed">
                    {descTruncated}
                    {desc.length > DESC_LIMIT && (
                      <button
                        onClick={() => setDescExpanded((x) => !x)}
                        className="ml-1 text-orange-500 font-medium hover:text-orange-600 text-xs"
                      >
                        {descExpanded ? "Ver menos" : "Ver más"}
                      </button>
                    )}
                  </p>
                </div>
              )}

              {/* Colors */}
              {product.product_colors.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Colores disponibles
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {product.product_colors.map((c) => (
                      <div key={c.id} className="flex items-center gap-1.5">
                        <span
                          className="h-4 w-4 rounded-full border border-black/10 shadow-sm flex-shrink-0"
                          style={{ background: c.hex_color }}
                          title={c.name}
                        />
                        <span className="text-xs text-zinc-500">{c.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* CTA */}
              <div className="pt-2">
                {isAdmin ? (
                  <a
                    href={`/admin/catalogo/${product.id}`}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    <Pencil className="h-4 w-4" /> Editar producto
                  </a>
                ) : (
                  <a
                    href={`https://wa.me/573025212938?text=Hola!%20Me%20interesa%20el%20producto%20${product.reference}%20${encodeURIComponent(product.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3.5 text-sm font-bold text-white hover:bg-orange-600 active:scale-[0.98] transition-all shadow-sm shadow-orange-200"
                  >
                    <WhatsAppIcon /> Consultar por WhatsApp
                  </a>
                )}
              </div>

            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
