"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { X, ChevronLeft, ChevronRight, ExternalLink, Pencil } from "lucide-react";

interface ProductDetail {
  id: string;
  reference: string;
  name: string;
  description: string | null;
  price: number;
  price_label: string;
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

export function ProductDetailModal({ productId, onClose, isAdmin = false }: Props) {
  const supabase = createClient();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);

  useEffect(() => {
    if (!productId) { setProduct(null); return; }
    setLoading(true);
    setImgIndex(0);
    supabase
      .from("products")
      .select("*, product_colors(*), product_images(*)")
      .eq("id", productId)
      .single()
      .then(({ data }) => {
        if (data) {
          const sorted = [...(data.product_images ?? [])].sort(
            (a: any, b: any) => a.display_order - b.display_order
          );
          const primary = sorted.findIndex((i: any) => i.is_primary);
          setProduct({ ...data, product_images: sorted });
          setImgIndex(primary >= 0 ? primary : 0);
        }
        setLoading(false);
      });
  }, [productId]);

  // Close on Escape
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

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col md:flex-row"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/10 text-zinc-700 hover:bg-black/20 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* ── LEFT: Photo ── */}
        <div className="relative flex w-full flex-col bg-zinc-50 md:w-[55%]">
          <div className="relative flex flex-1 items-center justify-center" style={{ minHeight: 300 }}>
            {loading && (
              <div className="flex h-full w-full items-center justify-center py-24">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-orange-500" />
              </div>
            )}

            {!loading && currentImg && (
              <img
                src={getUrl(currentImg.storage_path)}
                alt={product?.name}
                className="h-full w-full object-contain p-6"
                style={{ maxHeight: 420 }}
              />
            )}

            {!loading && !currentImg && (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 py-24 text-zinc-300">
                <span className="text-5xl">📦</span>
                <p className="text-sm">Sin imagen</p>
              </div>
            )}

            {/* Prev / Next */}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setImgIndex((i) => Math.max(0, i - 1))}
                  disabled={imgIndex === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow border border-zinc-200 disabled:opacity-30 hover:bg-zinc-50 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setImgIndex((i) => Math.min(images.length - 1, i + 1))}
                  disabled={imgIndex === images.length - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow border border-zinc-200 disabled:opacity-30 hover:bg-zinc-50 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 pb-4 pt-1">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setImgIndex(i)}
                  className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                    i === imgIndex
                      ? "border-orange-500 opacity-100"
                      : "border-zinc-200 opacity-60 hover:opacity-90"
                  }`}
                >
                  <img
                    src={getUrl(img.storage_path)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Info ── */}
        <div className="flex flex-1 flex-col overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-orange-500" />
            </div>
          ) : product ? (
            <>
              {/* Reference */}
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">
                {product.reference}
              </p>

              {/* Name */}
              <h2 className="text-xl font-bold text-zinc-900 leading-tight mb-3">
                {product.name}
              </h2>

              {/* Price */}
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-2xl font-black text-zinc-900">
                  {formatPrice(product.price)}
                </span>
                {product.price_label && (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                    {product.price_label}
                  </span>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <p className="text-sm text-zinc-500 leading-relaxed mb-5">
                  {product.description}
                </p>
              )}

              {/* Colors */}
              {product.product_colors.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Colores disponibles
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {product.product_colors.map((c) => (
                      <div key={c.id} className="flex items-center gap-1.5">
                        <span
                          className="h-5 w-5 rounded-full border border-black/10 shadow-sm"
                          style={{ background: c.hex_color }}
                          title={c.name}
                        />
                        <span className="text-xs text-zinc-500">{c.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-auto pt-4 flex flex-col gap-2">
                {isAdmin ? (
                  <a
                    href={`/admin/catalogo/${product.id}`}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    <Pencil className="h-4 w-4" /> Editar producto
                  </a>
                ) : (
                  <>
                    <a
                      href="/#contacto"
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white hover:bg-orange-600 transition-colors"
                    >
                      Personalizar con mi marca
                    </a>
                    <a
                      href={`https://wa.me/573025212938?text=Hola!%20Me%20interesa%20el%20producto%20${product.reference}%20${encodeURIComponent(product.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" /> Consultar por WhatsApp
                    </a>
                  </>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
