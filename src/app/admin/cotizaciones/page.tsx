"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Quote } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, FileDown, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Borrador", variant: "secondary" },
  sent: { label: "Enviada", variant: "default" },
  accepted: { label: "Aceptada", variant: "default" },
  rejected: { label: "Rechazada", variant: "destructive" },
  expired: { label: "Expirada", variant: "outline" },
};

export default function CotizacionesPage() {
  const supabase = createClient();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQuotes = async () => {
    const { data } = await supabase
      .from("quotes")
      .select("*, client:clients(name, company)")
      .order("created_at", { ascending: false });
    setQuotes(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchQuotes();
  }, []);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(price);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta cotización?")) return;
    await supabase.from("quotes").delete().eq("id", id);
    toast.success("Cotización eliminada");
    fetchQuotes();
  };

  const handleDuplicate = async (quote: Quote) => {
    const { data: items } = await supabase
      .from("quote_items")
      .select("*")
      .eq("quote_id", quote.id);

    // Generate new quote number
    const num = String(Date.now()).slice(-4);
    const newNumber = `COT-${new Date().getFullYear()}-${num}`;

    const { data: newQuote } = await supabase
      .from("quotes")
      .insert({
        quote_number: newNumber,
        client_id: quote.client_id,
        status: "draft",
        subtotal: quote.subtotal,
        discount_percent: quote.discount_percent,
        iva_percent: quote.iva_percent,
        total: quote.total,
        notes: quote.notes,
      })
      .select("id")
      .single();

    if (newQuote && items && items.length > 0) {
      await supabase.from("quote_items").insert(
        items.map(({ id, quote_id, ...rest }) => ({
          ...rest,
          quote_id: newQuote.id,
        }))
      );
    }

    toast.success("Cotización duplicada");
    fetchQuotes();
  };

  if (loading) return <p className="text-zinc-500">Cargando...</p>;

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cotizaciones</h1>
          <p className="text-sm text-zinc-500">{quotes.length} cotizaciones</p>
        </div>
        <Link href="/admin/cotizaciones/nueva">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Nueva cotización
          </Button>
        </Link>
      </div>

      <Card className="mt-6">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Cotización</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-zinc-400">
                    Aún no hay cotizaciones
                  </TableCell>
                </TableRow>
              )}
              {quotes.map((q) => {
                const s = statusLabels[q.status] ?? statusLabels.draft;
                return (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-sm font-bold">
                      <Link
                        href={`/admin/cotizaciones/${q.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {q.quote_number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {(q.client as any)?.company ?? (q.client as any)?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-zinc-500">
                      {new Date(q.created_at).toLocaleDateString("es-CO")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatPrice(q.total)}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Duplicar"
                        onClick={() => handleDuplicate(q)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Eliminar"
                        onClick={() => handleDelete(q.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
