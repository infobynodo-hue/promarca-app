"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Archive, CheckCircle2, XCircle, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import JSZip from "jszip";

interface MatchRow {
  filename: string;
  reference: string;
  productId: string | null;
  productName: string | null;
  blob: Blob;
  status: "pending" | "uploading" | "done" | "error";
}

function parseReference(filename: string): string {
  // Remove extension
  const noExt = filename.replace(/\.[^.]+$/, "");
  // Remove trailing _1, _2, _3 etc.
  const ref = noExt.replace(/_\d+$/, "").toUpperCase().trim();
  return ref;
}

export default function SubirImagenesPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [products, setProducts] = useState<{ id: string; name: string; reference: string }[]>([]);
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [reading, setReading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase
      .from("products")
      .select("id, name, reference")
      .then(({ data }) => setProducts(data ?? []));
  }, []);

  const handleZipSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".zip")) { toast.error("Seleccioná un archivo .zip"); return; }

    setReading(true);
    setRows([]);
    setDone(false);

    try {
      const zip = new JSZip();
      const loaded = await zip.loadAsync(file);
      const refMap = new Map(products.map((p) => [p.reference.toUpperCase(), p]));

      const newRows: MatchRow[] = [];

      for (const [path, entry] of Object.entries(loaded.files)) {
        if (entry.dir) continue;
        const filename = path.split("/").pop()!;
        // Skip hidden files
        if (filename.startsWith(".") || filename.startsWith("__")) continue;
        // Only images
        if (!/\.(jpg|jpeg|png|webp)$/i.test(filename)) continue;

        const ref = parseReference(filename);
        const product = refMap.get(ref) ?? null;
        const blob = await entry.async("blob");

        newRows.push({
          filename,
          reference: ref,
          productId: product?.id ?? null,
          productName: product?.name ?? null,
          blob,
          status: "pending",
        });
      }

      // Sort: matches first
      newRows.sort((a, b) => {
        if (a.productId && !b.productId) return -1;
        if (!a.productId && b.productId) return 1;
        return a.reference.localeCompare(b.reference);
      });

      setRows(newRows);
      const matched = newRows.filter((r) => r.productId).length;
      toast.success(`ZIP leído: ${matched} imágenes con producto · ${newRows.length - matched} sin coincidencia`);
    } catch (err) {
      toast.error("Error al leer el ZIP");
      console.error(err);
    } finally {
      setReading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    const toUpload = rows.filter((r) => r.productId && r.status === "pending");
    if (!toUpload.length) { toast.error("No hay imágenes para subir"); return; }

    setUploading(true);

    for (const row of toUpload) {
      setRows((prev) =>
        prev.map((r) => r.filename === row.filename ? { ...r, status: "uploading" } : r)
      );

      try {
        // Get current image count for this product
        const { data: existing } = await supabase
          .from("product_images")
          .select("id, is_primary")
          .eq("product_id", row.productId!);

        const count = existing?.length ?? 0;
        if (count >= 4) {
          setRows((prev) =>
            prev.map((r) => r.filename === row.filename ? { ...r, status: "error" } : r)
          );
          continue;
        }

        const ext = row.filename.split(".").pop();
        const path = `${row.productId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("products")
          .upload(path, row.blob, { upsert: false });

        if (upErr) throw upErr;

        await supabase.from("product_images").insert({
          product_id: row.productId,
          storage_path: path,
          is_primary: count === 0,
          display_order: count,
          alt_text: null,
        });

        setRows((prev) =>
          prev.map((r) => r.filename === row.filename ? { ...r, status: "done" } : r)
        );
      } catch (err: any) {
        setRows((prev) =>
          prev.map((r) => r.filename === row.filename ? { ...r, status: "error" } : r)
        );
      }
    }

    setUploading(false);
    setDone(true);
    const doneCount = rows.filter((r) => r.status === "done" || r.productId).length;
    toast.success("¡Imágenes subidas correctamente!");
  };

  const matched = rows.filter((r) => r.productId);
  const unmatched = rows.filter((r) => !r.productId);

  return (
    <>
      <div className="flex items-center gap-4">
        <Link href="/admin/catalogo">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subir imágenes por ZIP</h1>
          <p className="text-sm text-zinc-500">
            Nombra las imágenes con el código del producto y cargalas todas de una vez
          </p>
        </div>
      </div>

      {/* Instructions */}
      <Card className="mt-6 border-orange-100 bg-orange-50/50">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-orange-800 mb-2">Formato de nombres de archivo</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-orange-700">
            <div>
              <p className="font-mono bg-white rounded px-2 py-1 border border-orange-100">VA-1029.jpg</p>
              <p className="mt-0.5 text-orange-500">→ 1 imagen para VA-1029</p>
            </div>
            <div>
              <p className="font-mono bg-white rounded px-2 py-1 border border-orange-100">VA-1029_2.jpg</p>
              <p className="mt-0.5 text-orange-500">→ 2ª imagen para VA-1029</p>
            </div>
            <div>
              <p className="font-mono bg-white rounded px-2 py-1 border border-orange-100">LAP-001_1.png</p>
              <p className="mt-0.5 text-orange-500">→ 1ª imagen para LAP-001</p>
            </div>
            <div>
              <p className="font-mono bg-white rounded px-2 py-1 border border-orange-100">MU-321_3.webp</p>
              <p className="mt-0.5 text-orange-500">→ 3ª imagen para MU-321</p>
            </div>
          </div>
          <p className="text-xs text-orange-500 mt-2">Máximo 4 imágenes por producto · Formatos: JPG, PNG, WEBP</p>
        </CardContent>
      </Card>

      {/* Upload zone */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-zinc-500 uppercase tracking-wider font-semibold">
              1. Seleccionar ZIP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <input ref={fileInputRef} type="file" accept=".zip" className="hidden" onChange={handleZipSelect} />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-zinc-200 p-8 cursor-pointer hover:border-orange-300 hover:bg-orange-50/50 transition-colors"
            >
              <Archive className="h-10 w-10 text-zinc-300" />
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-600">Clic para seleccionar</p>
                <p className="text-xs text-zinc-400">Archivo .zip con las imágenes</p>
              </div>
            </div>
            {reading && (
              <div className="mt-3 flex items-center gap-2 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Leyendo ZIP...
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-zinc-500 uppercase tracking-wider font-semibold">
              2. Resumen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-green-50 border border-green-100 px-3 py-2">
              <span className="text-sm text-green-700">Con producto</span>
              <Badge className="bg-green-600">{matched.length}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2">
              <span className="text-sm text-zinc-500">Sin coincidencia</span>
              <Badge variant="secondary">{unmatched.length}</Badge>
            </div>
            <p className="text-xs text-zinc-400">
              Las imágenes sin coincidencia se ignoran.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-zinc-500 uppercase tracking-wider font-semibold">
              3. Subir
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-zinc-400">
              Sube todas las imágenes coincidentes al catálogo de una sola vez.
            </p>
            <Button
              onClick={handleUpload}
              disabled={matched.length === 0 || uploading || done}
              className="w-full"
            >
              {uploading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Subiendo...</>
              ) : done ? (
                <><CheckCircle2 className="mr-2 h-4 w-4" />Completado</>
              ) : (
                <><Upload className="mr-2 h-4 w-4" />Subir {matched.length} imágenes</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Preview table */}
      {rows.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Contenido del ZIP</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-zinc-50 text-xs text-zinc-500">
                    <th className="px-4 py-3 text-left font-medium w-8"></th>
                    <th className="px-4 py-3 text-left font-medium">Archivo</th>
                    <th className="px-4 py-3 text-left font-medium">Referencia detectada</th>
                    <th className="px-4 py-3 text-left font-medium">Producto</th>
                    <th className="px-4 py-3 text-center font-medium w-24">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className={`border-b last:border-0 ${!row.productId ? "opacity-40" : ""}`}>
                      <td className="px-4 py-2 text-center">
                        {row.productId ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="h-4 w-4 text-zinc-300 mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-zinc-600">{row.filename}</td>
                      <td className="px-4 py-2 font-mono text-xs font-bold text-zinc-800">{row.reference}</td>
                      <td className="px-4 py-2 text-xs">
                        {row.productName ?? <span className="text-zinc-400">Sin coincidencia</span>}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {row.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-orange-500 mx-auto" />}
                        {row.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />}
                        {row.status === "error" && <XCircle className="h-4 w-4 text-red-400 mx-auto" />}
                        {row.status === "pending" && row.productId && <span className="text-xs text-zinc-300">—</span>}
                        {row.status === "pending" && !row.productId && <span className="text-xs text-zinc-300">Ignorar</span>}
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
            <p className="font-medium text-green-800">Imágenes subidas correctamente</p>
            <p className="text-sm text-green-600">Podés verlas en la vista galería del catálogo.</p>
          </div>
          <Link href="/admin/catalogo">
            <Button variant="outline" size="sm">Ver catálogo</Button>
          </Link>
        </div>
      )}
    </>
  );
}
