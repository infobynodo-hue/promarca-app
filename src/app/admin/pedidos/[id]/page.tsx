"use client";

import { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Order, OrderCost, OrderStatus, OrderStatusHistory, Provider } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Plus, Trash2, ChevronRight, Mail, Check, Clock,
  Package, Truck, Paintbrush, PackageCheck, Home, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

// ─── Status config ──────────────────────────────────────────────────────────
const STATUS_STEPS: OrderStatus[] = [
  "confirmado",
  "en_almacen",
  "en_marcacion",
  "salida_marcacion",
  "en_camino",
  "entregado",
];

const STATUS_CONFIG: Record<OrderStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  confirmado:       { label: "Confirmado",       icon: Check,         color: "text-blue-600",   bg: "bg-blue-100" },
  en_almacen:       { label: "En almacén",        icon: Package,       color: "text-yellow-600", bg: "bg-yellow-100" },
  en_marcacion:     { label: "En marcación",      icon: Paintbrush,    color: "text-purple-600", bg: "bg-purple-100" },
  salida_marcacion: { label: "Salida marcación",  icon: PackageCheck,  color: "text-indigo-600", bg: "bg-indigo-100" },
  en_camino:        { label: "En camino",         icon: Truck,         color: "text-orange-500", bg: "bg-orange-100" },
  entregado:        { label: "Entregado ✓",       icon: Home,          color: "text-green-600",  bg: "bg-green-100" },
};

const COST_TYPE_LABELS: Record<string, string> = {
  producto:   "Producto",
  marcacion:  "Marcación",
  logistica:  "Logística",
  empaque:    "Empaque",
  otro:       "Otro",
};

export default function PedidoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();

  const [order, setOrder] = useState<any>(null);
  const [history, setHistory] = useState<OrderStatusHistory[]>([]);
  const [costs, setCosts] = useState<OrderCost[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  // Status advance
  const [advancingStatus, setAdvancingStatus] = useState(false);
  const [statusNotes, setStatusNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  // Cost form
  const [showCostForm, setShowCostForm] = useState(false);
  const [costForm, setCostForm] = useState({
    cost_type: "producto",
    provider_id: "",
    description: "",
    amount: "",
  });
  const [savingCost, setSavingCost] = useState(false);

  // Edit order info
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    advance_payment: "",
    estimated_delivery: "",
    client_notification_email: "",
    notes: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const load = async () => {
    const [orderRes, provRes] = await Promise.all([
      supabase
        .from("orders")
        .select(`*, client:clients(*), quote:quotes(id, quote_number, total)`)
        .eq("id", id)
        .single(),
      supabase.from("providers").select("*").eq("is_active", true).order("name"),
    ]);

    const [histRes, costsRes] = await Promise.all([
      supabase
        .from("order_status_history")
        .select("*")
        .eq("order_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("order_costs")
        .select("*, provider:providers(*)")
        .eq("order_id", id)
        .order("display_order"),
    ]);

    setOrder(orderRes.data);
    setHistory(histRes.data ?? []);
    setCosts(costsRes.data ?? []);
    setProviders(provRes.data ?? []);
    if (orderRes.data) {
      setEditForm({
        advance_payment: String(orderRes.data.advance_payment ?? 0),
        estimated_delivery: orderRes.data.estimated_delivery ?? "",
        client_notification_email: orderRes.data.client_notification_email ?? "",
        notes: orderRes.data.notes ?? "",
      });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

  // ─── Advance status ─────────────────────────────────────────────────────
  const currentStepIdx = STATUS_STEPS.indexOf(order?.current_status);
  const nextStatus = currentStepIdx < STATUS_STEPS.length - 1
    ? STATUS_STEPS[currentStepIdx + 1]
    : null;

  const handleAdvanceStatus = async () => {
    if (!nextStatus) return;
    setAdvancingStatus(true);
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, notes: statusNotes || null, send_email: sendEmail }),
      });
      if (!res.ok) throw new Error("Error al actualizar estado");

      const json = await res.json();
      toast.success(`Estado actualizado: ${STATUS_CONFIG[nextStatus].label}`);
      if (sendEmail && json.email_sent) toast.info("✉️ Email enviado al cliente");
      else if (sendEmail && !json.email_sent) toast.warning("Email pendiente (Resend no conectado)");

      setStatusNotes("");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAdvancingStatus(false);
    }
  };

  // ─── Add cost ────────────────────────────────────────────────────────────
  const handleAddCost = async () => {
    if (!costForm.description || !costForm.amount) {
      toast.error("Descripción y monto son requeridos");
      return;
    }
    setSavingCost(true);
    try {
      const res = await fetch(`/api/orders/${id}/costs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...costForm,
          provider_id: costForm.provider_id || null,
          amount: parseFloat(costForm.amount),
        }),
      });
      if (!res.ok) throw new Error("Error al guardar costo");
      toast.success("Costo agregado");
      setCostForm({ cost_type: "producto", provider_id: "", description: "", amount: "" });
      setShowCostForm(false);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingCost(false);
    }
  };

  const handleDeleteCost = async (costId: string) => {
    if (!confirm("¿Eliminar este costo?")) return;
    await fetch(`/api/orders/${id}/costs/${costId}`, { method: "DELETE" });
    toast.success("Costo eliminado");
    await load();
  };

  // ─── Save order edits ────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advance_payment: parseFloat(editForm.advance_payment) || 0,
          estimated_delivery: editForm.estimated_delivery || null,
          client_notification_email: editForm.client_notification_email || null,
          notes: editForm.notes || null,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      toast.success("Pedido actualizado");
      setEditMode(false);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) return <p className="text-zinc-400">Cargando...</p>;
  if (!order) return <p className="text-red-500">Pedido no encontrado</p>;

  const client = order.client;
  const quote = order.quote;
  const totalCosts = costs.reduce((sum: number, c: OrderCost) => sum + c.amount, 0);
  const profit = order.total_billed - totalCosts;
  const profitPercent = order.total_billed > 0 ? (profit / order.total_billed) * 100 : 0;
  const saldo = order.total_billed - order.advance_payment;
  const stConfig = STATUS_CONFIG[order.current_status as OrderStatus] ?? STATUS_CONFIG.confirmado;

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/pedidos">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight font-mono">{order.order_number}</h1>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${stConfig.bg} ${stConfig.color}`}>
              {stConfig.label}
            </span>
          </div>
          <p className="text-sm text-zinc-500">
            Pedido creado el {new Date(order.created_at).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Status tracker */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Estado del pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress bar */}
              <div className="flex items-center gap-0">
                {STATUS_STEPS.map((step, i) => {
                  const done = i <= currentStepIdx;
                  const isCurrent = i === currentStepIdx;
                  const cfg = STATUS_CONFIG[step];
                  const Icon = cfg.icon;
                  return (
                    <div key={step} className="flex items-center flex-1">
                      <div className="flex flex-col items-center">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center transition-all ${
                          isCurrent
                            ? `${cfg.bg} ${cfg.color} ring-2 ring-offset-2 ring-current`
                            : done
                            ? "bg-green-100 text-green-600"
                            : "bg-zinc-100 text-zinc-400"
                        }`}>
                          {done && !isCurrent ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                        </div>
                        <p className={`text-[10px] mt-1.5 font-medium text-center leading-tight max-w-[60px] ${
                          isCurrent ? cfg.color : done ? "text-green-600" : "text-zinc-400"
                        }`}>{cfg.label}</p>
                      </div>
                      {i < STATUS_STEPS.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-1 mb-5 ${i < currentStepIdx ? "bg-green-400" : "bg-zinc-200"}`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Advance status */}
              {nextStatus && (
                <div className="border rounded-lg p-4 bg-zinc-50 space-y-3">
                  <p className="text-sm font-semibold text-zinc-700">
                    Siguiente paso: <span className={STATUS_CONFIG[nextStatus].color}>{STATUS_CONFIG[nextStatus].label}</span>
                  </p>
                  <Textarea
                    placeholder="Nota interna (opcional)"
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    className="text-sm min-h-[60px]"
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-600">
                      <input
                        type="checkbox"
                        checked={sendEmail}
                        onChange={(e) => setSendEmail(e.target.checked)}
                        className="h-4 w-4 accent-orange-500"
                      />
                      <Mail className="h-3.5 w-3.5 text-zinc-400" />
                      Notificar al cliente por email
                    </label>
                    <Button
                      onClick={handleAdvanceStatus}
                      disabled={advancingStatus}
                      className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      <ChevronRight className="h-4 w-4" />
                      {advancingStatus ? "Actualizando..." : `Avanzar a "${STATUS_CONFIG[nextStatus].label}"`}
                    </Button>
                  </div>
                </div>
              )}

              {/* History */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Historial</p>
                {history.map((h) => {
                  const hCfg = STATUS_CONFIG[h.status as OrderStatus];
                  const HIcon = hCfg?.icon ?? Clock;
                  return (
                    <div key={h.id} className="flex items-start gap-3 text-sm">
                      <div className={`mt-0.5 h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${hCfg?.bg ?? "bg-zinc-100"}`}>
                        <HIcon className={`h-3 w-3 ${hCfg?.color ?? "text-zinc-500"}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{hCfg?.label ?? h.status}</span>
                          {h.email_sent && (
                            <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                              <Mail className="h-2.5 w-2.5" /> Email enviado
                            </span>
                          )}
                        </div>
                        {h.notes && <p className="text-zinc-500 text-xs mt-0.5">{h.notes}</p>}
                        <p className="text-zinc-400 text-xs">
                          {new Date(h.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Costs */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Costos del pedido</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setShowCostForm(!showCostForm)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar costo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Add cost form */}
              {showCostForm && (
                <div className="border rounded-lg p-4 bg-zinc-50 space-y-3">
                  <p className="text-sm font-semibold text-zinc-700">Nuevo costo</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Tipo</label>
                      <Select
                        value={costForm.cost_type}
                        onValueChange={(v) => setCostForm({ ...costForm, cost_type: v ?? "otro" })}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(COST_TYPE_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Proveedor (opcional)</label>
                      <Select
                        value={costForm.provider_id}
                        onValueChange={(v) => setCostForm({ ...costForm, provider_id: !v || v === "none" ? "" : v })}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Sin proveedor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin proveedor</SelectItem>
                          {providers.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Descripción</label>
                    <Input
                      placeholder="Ej: Productos bordados 300 uds."
                      value={costForm.description}
                      onChange={(e) => setCostForm({ ...costForm, description: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Monto (COP)</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={costForm.amount}
                      onChange={(e) => setCostForm({ ...costForm, amount: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setShowCostForm(false)}>Cancelar</Button>
                    <Button
                      size="sm"
                      onClick={handleAddCost}
                      disabled={savingCost}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      {savingCost ? "Guardando..." : "Agregar"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Costs table */}
              {costs.length === 0 && !showCostForm ? (
                <p className="text-sm text-zinc-400 py-4 text-center">
                  Aún no hay costos registrados para este pedido
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-zinc-50">
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs">Descripción</TableHead>
                      <TableHead className="text-xs">Proveedor</TableHead>
                      <TableHead className="text-xs text-right">Monto</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costs.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded">
                            {COST_TYPE_LABELS[c.cost_type] ?? c.cost_type}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">{c.description}</TableCell>
                        <TableCell className="text-sm text-zinc-500">
                          {c.provider_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm">
                          {formatPrice(c.amount)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-zinc-400 hover:text-red-500"
                            onClick={() => handleDeleteCost(c.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-zinc-50 font-semibold">
                      <TableCell colSpan={3} className="text-sm">Total costos</TableCell>
                      <TableCell className="text-right text-sm">{formatPrice(totalCosts)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-5">
          {/* Financial summary */}
          <Card className={profit >= 0 ? "border-green-200" : "border-red-200"}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resumen financiero</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Total facturado</span>
                <span className="font-bold">{formatPrice(order.total_billed)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Anticipo recibido</span>
                <span className="text-green-600 font-semibold">{formatPrice(order.advance_payment)}</span>
              </div>
              {saldo > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Saldo por cobrar</span>
                  <span className="text-orange-500 font-semibold">{formatPrice(saldo)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="text-zinc-500">Total costos</span>
                <span className="text-red-500 font-semibold">-{formatPrice(totalCosts)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="font-semibold">Ganancia neta</span>
                <div className="text-right">
                  <p className={`text-lg font-black ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatPrice(profit)}
                  </p>
                  <p className={`text-xs ${profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {profitPercent.toFixed(1)}% margen
                  </p>
                </div>
              </div>
              {totalCosts === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  Agrega costos para calcular la ganancia real
                </p>
              )}
            </CardContent>
          </Card>

          {/* Client info */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Cliente</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              {client ? (
                <>
                  <p className="font-semibold">{client.name}</p>
                  {client.company && <p className="text-zinc-500">{client.company}</p>}
                  {client.email && <p className="text-zinc-500">{client.email}</p>}
                  {client.phone && <p className="text-zinc-500">{client.phone}</p>}
                  {client.nit && <p className="text-zinc-500">NIT: {client.nit}</p>}
                  <Link href={`/admin/clientes/${order.client_id}`}>
                    <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs text-blue-600 px-0">
                      Ver perfil completo →
                    </Button>
                  </Link>
                </>
              ) : <p className="text-zinc-400">Sin cliente asignado</p>}
            </CardContent>
          </Card>

          {/* Order info + editable fields */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Info del pedido</CardTitle>
                {!editMode ? (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditMode(true)}>
                    Editar
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditMode(false)}>
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white"
                      onClick={handleSaveEdit}
                      disabled={savingEdit}
                    >
                      Guardar
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              {quote && (
                <div>
                  <p className="text-zinc-400 text-xs mb-0.5">Cotización origen</p>
                  <Link href={`/admin/cotizaciones/${order.quote_id}`} className="text-blue-600 hover:underline font-mono text-sm">
                    {quote.quote_number}
                  </Link>
                </div>
              )}

              {editMode ? (
                <>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Anticipo recibido (COP)</label>
                    <Input
                      type="number"
                      value={editForm.advance_payment}
                      onChange={(e) => setEditForm({ ...editForm, advance_payment: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Entrega estimada</label>
                    <Input
                      type="date"
                      value={editForm.estimated_delivery}
                      onChange={(e) => setEditForm({ ...editForm, estimated_delivery: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Email notificaciones cliente</label>
                    <Input
                      type="email"
                      placeholder="cliente@email.com"
                      value={editForm.client_notification_email}
                      onChange={(e) => setEditForm({ ...editForm, client_notification_email: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Notas internas</label>
                    <Textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      className="text-sm min-h-[60px]"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Anticipo</span>
                    <span className="font-semibold text-green-600">{formatPrice(order.advance_payment)}</span>
                  </div>
                  {order.estimated_delivery && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Entrega est.</span>
                      <span>{new Date(order.estimated_delivery).toLocaleDateString("es-CO")}</span>
                    </div>
                  )}
                  {order.client_notification_email && (
                    <div>
                      <p className="text-zinc-400 text-xs mb-0.5">Email cliente</p>
                      <p className="text-sm break-all">{order.client_notification_email}</p>
                    </div>
                  )}
                  {order.notes && (
                    <div>
                      <p className="text-zinc-400 text-xs mb-0.5">Notas</p>
                      <p className="text-sm text-zinc-600 whitespace-pre-wrap">{order.notes}</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
