"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Product, Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ProductImageModal } from "@/components/admin/product-image-modal";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import { PriceCalculator } from "@/components/admin/PriceCalculator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus, Pencil, Trash2, Search, ExternalLink, FileUp,
  LayoutGrid, List, ImageIcon, Archive, PackageOpen, Calculator, ShoppingBag, Loader2, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface ShopifySync {
  shopify_id: string | null;
  shopify_url: string | null;
  status: string | null;
  last_synced_at: string | null;
}

interface ProductWithImages extends Omit<Product, "product_images"> {
  product_images?: { id: string; storage_path: string; is_primary: boolean; display_order: number; product_id: string; alt_text: string | null }[];
  shopify_syncs?: ShopifySync[];
}

export default function ProductosPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<ProductWithImages[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [view, setView] = useState<"list" | "gallery">("list");

  // Image modal (manage images)
  const [modalProduct, setModalProduct] = useState<ProductWithImages | null>(null);
  // Detail modal (view product)
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  // Price calculator modal (quick price update from list)
  const [calcProduct, setCalcProduct] = useState<ProductWithImages | null>(null);
  const [syncingProducts, setSyncingProducts] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    const [prodRes, catRes] = await Promise.all([
      supabase
        .from("products")
        .select("*, category:categories(name, slug), product_colors(*), product_images(id, storage_path, is_primary, display_order), shopify_syncs(shopify_id, shopify_url, status, last_synced_at)")
        .order("name"),
      supabase.from("categories").select("*").order("display_order"),
    ]);
    setProducts(prodRes.data ?? []);
    setCategories(catRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este producto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success("Producto eliminado");
    fetchData();
  };

  const handleApplyPrice = async (productId: string, price: number) => {
    const { error } = await supabase.from("products").update({ price }).eq("id", productId);
    if (error) { toast.error("Error al actualizar precio"); return; }
    toast.success("Precio actualizado ✓");
    setCalcProduct(null);
    fetchData();
  };

  const handleToggleActive = async (product: Product) => {
    await supabase.from("products").update({ is_active: !product.is_active }).eq("id", product.id);
    fetchData();
  };

  const handleShopifySync = async (productId: string) => {
    setSyncingProducts((prev) => new Set(prev).add(productId));
    try {
      const res = await fetch("/api/shopify/sync-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Error al sincronizar con Shopify");
        return;
      }
      toast.success("Producto sincronizado con Shopify");
      fetchData();
    } catch {
      toast.error("Error de red al sincronizar con Shopify");
    } finally {
      setSyncingProducts((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

  const getImageUrl = (path: string) =>
    supabase.storage.from("products").getPublicUrl(path).data.publicUrl;

  const getPrimaryImage = (p: ProductWithImages) => {
    const imgs = p.product_images ?? [];
    return (imgs.find((i) => i.is_primary) ?? imgs[0])?.storage_path ?? null;
  };

  const filtered = products.filter((p) => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.reference.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "all" || p.category_id === filterCat;
    return matchSearch && matchCat;
  });

  // Group by category for gallery view
  const grouped: { cat: Category | null; items: ProductWithImages[] }[] = [];
  const catMap = new Map(categories.map((c) => [c.id, c]));

  if (filterCat !== "all") {
    grouped.push({ cat: catMap.get(filterCat) ?? null, items: filtered });
  } else {
    const byCat = new Map<string | null, ProductWithImages[]>();
    for (const p of filtered) {
      const key = p.category_id ?? "__none__";
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key)!.push(p);
    }
    for (const [key, items] of byCat) {
      const cat = key === "__none__" ? null : (catMap.get(key as string) ?? null);
      grouped.push({ cat, items });
    }
  }

  if (loading) return <p className="text-zinc-500">Cargando...</p>;

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Productos</h1>
          <p className="text-sm text-zinc-500">{products.length} productos en catálogo</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/catalogo/fotos-proveedor">
            <Button variant="outline" className="border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700">
              <Sparkles className="mr-2 h-4 w-4" /> Importar fotos del proveedor
            </Button>
          </Link>
          <Link href="/admin/catalogo/subir-imagenes">
            <Button variant="outline">
              <ImageIcon className="mr-2 h-4 w-4" /> Subir imágenes (ZIP)
            </Button>
          </Link>
          <Link href="/admin/catalogo/importar">
            <Button variant="outline">
              <FileUp className="mr-2 h-4 w-4" /> Importar PDF
            </Button>
          </Link>
          <Link href="/admin/catalogo/nuevo">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nuevo
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters + view toggle */}
      <div className="mt-6 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o referencia..."
            className="pl-10"
          />
        </div>
        <Select value={filterCat} onValueChange={(v) => setFilterCat(v ?? "all")}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* View toggle */}
        <div className="flex rounded-lg border border-zinc-200 overflow-hidden">
          <button
            onClick={() => setView("list")}
            className={`px-3 py-2 transition-colors ${view === "list" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50"}`}
            title="Vista lista"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView("gallery")}
            className={`px-3 py-2 transition-colors ${view === "gallery" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50"}`}
            title="Vista galería"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── LIST VIEW ── */}
      {view === "list" && (
        <Card className="mt-4">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Foto</TableHead>
                  <TableHead>Ref.</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10">Shopify</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-zinc-400">
                      No se encontraron productos
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((p) => {
                  const imgPath = getPrimaryImage(p);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div
                          className="h-10 w-10 rounded-lg border border-zinc-200 bg-zinc-50 overflow-hidden cursor-pointer hover:border-orange-400 transition-colors flex items-center justify-center"
                          onClick={() => setDetailProductId(p.id)}
                          title="Ver producto"
                        >
                          {imgPath ? (
                            <img src={getImageUrl(imgPath)} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-zinc-300" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold">{p.reference}</TableCell>
                      <TableCell className="max-w-[200px] truncate font-medium">{p.name}</TableCell>
                      <TableCell className="text-zinc-500">
                        <div className="flex items-center gap-1.5">
                          <span>{(p.category as any)?.name ?? "—"}</span>
                          {(p.category as any)?.slug && (
                            <a href={`/catalogo/${(p.category as any).slug}`} target="_blank" rel="noopener noreferrer"
                              className="text-zinc-400 hover:text-orange-400 transition-colors">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{formatPrice(p.price)}</span>
                          <button
                            onClick={() => setCalcProduct(p)}
                            title="Calcular precio"
                            className="flex h-6 w-6 items-center justify-center rounded-md border border-zinc-200 text-zinc-400 hover:border-orange-300 hover:text-orange-500 transition-colors"
                          >
                            <Calculator className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.is_active ? "default" : "secondary"}
                          className="cursor-pointer" onClick={() => handleToggleActive(p)}>
                          {p.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const sync = (p.shopify_syncs ?? [])[0];
                          const isSyncing = syncingProducts.has(p.id);
                          const isSynced = sync?.status === "synced" && sync?.shopify_id;
                          return (
                            <button
                              onClick={() => handleShopifySync(p.id)}
                              disabled={isSyncing}
                              title={isSynced ? `Sincronizado en Shopify\n${sync.shopify_url ?? ""}` : "Sincronizar en Shopify"}
                              className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors
                                ${isSynced
                                  ? "border-green-300 bg-green-50 text-green-600 hover:bg-green-100"
                                  : "border-zinc-200 text-zinc-400 hover:border-orange-300 hover:text-orange-500"
                                } disabled:opacity-50`}
                            >
                              {isSyncing
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <ShoppingBag className="h-3.5 w-3.5" />
                              }
                            </button>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/admin/catalogo/${p.id}`}>
                          <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
                        </Link>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── GALLERY VIEW ── */}
      {view === "gallery" && (
        <div className="mt-4 space-y-8">
          {filtered.length === 0 && (
            <p className="text-center text-zinc-400 py-12">No se encontraron productos</p>
          )}
          {grouped.map(({ cat, items }) => (
            <div key={cat?.id ?? "none"}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="font-semibold text-sm text-zinc-700">
                  {cat ? `${cat.icon ?? ""} ${cat.name}` : "Sin categoría"}
                </h2>
                <span className="text-xs text-zinc-400">{items.length} productos</span>
                {cat?.slug && (
                  <a href={`/catalogo/${cat.slug}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-orange-500 hover:underline flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> Ver catálogo cliente
                  </a>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {items.map((p) => {
                  const imgPath = getPrimaryImage(p);
                  const hasImages = (p.product_images ?? []).length > 0;
                  return (
                    <div
                      key={p.id}
                      className="group cursor-pointer"
                      onClick={() => setDetailProductId(p.id)}
                    >
                      <div className={`relative aspect-square overflow-hidden rounded-xl border-2 transition-all
                        ${hasImages ? "border-zinc-200 group-hover:border-orange-400" : "border-dashed border-zinc-200 group-hover:border-orange-300 bg-zinc-50"}`}>
                        {imgPath ? (
                          <img src={getImageUrl(imgPath)} alt={p.name}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200" />
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center gap-1">
                            <PackageOpen className="h-6 w-6 text-zinc-300" />
                            <span className="text-[10px] text-zinc-300">Sin foto</span>
                          </div>
                        )}
                        {/* Image count badge */}
                        {(p.product_images ?? []).length > 0 && (
                          <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white">
                            {(p.product_images ?? []).length} foto{(p.product_images ?? []).length > 1 ? "s" : ""}
                          </span>
                        )}
                        {/* Hover overlay */}
                        <div className="absolute inset-0 flex items-center justify-center bg-orange-500/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                          <ImageIcon className="h-6 w-6 text-white" />
                        </div>
                      </div>
                      <p className="mt-1.5 font-mono text-[10px] text-zinc-400 truncate">{p.reference}</p>
                      <p className="text-xs font-medium text-zinc-700 truncate leading-tight">{p.name}</p>
                      <p className="text-[11px] text-zinc-400">{formatPrice(p.price)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick image modal (from edit page) */}
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

      {/* Product detail modal */}
      <ProductDetailModal
        productId={detailProductId}
        onClose={() => setDetailProductId(null)}
        isAdmin={true}
      />

      {/* Quick price calculator modal */}
      <Dialog open={!!calcProduct} onOpenChange={(v) => !v && setCalcProduct(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-orange-500" />
              <span className="font-mono text-sm text-zinc-400">{calcProduct?.reference}</span>
              <span className="truncate">{calcProduct?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-zinc-400 -mt-1 mb-1">
            Precio actual: <strong className="text-zinc-700">{calcProduct ? formatPrice(calcProduct.price) : ""}</strong>
          </p>
          {calcProduct && (
            <PriceCalculator
              currentPrice={calcProduct.price}
              onApply={(price) => handleApplyPrice(calcProduct.id, price)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
