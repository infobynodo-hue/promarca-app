"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Columns2, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface Props {
  originalUrl: string;
  generatedUrl: string;
  productId?: string;
  onRegenerate: () => void;
  generating: boolean;
}

export function ResultPreview({ originalUrl, generatedUrl, productId, onRegenerate, generating }: Props) {
  const supabase = createClient();
  const [comparing, setComparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = generatedUrl;
    a.download = `producto-ia-${Date.now()}.jpg`;
    a.target = "_blank";
    a.click();
  };

  const handleSaveToProduct = async () => {
    if (!productId) {
      toast.error("No hay producto asignado");
      return;
    }
    setSaving(true);
    try {
      // Fetch the image and upload to products bucket
      const res = await fetch(generatedUrl);
      const blob = await res.blob();
      const path = `${productId}/ai-${Date.now()}.jpg`;

      const { error: upErr } = await supabase.storage
        .from("products")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });

      if (upErr) throw new Error(upErr.message);

      // Insert into product_images
      const { error: dbErr } = await supabase.from("product_images").insert({
        product_id: productId,
        storage_path: path,
        alt_text: "Foto generada con IA",
        is_primary: false,
        display_order: 99,
      });

      if (dbErr) throw new Error(dbErr.message);
      setSaved(true);
      toast.success("Foto guardada en el producto ✓");
    } catch (err: any) {
      toast.error("Error al guardar: " + err.message);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-700">Resultado generado</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setComparing(!comparing)} className="gap-1.5">
            <Columns2 className="h-3.5 w-3.5" />
            {comparing ? "Solo resultado" : "Comparar"}
          </Button>
        </div>
      </div>

      {comparing ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1.5 text-xs text-center text-zinc-500">Original</p>
            <img src={originalUrl} alt="Original" className="h-64 w-full rounded-xl object-contain border border-zinc-200 bg-zinc-50" />
          </div>
          <div>
            <p className="mb-1.5 text-xs text-center text-zinc-700 font-medium">Generado con IA ✨</p>
            <img src={generatedUrl} alt="Generado" className="h-64 w-full rounded-xl object-contain border border-orange-200 bg-zinc-50 shadow-sm" />
          </div>
        </div>
      ) : (
        <div className="relative rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-50 shadow-sm">
          <img src={generatedUrl} alt="Foto generada con IA" className="w-full object-contain max-h-[500px]" />
          <div className="absolute top-3 right-3 bg-black/60 text-white text-xs rounded-full px-2.5 py-1 backdrop-blur-sm">
            ✨ Generado con IA
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <Button onClick={handleDownload} className="gap-2 flex-1">
          <Download className="h-4 w-4" /> Descargar foto
        </Button>
        {productId && (
          <Button
            variant="outline"
            onClick={handleSaveToProduct}
            disabled={saving || saved}
            className="gap-2 flex-1"
          >
            {saved ? (
              <><CheckCircle className="h-4 w-4 text-green-500" /> Guardada en producto</>
            ) : saving ? (
              "Guardando..."
            ) : (
              "Guardar en producto"
            )}
          </Button>
        )}
        <Button variant="ghost" onClick={onRegenerate} disabled={generating} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
          Regenerar
        </Button>
      </div>
    </div>
  );
}
