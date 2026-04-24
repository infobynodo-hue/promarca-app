"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PromoCard } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Pencil, Trash2, ImageIcon, Loader2, X,
  GripVertical, ExternalLink, Moon, Sun,
} from "lucide-react";
import { toast } from "sonner";

export default function DestacadosPage() {
  const supabase = createClient();
  const [cards, setCards] = useState<PromoCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<PromoCard | null>(null);

  const [form, setForm] = useState({
    eyebrow: "", title: "", subtitle: "", catalog_slug: "",
    image_url: "", is_dark: false, is_active: true,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchCards = async () => {
    const { data } = await supabase
      .from("promo_cards")
      .select("*")
      .order("display_order");
    setCards(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchCards(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ eyebrow: "", title: "", subtitle: "", catalog_slug: "", image_url: "", is_dark: false, is_active: true });
    setImageFile(null);
    setImagePreview(null);
    setDialogOpen(true);
  };

  const openEdit = (card: PromoCard) => {
    setEditing(card);
    setForm({
      eyebrow: card.eyebrow,
      title: card.title,
      subtitle: card.subtitle ?? "",
      catalog_slug: card.catalog_slug ?? "",
      image_url: card.image_url ?? "",
      is_dark: card.is_dark,
      is_active: card.is_active,
    });
    setImageFile(null);
    setImagePreview(card.image_url ?? null);
    setDialogOpen(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return form.image_url || null;
    const ext = imageFile.name.split(".").pop();
    const path = `destacados/card-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("products")
      .upload(path, imageFile, { upsert: true, contentType: imageFile.type });
    if (error) { toast.error("Error subiendo imagen: " + error.message); return null; }
    return supabase.storage.from("products").getPublicUrl(path).data.publicUrl;
  };

  const handleSave = async () => {
    if (!form.title) { toast.error("El título es requerido"); return; }
    setSaving(true);

    const imageUrl = await uploadImage();
    const payload = {
      eyebrow: form.eyebrow,
      title: form.title,
      subtitle: form.subtitle || null,
      catalog_slug: form.catalog_slug || null,
      image_url: imageUrl,
      is_dark: form.is_dark,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    if (editing) {
      const { error } = await supabase.from("promo_cards").update(payload).eq("id", editing.id);
      if (error) { toast.error("Error: " + error.message); setSaving(false); return; }
      toast.success("Destacado actualizado");
    } else {
      const { error } = await supabase.from("promo_cards")
        .insert({ ...payload, display_order: cards.length + 1 });
      if (error) { toast.error("Error: " + error.message); setSaving(false); return; }
      toast.success("Destacado creado");
    }

    setSaving(false);
    setDialogOpen(false);
    fetchCards();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este destacado?")) return;
    const { error } = await supabase.from("promo_cards").delete().eq("id", id);
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success("Eliminado");
    fetchCards();
  };

  const handleToggleActive = async (card: PromoCard) => {
    await supabase.from("promo_cards")
      .update({ is_active: !card.is_active, updated_at: new Date().toISOString() })
      .eq("id", card.id);
    fetchCards();
  };

  const moveCard = async (card: PromoCard, direction: "up" | "down") => {
    const idx = cards.findIndex((c) => c.id === card.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= cards.length) return;

    const other = cards[swapIdx];
    await Promise.all([
      supabase.from("promo_cards").update({ display_order: other.display_order }).eq("id", card.id),
      supabase.from("promo_cards").update({ display_order: card.display_order }).eq("id", other.id),
    ]);
    fetchCards();
  };

  if (loading) return <p className="text-zinc-500">Cargando...</p>;

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Destacados</h1>
          <p className="text-sm text-zinc-500">
            Sección especial del homepage — {cards.length} tarjetas
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nueva tarjeta
        </Button>
      </div>

      {/* Preview grid */}
      <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100">
        {cards.filter(c => c.is_active).slice(0, 4).map((card) => (
          <div
            key={card.id}
            className="relative overflow-hidden flex flex-col justify-end p-5 min-h-[140px]"
            style={{ background: card.is_dark ? "#1d1d1f" : "#f5f5f7" }}
          >
            {card.image_url && (
              <img
                src={card.image_url}
                alt={card.title}
                className="absolute right-0 bottom-0 h-full w-[55%] object-cover pointer-events-none"
                style={{
                  maskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 22%, rgba(0,0,0,1) 48%)",
                  WebkitMaskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 22%, rgba(0,0,0,1) 48%)",
                }}
              />
            )}
            <div className="relative z-10 max-w-[52%]">
              <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider mb-1">{card.eyebrow}</p>
              <p className="text-sm font-bold leading-tight" style={{ color: card.is_dark ? "#f5f5f7" : "#1d1d1f" }}>
                {card.title}
              </p>
            </div>
          </div>
        ))}
        {cards.filter(c => c.is_active).length === 0 && (
          <div className="col-span-2 py-10 text-center text-zinc-400 text-sm">
            No hay tarjetas activas — activa algunas para ver la preview
          </div>
        )}
      </div>
      <p className="text-xs text-zinc-400 mt-2 text-right">Preview del homepage (solo las 4 primeras activas)</p>

      {/* Cards list */}
      <div className="mt-6 space-y-3">
        {cards.map((card, i) => (
          <Card key={card.id} className={`transition-opacity ${!card.is_active ? "opacity-50" : ""}`}>
            <CardContent className="p-4 flex items-center gap-4">
              {/* Thumb */}
              <div className="shrink-0">
                {card.image_url ? (
                  <img src={card.image_url} alt={card.title}
                    className="h-14 w-20 rounded-lg object-cover border border-zinc-100" />
                ) : (
                  <div className="h-14 w-20 rounded-lg bg-zinc-100 flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-zinc-400" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[11px] font-semibold text-orange-500 uppercase tracking-wide">{card.eyebrow}</span>
                  {card.is_dark
                    ? <Moon className="h-3 w-3 text-zinc-400" />
                    : <Sun className="h-3 w-3 text-zinc-300" />}
                </div>
                <p className="font-semibold text-sm truncate">{card.title}</p>
                {card.subtitle && (
                  <p className="text-xs text-zinc-400 truncate">{card.subtitle}</p>
                )}
                {card.catalog_slug && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs text-zinc-400">/catalogo/{card.catalog_slug}</span>
                    <a href={`/catalogo/${card.catalog_slug}`} target="_blank" rel="noopener noreferrer"
                      className="text-zinc-400 hover:text-orange-500">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Order controls */}
              <div className="flex flex-col gap-1">
                <button onClick={() => moveCard(card, "up")} disabled={i === 0}
                  className="text-zinc-300 hover:text-zinc-700 disabled:opacity-20 px-1">▲</button>
                <span className="text-xs text-zinc-400 text-center">{i + 1}</span>
                <button onClick={() => moveCard(card, "down")} disabled={i === cards.length - 1}
                  className="text-zinc-300 hover:text-zinc-700 disabled:opacity-20 px-1">▼</button>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <Badge
                  variant={card.is_active ? "default" : "secondary"}
                  className="cursor-pointer text-xs"
                  onClick={() => handleToggleActive(card)}
                >
                  {card.is_active ? "Activo" : "Oculto"}
                </Badge>
                <Button variant="ghost" size="icon" onClick={() => openEdit(card)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(card.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar destacado" : "Nuevo destacado"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">

            {/* Image upload */}
            <div>
              <Label>Imagen del producto</Label>
              <div
                onClick={() => fileRef.current?.click()}
                className="mt-1.5 relative cursor-pointer rounded-xl border-2 border-dashed border-zinc-200 hover:border-orange-400 transition-colors overflow-hidden"
                style={{ height: 160 }}
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                    <button
                      onClick={(e) => { e.stopPropagation(); setImageFile(null); setImagePreview(null); setForm(f => ({ ...f, image_url: "" })); }}
                      className="absolute top-2 right-2 bg-black/60 rounded-full p-1 hover:bg-black/80"
                    >
                      <X className="h-3.5 w-3.5 text-white" />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-400">
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-sm">Clic para subir imagen</span>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Etiqueta (eyebrow)</Label>
                <Input value={form.eyebrow} onChange={(e) => setForm({ ...form, eyebrow: e.target.value })}
                  placeholder="Más vendido" />
              </div>
              <div>
                <Label>Slug catálogo</Label>
                <Input value={form.catalog_slug} onChange={(e) => setForm({ ...form, catalog_slug: e.target.value })}
                  placeholder="termos" />
              </div>
            </div>

            <div>
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Termos Premium" />
            </div>

            <div>
              <Label>Descripción corta</Label>
              <Textarea value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                placeholder="Acero inoxidable con doble pared..." rows={2} className="resize-none" />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Fondo oscuro</p>
                <p className="text-xs text-zinc-500">Activa para tarjeta negra</p>
              </div>
              <Switch checked={form.is_dark} onCheckedChange={(v: boolean) => setForm({ ...form, is_dark: v })} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Visible en homepage</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(v: boolean) => setForm({ ...form, is_active: v })} />
            </div>

            <Button onClick={handleSave} className="w-full" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editing ? "Guardar cambios" : "Crear destacado"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
