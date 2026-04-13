"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Category } from "@/lib/types";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, Loader2, CheckCircle2, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface ExtractedProduct {
  reference: string;
  name: string;
  price: number;
  price_label: string;
  description: string | null;
  // UI state
  _include: boolean;
}

const formatCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

export default function ImportarPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [products, setProducts] = useState<ExtractedProduct[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase
      .from("categories")
      .select("*")
      .order("display_order")
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.type === "application/pdf") {
      setSelectedFile(f);
      setProducts([]);
      setDone(false);
    } else if (f) {
      toast.error("Solo se aceptan archivos PDF");
    }
  };

  const handleExtract = async () => {
    if (!selectedFile) return;
    setExtracting(true);
    setProducts([]);
    setDone(false);

    try {
      const formData = new FormData();
      formData.append("pdf", selectedFile);

      const res = await fetch("/api/import-pdf", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Error al procesar el PDF");
        return;
      }

      if (!data.products?.length) {
        toast.info("No se encontraron productos en el PDF");
        return;
      }

      setProducts(
        data.products.map((p: any) => ({
          ...p,
          price: Number(p.price) || 0,
          _include: true,
        }))
      );
      toast.success(`${data.products.length} productos detectados`);
    } catch {
      toast.error("Error de red al procesar el PDF");
    } finally {
      setExtracting(false);
    }
  };

  const handleImport = async () => {
    const toImport = products.filter((p) => p._include);
    if (!toImport.length) {
      toast.error("Selecciona al menos un producto");
      return;
    }

    setImporting(true);

    const payload = toImport.map((p) => ({
      reference: p.reference.trim().toUpperCase(),
      name: p.name.trim(),
      description: p.description || null,
      price: p.price,
      price_label: p.price_label || "Sin marca",
      category_id: selectedCategory || null,
      is_active: true,
    }));

    const { error } = await supabase.from("products").insert(payload);

    if (error) {
      toast.error("Error al importar: " + error.message);
      setImporting(false);
      return;
    }

    toast.success(`${payload.length} productos importados correctamente`);
    setImporting(false);
    setDone(true);
  };

  const updateProduct = (i: number, field: keyof ExtractedProduct, value: any) => {
    const updated = [...products];
    (updated[i] as any)[field] = value;
    setProducts(updated);
  };

  const selectedCount = products.filter((p) => p._include).length;

  return (
    <>
      <div className="flex items-center gap-4">
        <Link href="/admin/catalogo">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Importar productos desde PDF</h1>
          <p className="text-sm text-zinc-500">
            Sube un catálogo en PDF y Claude extraerá los productos automáticamente
          </p>
        </div>
      </div>

      {/* Step 1: Upload */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
              1. Seleccionar PDF
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-zinc-200 p-8 cursor-pointer hover:border-orange-300 hover:bg-orange-50/50 transition-colors"
            >
              <FileText className="h-10 w-10 text-zinc-300" />
              {selectedFile ? (
                <div className="text-center">
                  <p className="font-medium text-sm text-zinc-700">{selectedFile.name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-medium text-zinc-600">Clic para seleccionar</p>
                  <p className="text-xs text-zinc-400">PDF · máx. 10 MB</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
              2. Categoría (opcional)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-zinc-400">
              Todos los productos importados se asignarán a esta categoría. Puedes cambiarla después.
            </p>
            <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Sin categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin categoría</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
              3. Extraer con Claude
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-zinc-400">
              Claude AI leerá el PDF y detectará referencias, precios y nombres de producto automáticamente.
            </p>
            <Button
              onClick={handleExtract}
              disabled={!selectedFile || extracting}
              className="w-full"
            >
              {extracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analizando PDF...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Extraer productos
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Results table */}
      {products.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Productos detectados</CardTitle>
              <p className="text-xs text-zinc-400 mt-0.5">
                Revisa y edita antes de importar. Desmarca los que no quieras.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline">{selectedCount} seleccionados</Badge>
              <Button
                onClick={handleImport}
                disabled={importing || selectedCount === 0 || done}
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : done ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Importados
                  </>
                ) : (
                  `Importar ${selectedCount} productos`
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-zinc-50 text-xs text-zinc-500">
                    <th className="px-4 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={products.every((p) => p._include)}
                        onChange={(e) =>
                          setProducts(products.map((p) => ({ ...p, _include: e.target.checked })))
                        }
                        className="rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Referencia</th>
                    <th className="px-4 py-3 text-left font-medium">Nombre</th>
                    <th className="px-4 py-3 text-right font-medium">Precio (COP)</th>
                    <th className="px-4 py-3 text-left font-medium">Etiqueta</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => (
                    <tr
                      key={i}
                      className={`border-b last:border-0 transition-colors ${
                        p._include ? "hover:bg-zinc-50" : "opacity-40 bg-zinc-50"
                      }`}
                    >
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={p._include}
                          onChange={(e) => updateProduct(i, "_include", e.target.checked)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          value={p.reference}
                          onChange={(e) => updateProduct(i, "reference", e.target.value)}
                          className="h-7 font-mono text-xs w-28"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          value={p.name}
                          onChange={(e) => updateProduct(i, "name", e.target.value)}
                          className="h-7 text-xs min-w-[200px]"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Input
                          type="number"
                          value={p.price}
                          onChange={(e) => updateProduct(i, "price", Number(e.target.value))}
                          className="h-7 text-xs w-32 text-right ml-auto"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          value={p.price_label}
                          onChange={(e) => updateProduct(i, "price_label", e.target.value)}
                          className="h-7 text-xs w-28"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => setProducts(products.filter((_, idx) => idx !== i))}
                          className="text-zinc-300 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {done && (
        <div className="mt-6 flex items-center gap-4 rounded-lg border border-green-200 bg-green-50 p-4">
          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-green-800">Importación completada</p>
            <p className="text-sm text-green-600">Los productos ya están disponibles en el catálogo.</p>
          </div>
          <Link href="/admin/catalogo">
            <Button variant="outline" size="sm">Ver catálogo</Button>
          </Link>
        </div>
      )}
    </>
  );
}
