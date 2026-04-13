"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Product, Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search, ExternalLink, FileUp } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function ProductosPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  const fetchData = async () => {
    const [prodRes, catRes] = await Promise.all([
      supabase
        .from("products")
        .select("*, category:categories(name, slug), product_colors(*)")
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("display_order"),
    ]);
    setProducts(prodRes.data ?? []);
    setCategories(catRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este producto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast.error("Error: " + error.message);
      return;
    }
    toast.success("Producto eliminado");
    fetchData();
  };

  const handleToggleActive = async (product: Product) => {
    await supabase
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);
    fetchData();
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(price);

  const filtered = products.filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.reference.toLowerCase().includes(search.toLowerCase());
    const matchCat =
      filterCat === "all" || p.category_id === filterCat;
    return matchSearch && matchCat;
  });

  if (loading) return <p className="text-zinc-500">Cargando...</p>;

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Productos</h1>
          <p className="text-sm text-zinc-500">
            {products.length} productos en catálogo
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/catalogo/importar">
            <Button variant="outline">
              <FileUp className="mr-2 h-4 w-4" /> Importar PDF
            </Button>
          </Link>
          <Link href="/admin/catalogo/nuevo">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nuevo producto
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
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
            <SelectItem value="all">Todas</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.icon} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref.</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Colores</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-zinc-400">
                    No se encontraron productos
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs font-bold">
                    {p.reference}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate font-medium">
                    {p.name}
                  </TableCell>
                  <TableCell className="text-zinc-500">
                    <div className="flex items-center gap-1.5">
                      <span>{(p.category as any)?.name ?? "—"}</span>
                      {(p.category as any)?.slug && (
                        <a
                          href={`/catalogo/${(p.category as any).slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-400 hover:text-orange-400 transition-colors"
                          title="Ver en sitio cliente"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatPrice(p.price)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-0.5">
                      {(p.product_colors ?? []).slice(0, 5).map((c) => (
                        <span
                          key={c.id}
                          className="inline-block h-4 w-4 rounded-full border border-zinc-200"
                          style={{ background: c.hex_color }}
                          title={c.name}
                        />
                      ))}
                      {(p.product_colors ?? []).length > 5 && (
                        <span className="text-xs text-zinc-400 ml-1">
                          +{(p.product_colors ?? []).length - 5}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={p.is_active ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => handleToggleActive(p)}
                    >
                      {p.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/catalogo/${p.id}`}>
                      <Button variant="ghost" size="icon">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(p.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
