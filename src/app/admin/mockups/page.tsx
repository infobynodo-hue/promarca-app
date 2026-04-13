"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Layers, Search, Plus, Pencil, Wand2 } from "lucide-react";
import Link from "next/link";

interface ProductWithTemplates {
  id: string;
  name: string;
  reference: string;
  category: { name: string; icon: string } | null;
  mockup_templates: { id: string; name: string; marking_type: string; mockup_template_images: { id: string }[] }[];
}

export default function MockupsPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<ProductWithTemplates[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("products")
      .select("id, name, reference, category:categories(name, icon), mockup_templates(id, name, marking_type, mockup_template_images(id))")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        setProducts((data as any) ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = products.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q);
  });

  if (loading) return <p className="text-zinc-500">Cargando...</p>;

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mockups</h1>
          <p className="text-sm text-zinc-500">
            Configura plantillas por producto y genera mockups con el logo del cliente
          </p>
        </div>
        <Link href="/admin/mockups/generar">
          <Button>
            <Wand2 className="mr-2 h-4 w-4" /> Generar mockup
          </Button>
        </Link>
      </div>

      <div className="mt-6 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto..."
          className="pl-10"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => {
          const totalImages = p.mockup_templates.reduce(
            (acc, t) => acc + t.mockup_template_images.length,
            0
          );
          return (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{p.name}</p>
                    <p className="font-mono text-xs text-zinc-400">{p.reference}</p>
                    {p.category && (
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {(p.category as any).icon} {(p.category as any).name}
                      </p>
                    )}
                  </div>
                  <Link href={`/admin/mockups/${p.id}`}>
                    <Button variant="outline" size="sm">
                      <Pencil className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                  </Link>
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {p.mockup_templates.length === 0 ? (
                    <span className="text-xs text-zinc-400">Sin plantillas</span>
                  ) : (
                    p.mockup_templates.map((t) => (
                      <Badge key={t.id} variant="secondary" className="text-xs gap-1">
                        <Layers className="h-2.5 w-2.5" />
                        {t.name}
                        <span className="text-zinc-400">
                          · {t.mockup_template_images.length} imgs
                        </span>
                      </Badge>
                    ))
                  )}
                </div>

                {p.mockup_templates.length > 0 && (
                  <div className="mt-3 flex justify-between items-center text-xs text-zinc-400 border-t pt-3">
                    <span>{totalImages} imágenes en total</span>
                    <Link href={`/admin/mockups/generar?producto=${p.id}`}>
                      <button className="text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1">
                        <Wand2 className="h-3 w-3" /> Generar
                      </button>
                    </Link>
                  </div>
                )}

                {p.mockup_templates.length === 0 && (
                  <Link href={`/admin/mockups/${p.id}`}>
                    <button className="mt-3 w-full rounded border-2 border-dashed border-zinc-200 py-2 text-xs text-zinc-400 hover:border-orange-300 hover:text-orange-500 transition-colors flex items-center justify-center gap-1">
                      <Plus className="h-3 w-3" /> Agregar plantilla
                    </button>
                  </Link>
                )}
              </CardContent>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full py-16 text-center text-zinc-400 text-sm">
            {search ? "Sin resultados." : "No hay productos activos."}
          </div>
        )}
      </div>
    </>
  );
}
