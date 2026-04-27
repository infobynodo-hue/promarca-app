"use client";

import { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { QuoteItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  ArrowLeft, FileDown, LayoutTemplate, CheckCircle2, ShoppingBag,
  X, PackageCheck, AlertCircle,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";

const statusLabels: Record<string, { label: string; color: string }> = {
  draft:    { label: "Borrador",   color: "bg-zinc-100 text-zinc-600" },
  sent:     { label: "Enviada",    color: "bg-blue-100 text-blue-700" },
  accepted: { label: "Aprobada ✓", color: "bg-green-100 text-green-700" },
  rejected: { label: "Rechazada",  color: "bg-red-100 text-red-700" },
  expired:  { label: "Expirada",   color: "bg-zinc-100 text-zinc-500" },
};

interface ConfirmRow {
  itemId: string;
  included: boolean;
  qty: number;
}

export default function CotizacionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const supabase = createClient();
  const router = useRouter();
  const [quote, setQuote] = useState<any>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [existingOrderId, setExistingOrderId] = useState<string | null>(null);

  // Confirmation flow
  const [showConfirmPanel, setShowConfirmPanel] = useState(false);
  const [confirmRows, setConfirmRows] = useState<ConfirmRow[]>([]);
  const [confirming, setSaving] = useState(false);

  // Create order dialog
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [orderForm, setOrderForm] = useState({ advance_payment: "", client_notification_email: "", estimated_delivery: "", notes: "" });
  const [creatingOrder, setCreatingOrder] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [qRes, iRes, ordRes] = await Promise.all([
        supabase.from("quotes").select("*, client:clients(*)").eq("id", id).single(),
        supabase.from("quote_items").select("*").eq("quote_id", id).order("display_order"),
        supabase.from("orders").select("id").eq("quote_id", id).maybeSingle(),
      ]);
      setQuote(qRes.data);
      setItems(iRes.data ?? []);
      setExistingOrderId(ordRes.data?.id ?? null);
      if (qRes.data?.client?.email) {
        setOrderForm((f) => ({ ...f, client_notification_email: qRes.data.client.email ?? "" }));
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const handleCreateOrder = async () => {
    if (!quote) return;
    setCreatingOrder(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_id: id,
          client_id: quote.client_id,
          total_billed: orderTotal > 0 ? orderTotal : quote.total,
          advance_payment: parseFloat(orderForm.advance_payment) || 0,
          client_notification_email: orderForm.client_notification_email || quote.client?.email || null,
          estimated_delivery: orderForm.estimated_delivery || null,
          notes: orderForm.notes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error al crear pedido");
      }
      const order = await res.json();
      toast.success(`✅ Pedido ${order.order_number} creado correctamente`);
      setOrderDialogOpen(false);
      router.push(`/admin/pedidos/${order.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreatingOrder(false);
    }
  };

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

  const handleStatusChange = async (status: string) => {
    await supabase.from("quotes").update({ status }).eq("id", id);
    setQuote({ ...quote, status });
    toast.success("Estado actualizado");
  };

  // ── Open confirmation panel ───────────────────────────────────────────────
  const openConfirmPanel = () => {
    setConfirmRows(items.map((item) => ({
      itemId: item.id,
      included: item.is_confirmed !== false, // keep existing or default to true
      qty: item.confirmed_quantity ?? item.quantity,
    })));
    setShowConfirmPanel(true);
  };

  // ── Compute confirmed totals live ────────────────────────────────────────
  const confirmedSubtotal = confirmRows.reduce((sum, row) => {
    if (!row.included) return sum;
    const item = items.find((i) => i.id === row.itemId);
    if (!item) return sum;
    return sum + row.qty * (item.unit_price + (item.marking_price ?? 0));
  }, 0);
  const confirmedDiscount = Math.round(confirmedSubtotal * ((quote?.discount_percent ?? 0) / 100));
  const confirmedTotal = confirmedSubtotal - confirmedDiscount;

  // ── Save confirmation ─────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (confirmRows.every((r) => !r.included)) {
      toast.error("Debes incluir al menos un producto en el pedido");
      return;
    }
    setSaving(true);
    try {
      // Update each item
      for (const row of confirmRows) {
        await supabase.from("quote_items").update({
          is_confirmed: row.included,
          confirmed_quantity: row.included ? row.qty : null,
        }).eq("id", row.itemId);
      }
      // Update quote
      await supabase.from("quotes").update({
        status: "accepted",
        confirmed_at: new Date().toISOString(),
        confirmed_total: confirmedTotal,
      }).eq("id", id);

      // Refresh data
      const [qRes, iRes] = await Promise.all([
        supabase.from("quotes").select("*, client:clients(*)").eq("id", id).single(),
        supabase.from("quote_items").select("*").eq("quote_id", id).order("display_order"),
      ]);
      setQuote(qRes.data);
      setItems(iRes.data ?? []);
      setShowConfirmPanel(false);
      toast.success("✅ Pedido confirmado correctamente");
    } catch {
      toast.error("Error al confirmar el pedido");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = () => {
    window.open(`/api/quotes/${id}/pdf?download=1`, "_blank");
  };

  if (loading) return <p className="text-zinc-500">Cargando...</p>;
  if (!quote) return <p className="text-red-500">Cotización no encontrada</p>;

  const client = quote.client;
  const isAccepted = quote.status === "accepted";
  const hasConfirmedItems = items.some((i) => i.is_confirmed !== null);
  const confirmedItems = items.filter((i) => i.is_confirmed === true);
  const removedItems = items.filter((i) => i.is_confirmed === false);
  const st = statusLabels[quote.status] ?? statusLabels.draft;

  // ── Totals for confirmed order ────────────────────────────────────────────
  const orderSubtotal = confirmedItems.reduce((sum, i) => {
    const qty = i.confirmed_quantity ?? i.quantity;
    return sum + qty * (i.unit_price + (i.marking_price ?? 0));
  }, 0);
  const orderDiscount = Math.round(orderSubtotal * ((quote.discount_percent ?? 0) / 100));
  const orderTotal = orderSubtotal - orderDiscount;

  return (
    <>
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Link href="/admin/cotizaciones">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{quote.quote_number}</h1>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.color}`}>{st.label}</span>
            </div>
            <p className="text-sm text-zinc-500">
              {isAccepted && quote.confirmed_at
                ? `Confirmado el ${new Date(quote.confirmed_at).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}`
                : `Creada el ${new Date(quote.created_at).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}`
              }
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Confirm button — only when sent */}
          {quote.status === "sent" && !showConfirmPanel && (
            <Button
              onClick={openConfirmPanel}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <PackageCheck className="h-4 w-4" />
              Confirmar como pedido
            </Button>
          )}
          {/* Crear Pedido — when accepted and no existing order */}
          {isAccepted && !existingOrderId && !showConfirmPanel && (
            <Button
              onClick={() => setOrderDialogOpen(true)}
              className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
            >
              <ShoppingBag className="h-4 w-4" />
              Crear Pedido
            </Button>
          )}
          {/* Ver Pedido — when order already created */}
          {isAccepted && existingOrderId && (
            <Link href={`/admin/pedidos/${existingOrderId}`}>
              <Button className="gap-2 bg-zinc-800 hover:bg-zinc-900 text-white">
                <ShoppingBag className="h-4 w-4" />
                Ver Pedido
              </Button>
            </Link>
          )}
          {/* Status selector — hide when confirming */}
          {!showConfirmPanel && (
            <Select value={quote.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Borrador</SelectItem>
                <SelectItem value="sent">Enviada</SelectItem>
                <SelectItem value="accepted">Aprobada</SelectItem>
                <SelectItem value="rejected">Rechazada</SelectItem>
                <SelectItem value="expired">Expirada</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Link href="/admin/cotizaciones/plantilla" target="_blank">
            <Button variant="ghost" size="sm" title="Ver/editar plantilla PDF">
              <LayoutTemplate className="mr-1.5 h-4 w-4" /> Plantilla
            </Button>
          </Link>
          <Button variant="outline" onClick={handleDownloadPDF}>
            <FileDown className="mr-2 h-4 w-4" />
            {isAccepted ? "PDF Pedido" : "Descargar PDF"}
          </Button>
        </div>
      </div>

      {/* ── Confirmation Panel ── */}
      {showConfirmPanel && (
        <div className="mt-4 rounded-2xl border-2 border-green-300 bg-green-50 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 bg-green-600 text-white">
            <div className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5" />
              <span className="font-bold">Confirmar pedido final</span>
            </div>
            <button onClick={() => setShowConfirmPanel(false)} className="text-white/70 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="px-5 py-3 text-sm text-green-800 bg-green-100 border-b border-green-200">
            Activa los productos que el cliente sí compró y ajusta las cantidades reales. Los que desactives quedan como referencia en la cotización pero no cuentan como venta.
          </p>

          <div className="divide-y divide-green-100">
            {items.map((item) => {
              const row = confirmRows.find((r) => r.itemId === item.id);
              if (!row) return null;
              const lineTotal = row.included ? row.qty * (item.unit_price + (item.marking_price ?? 0)) : 0;
              return (
                <div key={item.id} className={`flex items-center gap-4 px-5 py-3 transition-colors ${row.included ? "bg-white" : "bg-zinc-50 opacity-60"}`}>
                  {/* Toggle */}
                  <button
                    type="button"
                    onClick={() => setConfirmRows((prev) => prev.map((r) => r.itemId === item.id ? { ...r, included: !r.included } : r))}
                    className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${row.included ? "border-green-500 bg-green-500 text-white" : "border-zinc-300 bg-white"}`}
                  >
                    {row.included && <CheckCircle2 className="h-4 w-4" />}
                  </button>

                  {/* Product info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${row.included ? "text-zinc-800" : "text-zinc-400 line-through"}`}>
                      {item.product_name}
                    </p>
                    {item.product_reference && (
                      <p className="text-xs text-zinc-400 font-mono">{item.product_reference}</p>
                    )}
                  </div>

                  {/* Original qty */}
                  <div className="text-center flex-shrink-0">
                    <p className="text-xs text-zinc-400">Cotizado</p>
                    <p className="text-sm font-medium text-zinc-500">{item.quantity}</p>
                  </div>

                  {/* Confirmed qty */}
                  <div className="flex-shrink-0 w-24">
                    <p className="text-xs text-zinc-500 mb-1">Cantidad final</p>
                    <Input
                      type="number"
                      min={1}
                      value={row.qty}
                      disabled={!row.included}
                      onChange={(e) => setConfirmRows((prev) => prev.map((r) =>
                        r.itemId === item.id ? { ...r, qty: parseInt(e.target.value) || 1 } : r
                      ))}
                      className="h-7 text-sm text-center"
                    />
                  </div>

                  {/* Line total */}
                  <div className="text-right flex-shrink-0 w-28">
                    <p className="text-xs text-zinc-400">Total</p>
                    <p className={`text-sm font-bold ${row.included ? "text-zinc-800" : "text-zinc-300"}`}>
                      {row.included ? formatPrice(lineTotal) : "—"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Confirm totals + button */}
          <div className="px-5 py-4 bg-white border-t border-green-200 flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-0.5">
              {quote.discount_percent > 0 && (
                <p className="text-xs text-zinc-400">Subtotal: {formatPrice(confirmedSubtotal)} · Descuento ({quote.discount_percent}%): −{formatPrice(confirmedDiscount)}</p>
              )}
              <p className="text-lg font-black text-zinc-800">
                Total pedido: <span className="text-green-700">{formatPrice(confirmedTotal)}</span>
              </p>
              <p className="text-xs text-zinc-400">
                {confirmRows.filter((r) => r.included).length} de {items.length} productos incluidos
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowConfirmPanel(false)} disabled={confirming}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={confirming}
                className="bg-green-600 hover:bg-green-700 gap-2 min-w-[160px]"
              >
                {confirming ? "Confirmando..." : <><ShoppingBag className="h-4 w-4" /> Confirmar pedido</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Accepted banner — re-confirm option ── */}
      {isAccepted && hasConfirmedItems && !showConfirmPanel && (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-800">Pedido confirmado</p>
            <p className="text-xs text-green-600">
              {confirmedItems.length} producto{confirmedItems.length !== 1 ? "s" : ""} · Total: {formatPrice(orderTotal)}
              {removedItems.length > 0 && ` · ${removedItems.length} producto${removedItems.length !== 1 ? "s" : ""} no incluido${removedItems.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            onClick={openConfirmPanel}
            className="text-xs text-green-700 hover:text-green-900 font-medium underline underline-offset-2 flex-shrink-0"
          >
            Editar confirmación
          </button>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">

          {/* Items table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Productos cotizados</CardTitle>
                {isAccepted && hasConfirmedItems && (
                  <span className="text-xs text-zinc-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Muestra lo cotizado original
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ref.</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Cant.</TableHead>
                    <TableHead>Precio unit.</TableHead>
                    <TableHead>Marcado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    {hasConfirmedItems && <TableHead className="text-center">Estado</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const notIncluded = item.is_confirmed === false;
                    return (
                      <TableRow key={item.id} className={notIncluded ? "opacity-40" : ""}>
                        <TableCell className="font-mono text-xs font-bold">{item.product_reference ?? "—"}</TableCell>
                        <TableCell>
                          <span className={`font-medium ${notIncluded ? "line-through" : ""}`}>{item.product_name}</span>
                          {item.notes && <p className="text-xs text-zinc-400 mt-0.5 leading-snug">{item.notes}</p>}
                        </TableCell>
                        <TableCell>
                          {item.is_confirmed === true && item.confirmed_quantity !== item.quantity ? (
                            <span>
                              <span className="line-through text-zinc-300 mr-1">{item.quantity}</span>
                              <span className="font-semibold text-green-700">{item.confirmed_quantity}</span>
                            </span>
                          ) : item.quantity}
                        </TableCell>
                        <TableCell>{formatPrice(item.unit_price)}</TableCell>
                        <TableCell>
                          {item.marking_type}
                          {item.marking_price > 0 && (
                            <span className="ml-1 text-xs text-zinc-400">(+{formatPrice(item.marking_price)}/u)</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatPrice(item.line_total)}</TableCell>
                        {hasConfirmedItems && (
                          <TableCell className="text-center">
                            {item.is_confirmed === true && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="h-3 w-3" /> Incluido
                              </span>
                            )}
                            {item.is_confirmed === false && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">
                                <X className="h-3 w-3" /> No incluido
                              </span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Confirmed order summary — only when accepted */}
          {isAccepted && hasConfirmedItems && confirmedItems.length > 0 && (
            <Card className="border-green-200 bg-green-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <PackageCheck className="h-5 w-5" />
                  Pedido confirmado
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-green-100/60">
                      <TableHead className="text-green-700">Producto</TableHead>
                      <TableHead className="text-green-700">Cantidad</TableHead>
                      <TableHead className="text-green-700">Precio unit.</TableHead>
                      <TableHead className="text-right text-green-700">Total línea</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {confirmedItems.map((item) => {
                      const qty = item.confirmed_quantity ?? item.quantity;
                      const lineTotal = qty * (item.unit_price + (item.marking_price ?? 0));
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <span className="font-medium">{item.product_name}</span>
                            {item.product_reference && (
                              <span className="ml-2 text-xs text-zinc-400 font-mono">{item.product_reference}</span>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold text-green-700">{qty}</TableCell>
                          <TableCell>{formatPrice(item.unit_price)}</TableCell>
                          <TableCell className="text-right font-bold">{formatPrice(lineTotal)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {quote.notes && (
            <Card className="mt-0">
              <CardHeader><CardTitle>Notas</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-600 whitespace-pre-wrap">{quote.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-6">
          {/* Client */}
          <Card>
            <CardHeader><CardTitle>Cliente</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              {client ? (
                <>
                  <p className="font-medium">{client.name}</p>
                  {client.company && <p className="text-zinc-500">{client.company}</p>}
                  {client.email && <p className="text-zinc-500">{client.email}</p>}
                  {client.phone && <p className="text-zinc-500">{client.phone}</p>}
                  {client.nit && <p className="text-zinc-500">NIT: {client.nit}</p>}
                </>
              ) : (
                <p className="text-zinc-400">Sin cliente asignado</p>
              )}
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {/* Original quote totals */}
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Cotización original</p>
              <div className="flex justify-between text-zinc-500">
                <span>Subtotal</span><span>{formatPrice(quote.subtotal)}</span>
              </div>
              {quote.discount_percent > 0 && (
                <div className="flex justify-between text-zinc-500">
                  <span>Descuento ({quote.discount_percent}%)</span>
                  <span className="text-red-500">-{formatPrice(Math.round(quote.subtotal * (quote.discount_percent / 100)))}</span>
                </div>
              )}
              <div className="flex justify-between font-bold">
                <span>Total cotizado</span>
                <span>{formatPrice(quote.total)}</span>
              </div>

              {/* Confirmed order totals */}
              {isAccepted && hasConfirmedItems && (
                <>
                  <Separator className="my-2" />
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide flex items-center gap-1">
                    <PackageCheck className="h-3 w-3" /> Pedido confirmado
                  </p>
                  <div className="flex justify-between text-zinc-500">
                    <span>Subtotal</span><span>{formatPrice(orderSubtotal)}</span>
                  </div>
                  {quote.discount_percent > 0 && (
                    <div className="flex justify-between text-zinc-500">
                      <span>Descuento ({quote.discount_percent}%)</span>
                      <span className="text-red-500">-{formatPrice(orderDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-black text-green-700">
                    <span>Total venta</span>
                    <span>{formatPrice(orderTotal)}</span>
                  </div>
                </>
              )}

              {!isAccepted && (
                <>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span><span>{formatPrice(quote.total)}</span>
                  </div>
                </>
              )}

              {quote.valid_until && (
                <p className="text-xs text-zinc-400 pt-2">
                  Válida hasta: {new Date(quote.valid_until).toLocaleDateString("es-CO")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Create Order Dialog ── */}
      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-orange-500" />
              Crear pedido desde cotización
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-zinc-50 rounded-lg p-3 text-sm">
              <p className="text-zinc-500">Cotización</p>
              <p className="font-semibold font-mono">{quote?.quote_number}</p>
              <p className="font-bold text-lg mt-1">{formatPrice(orderTotal > 0 ? orderTotal : quote?.total ?? 0)}</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Email del cliente para notificaciones</label>
              <Input
                type="email"
                placeholder="cliente@email.com"
                value={orderForm.client_notification_email}
                onChange={(e) => setOrderForm({ ...orderForm, client_notification_email: e.target.value })}
              />
              <p className="text-xs text-zinc-400 mt-1">Se enviará un email de confirmación cuando conectes Resend</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Anticipo recibido (COP)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={orderForm.advance_payment}
                  onChange={(e) => setOrderForm({ ...orderForm, advance_payment: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Entrega estimada</label>
                <Input
                  type="date"
                  value={orderForm.estimated_delivery}
                  onChange={(e) => setOrderForm({ ...orderForm, estimated_delivery: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Notas internas (opcional)</label>
              <Input
                placeholder="Instrucciones especiales..."
                value={orderForm.notes}
                onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleCreateOrder}
              disabled={creatingOrder}
              className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
            >
              <ShoppingBag className="h-4 w-4" />
              {creatingOrder ? "Creando pedido..." : "Crear pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
