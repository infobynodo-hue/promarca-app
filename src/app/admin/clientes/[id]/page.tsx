import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  Hash,
  CalendarDays,
  ArrowLeft,
  Plus,
} from "lucide-react";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada",
  accepted: "Aceptada",
  rejected: "Rechazada",
  expired: "Vencida",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "secondary",
  sent: "outline",
  accepted: "default",
  rejected: "destructive",
  expired: "secondary",
};

const formatCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(n);

const formatDate = (s: string) =>
  new Date(s).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default async function ClienteDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: client }, { data: quotes }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase
      .from("quotes")
      .select("*, quote_items(*)")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!client) notFound();

  const quoteList = quotes ?? [];
  const totalRevenue = quoteList
    .filter((q) => q.status === "accepted")
    .reduce((acc, q) => acc + q.total, 0);
  const totalUnits = quoteList
    .flatMap((q) => q.quote_items ?? [])
    .reduce((acc: number, i: any) => acc + (i.quantity ?? 0), 0);

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/clientes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
          {client.company && (
            <p className="text-sm text-zinc-500">{client.company}</p>
          )}
        </div>
        <Link href={`/admin/cotizaciones/nueva?cliente=${client.id}`}>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Nueva cotización
          </Button>
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Info card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
              Información
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {client.company && (
              <div className="flex items-center gap-2 text-zinc-600">
                <Building2 className="h-4 w-4 text-zinc-400" />
                {client.company}
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-zinc-400" />
                <a href={`mailto:${client.email}`} className="text-blue-500 hover:underline">
                  {client.email}
                </a>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2 text-zinc-600">
                <Phone className="h-4 w-4 text-zinc-400" />
                <a href={`tel:${client.phone}`} className="hover:text-zinc-900">
                  {client.phone}
                </a>
              </div>
            )}
            {client.nit && (
              <div className="flex items-center gap-2 text-zinc-600">
                <Hash className="h-4 w-4 text-zinc-400" />
                NIT: {client.nit}
              </div>
            )}
            {(client.city || client.address) && (
              <div className="flex items-start gap-2 text-zinc-600">
                <MapPin className="h-4 w-4 mt-0.5 text-zinc-400 flex-shrink-0" />
                <span>
                  {client.address && <span>{client.address}<br /></span>}
                  {client.city}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-zinc-400">
              <CalendarDays className="h-4 w-4" />
              Cliente desde {formatDate(client.created_at)}
            </div>
            {client.notes && (
              <div className="rounded-lg bg-zinc-50 p-3 text-zinc-600 text-xs border border-zinc-200 mt-2">
                {client.notes}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats + quotes */}
        <div className="lg:col-span-2 space-y-4">
          {/* Mini stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-2xl font-bold">{quoteList.length}</p>
                <p className="text-xs text-zinc-500">Cotizaciones</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-2xl font-bold">{totalUnits.toLocaleString("es-CO")}</p>
                <p className="text-xs text-zinc-500">Unidades cotizadas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-lg font-bold text-green-600">{formatCOP(totalRevenue)}</p>
                <p className="text-xs text-zinc-500">Ventas aceptadas</p>
              </CardContent>
            </Card>
          </div>

          {/* Quote history */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Historial de cotizaciones</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {quoteList.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-zinc-400">Este cliente no tiene cotizaciones aún.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-zinc-400">
                      <th className="px-6 pb-3 text-left font-medium">#</th>
                      <th className="px-3 pb-3 text-right font-medium">Total</th>
                      <th className="px-3 pb-3 text-left font-medium">Estado</th>
                      <th className="px-6 pb-3 text-right font-medium">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quoteList.map((q) => (
                      <tr key={q.id} className="border-b last:border-0 hover:bg-zinc-50">
                        <td className="px-6 py-3 font-mono text-xs font-bold text-zinc-600">
                          <Link href={`/admin/cotizaciones/${q.id}`} className="hover:text-orange-500 flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {q.quote_number}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold">{formatCOP(q.total)}</td>
                        <td className="px-3 py-3">
                          <Badge variant={STATUS_COLOR[q.status] as any} className="text-xs">
                            {STATUS_LABEL[q.status]}
                          </Badge>
                        </td>
                        <td className="px-6 py-3 text-right text-xs text-zinc-400">
                          {formatDate(q.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
