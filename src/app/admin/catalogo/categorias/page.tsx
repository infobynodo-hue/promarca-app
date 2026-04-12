"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function CategoriasPage() {
  const supabase = createClient();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", icon: "", description: "" });

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("display_order");
    setCategories(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", slug: "", icon: "", description: "" });
    setDialogOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon ?? "",
      description: cat.description ?? "",
    });
    setDialogOpen(true);
  };

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const handleSave = async () => {
    const slug = form.slug || generateSlug(form.name);
    const payload = {
      name: form.name,
      slug,
      icon: form.icon || null,
      description: form.description || null,
    };

    if (editing) {
      const { error } = await supabase
        .from("categories")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editing.id);
      if (error) {
        toast.error("Error al actualizar: " + error.message);
        return;
      }
      toast.success("Categoría actualizada");
    } else {
      const { error } = await supabase
        .from("categories")
        .insert({ ...payload, display_order: categories.length + 1 });
      if (error) {
        toast.error("Error al crear: " + error.message);
        return;
      }
      toast.success("Categoría creada");
    }

    setDialogOpen(false);
    fetchCategories();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta categoría? Los productos quedarán sin categoría."))
      return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      toast.error("Error: " + error.message);
      return;
    }
    toast.success("Categoría eliminada");
    fetchCategories();
  };

  const handleToggleActive = async (cat: Category) => {
    await supabase
      .from("categories")
      .update({ is_active: !cat.is_active })
      .eq("id", cat.id);
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
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Editar categoría" : "Nueva categoría"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Nombre</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: e.target.value,
                      slug: form.slug || generateSlug(e.target.value),
                    })
                  }
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
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Descripción opcional"
                />
              </div>
              <Button onClick={handleSave} className="w-full">
                {editing ? "Guardar cambios" : "Crear categoría"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="mt-6">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
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
                  <TableCell className="font-medium">
                    {cat.icon && <span className="mr-2">{cat.icon}</span>}
                    {cat.name}
                  </TableCell>
                  <TableCell className="text-zinc-500">{cat.slug}</TableCell>
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(cat)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(cat.id)}
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
