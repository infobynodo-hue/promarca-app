"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProductImage } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Star, Loader2, ImageOff, Plus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  productId: string;
  productName: string;
  productRef: string;
  open: boolean;
  onClose: () => void;
  onImagesChanged?: () => void;
}

export function ProductImageModal({
  productId,
  productName,
  productRef,
  open,
  onClose,
  onImagesChanged,
}: Props) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchImages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("product_images")
      .select("*")
      .eq("product_id", productId)
      .order("display_order");
    setImages(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchImages();
  }, [open, productId]);

  const getUrl = (path: string) =>
    supabase.storage.from("products").getPublicUrl(path).data.publicUrl;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);

    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${productId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("products")
        .upload(path, file, { upsert: false });
      if (upErr) { toast.error("Error subiendo " + file.name); continue; }

      await supabase.from("product_images").insert({
        product_id: productId,
        storage_path: path,
        is_primary: images.length === 0,
        display_order: images.length,
        alt_text: null,
      });
    }

    toast.success(`${files.length} imagen${files.length > 1 ? "es" : ""} subida${files.length > 1 ? "s" : ""}`);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await fetchImages();
    onImagesChanged?.();
  };

  const handleDelete = async (img: ProductImage) => {
    await supabase.storage.from("products").remove([img.storage_path]);
    await supabase.from("product_images").delete().eq("id", img.id);
    const remaining = images.filter((i) => i.id !== img.id);
    if (img.is_primary && remaining.length > 0) {
      await supabase.from("product_images").update({ is_primary: true }).eq("id", remaining[0].id);
      remaining[0] = { ...remaining[0], is_primary: true };
    }
    setImages(remaining);
    onImagesChanged?.();
    toast.success("Imagen eliminada");
  };

  const handleSetPrimary = async (img: ProductImage) => {
    if (img.is_primary) return;
    await supabase.from("product_images").update({ is_primary: false }).eq("product_id", productId);
    await supabase.from("product_images").update({ is_primary: true }).eq("id", img.id);
    setImages(images.map((i) => ({ ...i, is_primary: i.id === img.id })));
    onImagesChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono text-sm text-zinc-400">{productRef}</span>
            <span>{productName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              {images.length}/4 imágenes · La ⭐ se muestra en catálogo
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={uploading || images.length >= 4}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Upload className="mr-1 h-3 w-3" />
              )}
              {uploading ? "Subiendo..." : "Subir fotos"}
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
            </div>
          ) : images.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-200 py-10 cursor-pointer hover:border-orange-300 hover:bg-orange-50/50 transition-colors"
            >
              <ImageOff className="h-8 w-8 text-zinc-300" />
              <p className="text-sm text-zinc-400">Sin imágenes — clic para subir</p>
              <p className="text-xs text-zinc-300">JPG, PNG, WEBP · hasta 4 fotos</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {images.map((img) => (
                <div key={img.id} className="group relative">
                  <div className="aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                    <img
                      src={getUrl(img.storage_path)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {img.is_primary && (
                    <span className="absolute top-1 left-1 rounded bg-orange-500 px-1 py-0.5 text-[9px] font-bold text-white">
                      Principal
                    </span>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center gap-1 rounded-lg bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
                    {!img.is_primary && (
                      <button
                        onClick={() => handleSetPrimary(img)}
                        className="rounded bg-white/90 p-1 hover:bg-white"
                        title="Hacer principal"
                      >
                        <Star className="h-3 w-3 text-orange-500" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(img)}
                      className="rounded bg-white/90 p-1 hover:bg-white"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
              {images.length < 4 && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square flex items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 cursor-pointer hover:border-orange-300 hover:bg-orange-50/50 transition-colors"
                >
                  <Plus className="h-5 w-5 text-zinc-300" />
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
