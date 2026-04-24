"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, ExternalLink, LayoutGrid, ImageIcon, Loader2, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function CategoriasPage() {
  const supabase = createClient();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({
    name: "", slug: "", icon: "", description: "", cover_image_url: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("display_order");
    setCategories(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchCategories(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", slug: "", icon: "", description: "", cover_image_url: "" });
    setImageFile(null);
    setImagePreview(null);
    setDialogOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon ?? "",
      description: cat.description ?? "",
      cover_image_url: cat.cover_image_url ?? "",
    });
    setImageFile(null);
    setImagePreview(cat.cover_image_url ?? null);
    setDialogOpen(true);
  };

  const generateSlug = (name: string) =>
    name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return form.cover_image_url || null;
    setUploadingImage(true);
    const ext = imageFile.name.split(".").pop();
    const path = `categories/cover-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("products")
      .upload(path, imageFile, { upsert: true, contentType: imageFile.type });
    setUploadingImage(false);
    if (error) { toast.error("Error subiendo imagen: " + error.message); return null; }
    return supabase.storage.from("products").getPublicUrl(path).data.publicUrl;
  };

  const handleSave = async () => {
    if (!form.name) { toast.error("El nombre es requerido"); return; }
    setSaving(true);
    const slug = form.slug || generateSlug(form.name);
    const coverUrl = await uploadImage();

    const payload = {
      name: form.name,
      slug,
      icon: form.icon || null,
      description: form.description || null,
      cover_image_url: coverUrl,
    };

    if (editing) {
      const { error } = await supabase.from("categories")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editing.id);
      if (error) { toast.error("Error al actualizar: " + error.message); setSaving(false); return; }
      toast.success("Categoría actualizada");
    } else {
      const { error } = await supabase.from("categories")
        .insert({ ...payload, display_order: categories.length + 1 });
      if (error) { toast.error("Error al crear: " + error.message); setSaving(false); return; }
      toast.success("Categoría creada");
    }

    setSaving(false);
    setDialogOpen(false);
    fetchCategories();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta categoría? Los productos quedarán sin categoría.")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success("Categoría eliminada");
    fetchCategories();
  };

  const handleToggleActive = async (cat: Category) => {
    await supabase.from("categories").update({ is_active: !cat.is_active }).eq("id", cat.id);
    fetchCategories();
  };

  if (loading) return <p className="text-zinc-500">Cargando...</p>;

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categorías</h1>
          <p className="text-sm text-zinc-500">{categories.length} categorías</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nueva categoría
        </Button>
      </div>

      {/* Dialog crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">

            {/* Imagen de portada */}
            <div>
              <Label>Imagen de portada</Label>
              <div
                onClick={() => fileRef.current?.click()}
                className="mt-1.5 relative cursor-pointer rounded-xl border-2 border-dashed border-zinc-200 hover:border-orange-400 transition-colors overflow-hidden"
                style={{ height: 160 }}
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="portada" className="w-full h-full object-cover" />
                    <button
                      onClick={(e) => { e.stopPropagation(); setImageFile(null); setImagePreview(null); setForm(f => ({ ...f, cover_image_url: "" })); }}
                      className="absolute top-2 right-2 bg-black/60 rounded-full p-1 hover:bg-black/80"
                    >
                      <X className="h-3.5 w-3.5 text-white" />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-400">
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-sm">Clic para subir imagen</span>
                    <span className="text-xs text-zinc-400">JPG, PNG o WEBP</span>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            </div>

            <div>
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || generateSlug(e.target.value) })}
                placeholder="Termos & Vasos"
              />
            </div>
            <div>
              <Label>Slug (URL)</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="termos"
              />
            </div>
            <div>
              <Label>Icono (emoji)</Label>
              <Input
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                placeholder="🥤"
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descripción opcional"
              />
            </div>
            <Button onClick={handleSave} className="w-full" disabled={saving || uploadingImage}>
              {(saving || uploadingImage) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editing ? "Guardar cambios" : "Crear categoría"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="mt-6">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead className="w-16">Foto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat, i) => (
                <TableRow key={cat.id}>
                  <TableCell className="text-zinc-400">{i + 1}</TableCell>
                  <TableCell>
                    {cat.cover_image_url ? (
                      <img
                        src={cat.cover_image_url}
                        alt={cat.name}
                        className="h-10 w-14 rounded-md object-cover border border-zinc-100"
                      />
                    ) : (
                      <div className="h-10 w-14 rounded-md bg-zinc-100 flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-zinc-400" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {cat.icon && <span className="mr-2">{cat.icon}</span>}
                    <span translate="no">{cat.name}</span>
                  </TableCell>
                  <TableCell className="text-zinc-500">
                    <div className="flex items-center gap-1.5">
                      <span translate="no">{cat.slug}</span>
                      <a href={`/catalogo/${cat.slug}`} target="_blank" rel="noopener noreferrer"
                        className="text-zinc-400 hover:text-orange-400 transition-colors">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={cat.is_active ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => handleToggleActive(cat)}
                    >
                      {cat.is_active ? "Activa" : "Inactiva"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/catalogo/categorias/${cat.id}`}>
                      <Button variant="ghost" size="icon" title="Ver productos">
                        <LayoutGrid className="h-4 w-4 text-orange-500" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(cat.id)}>
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
