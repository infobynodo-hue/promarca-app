"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Client } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Pencil, Trash2, ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

const emptyForm = {
  name: "",
  company: "",
  email: "",
  phone: "",
  nit: "",
  address: "",
  city: "",
  notes: "",
};

export default function ClientesPage() {
  const supabase = createClient();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchClients = async () => {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    setClients(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({
      name: c.name,
      company: c.company ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      nit: c.nit ?? "",
      address: c.address ?? "",
      city: c.city ?? "",
      notes: c.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("El nombre es obligatorio"); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      company: form.company.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      nit: form.nit.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (editing) {
      const { error } = await supabase.from("clients").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Cliente actualizado");
    } else {
      const { error } = await supabase.from("clients").insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Cliente creado");
    }
    setSaving(false);
    setDialogOpen(false);
    fetchClients();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este cliente?")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Cliente eliminado");
    fetchClients();
  };

  const filtered = clients.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.company ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.nit ?? "").includes(q)
    );
  });

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  if (loading) return <p className="text-zinc-500">Cargando...</p>;

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-zinc-500">{clients.length} clientes registrados</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo cliente
        </Button>
      </div>

      {/* Search */}
      <div className="mt-6 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, empresa, NIT..."
          className="pl-10"
        />
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>NIT</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-zinc-400">
                    {search ? "Sin resultados para esa búsqueda." : "No hay clientes aún."}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-zinc-500">{c.company || "—"}</TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="block text-xs text-blue-500 hover:underline">
                          {c.email}
                        </a>
                      )}
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="block text-xs text-zinc-500">
                          {c.phone}
                        </a>
                      )}
                      {!c.email && !c.phone && <span className="text-zinc-400">—</span>}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-zinc-500">{c.nit || "—"}</TableCell>
                  <TableCell className="text-zinc-500">{c.city || "—"}</TableCell>
                  <TableCell className="text-xs text-zinc-400">{formatDate(c.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/clientes/${c.id}`}>
                      <Button variant="ghost" size="icon" title="Ver detalle">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href={`/admin/cotizaciones/nueva?cliente=${c.id}`}>
                      <Button variant="ghost" size="icon" title="Nueva cotización">
                        <FileText className="h-4 w-4 text-orange-500" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog create / edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Nombre *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Juan Pérez"
              />
            </div>
            <div>
              <Label>Empresa</Label>
              <Input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="Empresa S.A.S."
              />
            </div>
            <div>
              <Label>NIT</Label>
              <Input
                value={form.nit}
                onChange={(e) => setForm({ ...form, nit: e.target.value })}
                placeholder="900.123.456-7"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="juan@empresa.co"
              />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+57 300 000 0000"
              />
            </div>
            <div>
              <Label>Ciudad</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Bogotá"
              />
            </div>
            <div>
              <Label>Dirección</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Calle 123 # 45-67"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Notas internas</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Cualquier detalle relevante del cliente..."
                rows={3}
              />
            </div>
            <div className="sm:col-span-2">
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear cliente"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
