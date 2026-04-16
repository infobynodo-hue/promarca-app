"use client";

import { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Quote, QuoteItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, FileDown, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function CotizacionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const supabase = createClient();
  const [quote, setQuote] = useState<any>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [qRes, iRes] = await Promise.all([
        supabase
          .from("quotes")
          .select("*, client:clients(*)")
          .eq("id", id)
          .single(),
        supabase
          .from("quote_items")
          .select("*")
          .eq("quote_id", id)
          .order("display_order"),
      ]);
      setQuote(qRes.data);
      setItems(iRes.data ?? []);
      setLoading(false);
    };
    load();
  }, [id]);

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(n);

  const handleStatusChange = async (status: string) => {
    await supabase.from("quotes").update({ status }).eq("id", id);
    setQuote({ ...quote, status });
    toast.success("Estado actualizado");
  };

  const handleDownloadPDF = () => {
    // Opens HTML in new tab with auto-print dialog (browser saves as PDF)
    window.open(`/api/quotes/${id}/pdf?download=1`, "_blank");
  };

  if (loading) return <p className="text-zinc-500">Cargando...</p>;
  if (!quote) return <p className="text-red-500">Cotización no encontrada</p>;

  const client = quote.client;

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/cotizaciones">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {quote.quote_number}
            </h1>
            <p className="text-sm text-zinc-500">
              Creada el{" "}
              {new Date(quote.created_at).toLocaleDateString("es-CO", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={quote.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="sent">Enviada</SelectItem>
              <SelectItem value="accepted">Aceptada</SelectItem>
              <SelectItem value="rejected">Rechazada</SelectItem>
              <SelectItem value="expired">Expirada</SelectItem>
            </SelectContent>
          </Select>
          <Link href="/admin/cotizaciones/plantilla" target="_blank">
            <Button variant="ghost" size="sm" title="Ver/editar plantilla PDF">
              <LayoutTemplate className="mr-1.5 h-4 w-4" /> Plantilla
            </Button>
          </Link>
          <Button variant="outline" onClick={handleDownloadPDF}>
            <FileDown className="mr-2 h-4 w-4" /> Descargar PDF
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* Items table */}
          <Card>
            <CardHeader>
              <CardTitle>Productos</CardTitle>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs font-bold">
                        {item.product_reference ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{item.product_name}</span>
                        {item.notes && (
                          <p className="text-xs text-zinc-400 mt-0.5 leading-snug">{item.notes}</p>
                        )}
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{formatPrice(item.unit_price)}</TableCell>
                      <TableCell>
                        {item.marking_type}
                        {item.marking_price > 0 && (
                          <span className="ml-1 text-xs text-zinc-400">
                            (+{formatPrice(item.marking_price)}/u)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPrice(item.line_total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {quote.notes && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Notas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-600 whitespace-pre-wrap">
                  {quote.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Client info */}
          <Card>
            <CardHeader>
              <CardTitle>Cliente</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              {client ? (
                <>
                  <p className="font-medium">{client.name}</p>
                  {client.company && (
                    <p className="text-zinc-500">{client.company}</p>
                  )}
                  {client.email && <p className="text-zinc-500">{client.email}</p>}
                  {client.phone && <p className="text-zinc-500">{client.phone}</p>}
                  {client.nit && (
                    <p className="text-zinc-500">NIT: {client.nit}</p>
                  )}
                </>
              ) : (
                <p className="text-zinc-400">Sin cliente asignado</p>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Subtotal</span>
                <span>{formatPrice(quote.subtotal)}</span>
              </div>
              {quote.discount_percent > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">
                    Descuento ({quote.discount_percent}%)
                  </span>
                  <span className="text-red-500">
                    -
                    {formatPrice(
                      Math.round(
                        quote.subtotal * (quote.discount_percent / 100)
                      )
                    )}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatPrice(quote.total)}</span>
              </div>
              {quote.valid_until && (
                <p className="text-xs text-zinc-400 pt-2">
                  Válida hasta:{" "}
                  {new Date(quote.valid_until).toLocaleDateString("es-CO")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
