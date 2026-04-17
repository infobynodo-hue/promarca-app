"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ShieldCheck, User, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ALL_PERMISSIONS: { key: string; label: string }[] = [
  { key: "dashboard",      label: "Dashboard" },
  { key: "catalogo",       label: "Productos / Catálogo" },
  { key: "categorias",     label: "Categorías" },
  { key: "cotizaciones",   label: "Cotizaciones" },
  { key: "campanas",       label: "Ventas B2C" },
  { key: "pro",            label: "Pro (IA)" },
  { key: "clientes",       label: "Clientes" },
  { key: "mockups",        label: "Mockups" },
  { key: "fotos",          label: "Fotos con IA" },
  { key: "integraciones",  label: "Integraciones" },
  { key: "usuarios",       label: "Gestión de usuarios" },
];

const DEFAULT_PERMISSIONS = Object.fromEntries(
  ALL_PERMISSIONS.map(({ key }) => [key, key === "dashboard" || key === "catalogo" || key === "cotizaciones" || key === "clientes"])
);

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "staff";
  permissions: Record<string, boolean>;
  is_active: boolean;
  last_sign_in_at: string | null;
  created_at: string;
}

interface FormState {
  email: string;
  password: string;
  full_name: string;
  role: "admin" | "staff";
  permissions: Record<string, boolean>;
}

const emptyForm = (): FormState => ({
  email: "",
  password: "",
  full_name: "",
  role: "staff",
  permissions: { ...DEFAULT_PERMISSIONS },
});

export default function UsuariosPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"new" | "edit" | null>(null);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm(emptyForm());
    setModal("new");
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setForm({
      email: u.email,
      password: "",
      full_name: u.full_name ?? "",
      role: u.role,
      permissions: { ...DEFAULT_PERMISSIONS, ...u.permissions },
    });
    setModal("edit");
  }

  async function handleSave() {
    if (!form.email) { toast.error("El email es requerido"); return; }
    if (modal === "new" && !form.password) { toast.error("La contraseña es requerida"); return; }

    setSaving(true);
    try {
      if (modal === "new") {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) { toast.error(data.error); return; }
        toast.success("Usuario creado correctamente");
      } else if (modal === "edit" && editing) {
        const body: Record<string, unknown> = {
          full_name: form.full_name,
          role: form.role,
          permissions: form.permissions,
        };
        if (form.password) body.password = form.password;
        if (form.email !== editing.email) body.email = form.email;

        const res = await fetch(`/api/admin/users/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) { toast.error(data.error); return; }
        toast.success("Usuario actualizado");
      }
      setModal(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: UserRow) {
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !u.is_active }),
    });
    if (res.ok) {
      toast.success(u.is_active ? "Usuario desactivado" : "Usuario activado");
      await load();
    }
  }

  async function handleDelete(u: UserRow) {
    if (!confirm(`¿Eliminar permanentemente a ${u.email}? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error); return; }
    toast.success("Usuario eliminado");
    await load();
  }

  function togglePerm(key: string) {
    setForm((f) => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } }));
  }

  function setAllPerms(val: boolean) {
    setForm((f) => ({
      ...f,
      permissions: Object.fromEntries(ALL_PERMISSIONS.map(({ key }) => [key, val])),
    }));
  }

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Usuarios</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Gestiona quién tiene acceso al panel y qué puede ver.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={openNew} className="bg-orange-500 hover:bg-orange-600 gap-2">
            <Plus className="h-4 w-4" /> Nuevo usuario
          </Button>
        </div>
      </div>

      {/* Users table */}
      <div className="rounded-xl border border-zinc-200 overflow-hidden bg-white">
        {loading ? (
          <div className="p-10 text-center text-zinc-400 text-sm">Cargando usuarios…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Usuario</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Rol</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Accesos</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Último acceso</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map((u) => {
                const permCount = Object.values(u.permissions ?? {}).filter(Boolean).length;
                return (
                  <tr key={u.id} className={`${!u.is_active ? "opacity-50" : ""} hover:bg-zinc-50`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-semibold text-xs uppercase">
                          {(u.full_name || u.email).slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-medium text-zinc-800">{u.full_name || "—"}</div>
                          <div className="text-zinc-400 text-xs">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.role === "admin" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
                          <ShieldCheck className="h-3 w-3" /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 bg-zinc-100 border border-zinc-200 rounded-full px-2 py-0.5">
                          <User className="h-3 w-3" /> Staff
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {u.role === "admin" ? (
                        <span className="text-green-600 font-medium">Acceso total</span>
                      ) : (
                        <span>{permCount} de {ALL_PERMISSIONS.length} módulos</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{fmt(u.last_sign_in_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(u)}
                        className="flex items-center gap-1.5 text-xs font-medium"
                        title={u.is_active ? "Desactivar" : "Activar"}
                      >
                        {u.is_active ? (
                          <><ToggleRight className="h-5 w-5 text-green-500" /><span className="text-green-600">Activo</span></>
                        ) : (
                          <><ToggleLeft className="h-5 w-5 text-zinc-400" /><span className="text-zinc-400">Inactivo</span></>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => openEdit(u)}
                          className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-600 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-zinc-100">
              <h2 className="text-lg font-bold text-zinc-900">
                {modal === "new" ? "Nuevo usuario" : `Editar: ${editing?.email}`}
              </h2>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Nombre completo</Label>
                  <Input
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="Ej: María García"
                    className="mt-1"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="usuario@empresa.com"
                    className="mt-1"
                  />
                </div>
                <div className="col-span-2">
                  <Label>{modal === "new" ? "Contraseña *" : "Nueva contraseña (dejar vacío para no cambiar)"}</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={modal === "new" ? "Mínimo 6 caracteres" : "••••••••"}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Role */}
              <div>
                <Label>Rol</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["admin", "staff"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm({ ...form, role: r })}
                      className={`flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all ${
                        form.role === r
                          ? "border-orange-500 bg-orange-50 text-orange-700"
                          : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
                      }`}
                    >
                      {r === "admin" ? <ShieldCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
                      {r === "admin" ? "Administrador" : "Staff"}
                    </button>
                  ))}
                </div>
                {form.role === "admin" && (
                  <p className="mt-2 text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2">
                    Los administradores tienen acceso total a todos los módulos y pueden gestionar usuarios.
                  </p>
                )}
              </div>

              {/* Permissions (only for staff) */}
              {form.role === "staff" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Permisos de acceso</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAllPerms(true)}
                        className="text-xs text-orange-600 hover:underline"
                      >
                        Todos
                      </button>
                      <span className="text-zinc-300">|</span>
                      <button
                        type="button"
                        onClick={() => setAllPerms(false)}
                        className="text-xs text-zinc-400 hover:underline"
                      >
                        Ninguno
                      </button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
                    {ALL_PERMISSIONS.map(({ key, label }) => (
                      <label
                        key={key}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50 cursor-pointer"
                      >
                        <span className="text-sm text-zinc-700">{label}</span>
                        <div
                          className={`relative h-5 w-9 rounded-full transition-colors ${
                            form.permissions[key] ? "bg-orange-500" : "bg-zinc-200"
                          }`}
                          onClick={() => togglePerm(key)}
                        >
                          <span
                            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                              form.permissions[key] ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-100 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setModal(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-orange-500 hover:bg-orange-600 min-w-[120px]"
              >
                {saving ? "Guardando…" : modal === "new" ? "Crear usuario" : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
