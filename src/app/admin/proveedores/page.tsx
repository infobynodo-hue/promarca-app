"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Provider } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  marcacion: { label: "Marcación",  color: "bg-purple-100 text-purple-700" },
  logistica: { label: "Logística",  color: "bg-blue-100 text-blue-700" },
  insumos:   { label: "Insumos",    color: "bg-yellow-100 text-yellow-700" },
  general:   { label: "General",    color: "bg-zinc-100 text-zinc-600" },
};

const EMPTY_FORM = {
  name: "",
  type: "general",
  phone: "",
  email: "",
  notes: "",
  is_active: true,
};

export default function ProveedoresPage() {
  const supabase = createClient();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchProviders = async () => {
    const { data } = await supabase
      .from("providers")
      .select("*")
      .order("name");
    setProviders(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchProviders(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (p: Provider) => {
    setEditing(p);
    setForm({
      name: p.name,
      type: p.type,
      phone: p.phone ?? "",
      email: p.email ?? "",
      notes: p.notes ?? "",
      is_active: p.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("El nombre es requerido"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        phone: form.phone || null,
        email: form.email || null,
        notes: form.notes || null,
        is_active: form.is_active,
      };

      if (editing) {
        const { error } = await supabase.from("providers").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Proveedor actualizado");
      } else {
        const { error } = await supabase.from("providers").insert(payload);
        if (error) throw error;
        toast.success("Proveedor creado");
      }
      setDialogOpen(false);
      await fetchProviders();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (p: Provider) => {
    await supabase.from("providers").update({ is_active: !p.is_active }).eq("id", p.id);
    toast.success(p.is_active ? "Proveedor desactivado" : "Proveedor activado");
    await fetchProviders();
  };

  const handleDelete = async (p: Provider) => {
    if (!confirm(`¿Eliminar proveedor "${p.name}"? Si tiene costos asociados, será desactivado.`)) return;
    const res = await fetch(`/api/providers/${p.id}`, { method: "DELETE" });
    const json = await res.json();
    toast.success(json.message ?? "Eliminado");
    await fetchProviders();
  };

  const active = providers.filter((p) => p.is_active);
  const inactive = providers.filter((p) => !p.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/pedidos">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Proveedores</h1>
          <p className="text-sm text-zinc-500">Catálogo de proveedores reutilizable en pedidos</p>
        </div>
        <Button onClick={openNew} className="gap-2 bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="h-4 w-4" />
          Nuevo proveedor
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total",     value: providers.length, color: "text-zinc-700" },
          { label: "Activos",   value: active.length,    color: "text-green-600" },
          { label: "Inactivos", value: inactive.length,  color: "text-zinc-400" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-zinc-500">{s.label}</p>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-zinc-400">Cargando...</div>
        ) : providers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-400 font-medium">No hay proveedores</p>
            <p className="text-sm text-zinc-400 mt-1">Crea tu primer proveedor para usarlo en pedidos</p>
            <Button onClick={openNew} className="mt-4 bg-orange-500 hover:bg-orange-600 text-white gap-2">
              <Plus className="h-4 w-4" /> Crear proveedor
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50">
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((p) => {
                const tc = TYPE_LABELS[p.type] ?? TYPE_LABELS.general;
                return (
                  <TableRow key={p.id} className={p.is_active ? "" : "opacity-50"}>
                    <TableCell>
                      <p className="font-medium">{p.name}</p>
                      {p.notes && <p className="text-xs text-zinc-400 truncate max-w-[200px]">{p.notes}</p>}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tc.color}`}>
                        {tc.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-zinc-600">{p.phone ?? "—"}</TableCell>
                    <TableCell className="text-sm text-zinc-600">{p.email ?? "—"}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleToggleActive(p)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full cursor-pointer transition-colors ${
                          p.is_active
                            ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700"
                            : "bg-zinc-100 text-zinc-500 hover:bg-green-100 hover:text-green-700"
                        }`}
                      >
                        {p.is_active ? "Activo" : "Inactivo"}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-400 hover:text-zinc-700"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-400 hover:text-red-500"
                          onClick={() => handleDelete(p)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Nombre *</label>
              <Input
                placeholder="Ej: Bordados Express"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Tipo</label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v ?? "general" })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="marcacion">Marcación</SelectItem>
                  <SelectItem value="logistica">Logística</SelectItem>
                  <SelectItem value="insumos">Insumos</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Teléfono</label>
                <Input
                  placeholder="+57 300..."
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Email</label>
                <Input
                  type="email"
                  placeholder="proveedor@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Notas</label>
              <Textarea
                placeholder="Información adicional..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {saving ? "Guardando..." : editing ? "Actualizar" : "Crear proveedor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
