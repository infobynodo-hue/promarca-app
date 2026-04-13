"use client";

import { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProductImageModal } from "@/components/admin/product-image-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink, ImageIcon, PackageOpen, Pencil, Search } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface ProductWithImages {
  id: string;
  name: string;
  reference: string;
  price: number;
  is_active: boolean;
  product_images: { id: string; storage_path: string; is_primary: boolean; display_order: number }[];
}

interface CategoryFull {
  id: string;
  name: string;
  icon: string | null;
  slug: string;
  description: string | null;
  is_active: boolean;
}

export default function CategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();
  const [category, setCategory] = useState<CategoryFull | null>(null);
  const [products, setProducts] = useState<ProductWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalProduct, setModalProduct] = useState<ProductWithImages | null>(null);
  const [filter, setFilter] = useState<"all" | "with" | "without">("all");

  const fetchData = async () => {
    const [catRes, prodRes] = await Promise.all([
      supabase.from("categories").select("*").eq("id", id).single(),
      supabase
        .from("products")
        .select("id, name, reference, price, is_active, product_images(id, storage_path, is_primary, display_order)")
        .eq("category_id", id)
        .order("name"),
    ]);
    setCategory(catRes.data);
    setProducts(
      (prodRes.data ?? []).map((p: any) => ({
        ...p,
        product_images: (p.product_images ?? []).sort((a: any, b: any) => a.display_order - b.display_order),
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id]);

  const getImageUrl = (path: string) =>
    supabase.storage.from("products").getPublicUrl(path).data.publicUrl;

  const getPrimaryImage = (p: ProductWithImages) => {
    const imgs = p.product_images;
    return (imgs.find((i) => i.is_primary) ?? imgs[0])?.storage_path ?? null;
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

  const filtered = products.filter((p) => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.reference.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ||
      (filter === "with" && p.product_images.length > 0) ||
      (filter === "without" && p.product_images.length === 0);
    return matchSearch && matchFilter;
  });

  const withImages = products.filter((p) => p.product_images.length > 0).length;
  const withoutImages = products.length - withImages;

  if (loading) return <p className="text-zinc-500">Cargando...</p>;
  if (!category) return <p className="text-zinc-500">Categoría no encontrada</p>;

  return (
    <>
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/admin/catalogo/categorias">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {category.icon && <span className="text-3xl">{category.icon}</span>}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{category.name}</h1>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-sm text-zinc-400">{products.length} productos</span>
                <a
                  href={`/catalogo/${category.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-orange-500 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" /> Ver como cliente
                </a>
              </div>
            </div>
          </div>
          {/* Stats */}
          <div className="mt-3 flex gap-3">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${filter === "all" ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-600 hover:border-zinc-400"}`}
            >
              Todos ({products.length})
            </button>
            <button
              onClick={() => setFilter("with")}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${filter === "with" ? "bg-green-600 text-white border-green-600" : "border-zinc-200 text-zinc-600 hover:border-green-400"}`}
            >
              Con fotos ({withImages})
            </button>
            <button
              onClick={() => setFilter("without")}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${filter === "without" ? "bg-orange-500 text-white border-orange-500" : "border-zinc-200 text-zinc-600 hover:border-orange-400"}`}
            >
              Sin fotos ({withoutImages})
            </button>
          </div>
        </div>
        <Link href={`/admin/catalogo/${products[0]?.id ?? ""}`}>
          <Button variant="outline" size="sm">
            <Pencil className="mr-1 h-3 w-3" /> Editar categoría
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="mt-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto..."
          className="pl-10"
        />
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-zinc-400 mb-1">
          <span>Cobertura de imágenes</span>
          <span>{withImages}/{products.length} productos</span>
        </div>
        <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all"
            style={{ width: products.length ? `${(withImages / products.length) * 100}%` : "0%" }}
          />
        </div>
      </div>

      {/* Product grid */}
      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-zinc-400 text-sm">
            No hay productos que coincidan
          </div>
        )}
        {filtered.map((p) => {
          const imgPath = getPrimaryImage(p);
          const imgCount = p.product_images.length;
          return (
            <div
              key={p.id}
              className="group cursor-pointer"
              onClick={() => setModalProduct(p)}
            >
              <div className={`relative aspect-square overflow-hidden rounded-xl border-2 transition-all
                ${imgCount > 0
                  ? "border-zinc-200 group-hover:border-orange-400"
                  : "border-dashed border-zinc-200 group-hover:border-orange-300 bg-zinc-50"
                }`}
              >
                {imgPath ? (
                  <img
                    src={getImageUrl(imgPath)}
                    alt={p.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-zinc-300">
                    <PackageOpen className="h-6 w-6" />
                    <span className="text-[10px]">Sin foto</span>
                  </div>
                )}

                {/* Image count */}
                {imgCount > 0 && (
                  <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white">
                    {imgCount}/4
                  </span>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-orange-500/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                  <ImageIcon className="h-5 w-5 text-white" />
                  <span className="text-[10px] text-white font-medium">
                    {imgCount === 0 ? "Agregar foto" : "Gestionar"}
                  </span>
                </div>
              </div>

              <p className="mt-1.5 font-mono text-[10px] text-zinc-400 truncate">{p.reference}</p>
              <p className="text-xs font-medium text-zinc-700 truncate leading-tight">{p.name}</p>
              <p className="text-[11px] text-zinc-400">{formatPrice(p.price)}</p>
            </div>
          );
        })}
      </div>

      {/* Image modal */}
      {modalProduct && (
        <ProductImageModal
          productId={modalProduct.id}
          productName={modalProduct.name}
          productRef={modalProduct.reference}
          open={!!modalProduct}
          onClose={() => setModalProduct(null)}
          onImagesChanged={fetchData}
        />
      )}
    </>
  );
}
