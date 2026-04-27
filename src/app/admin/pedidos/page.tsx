"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Order, OrderStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PackageCheck, Search, Truck, Users } from "lucide-react";
import Link from "next/link";

export const ORDER_STATUS_CONFIG: Record<OrderStatus, { label: string; color: string }> = {
  confirmado:       { label: "Confirmado",        color: "bg-blue-100 text-blue-700" },
  en_almacen:       { label: "En almacén",         color: "bg-yellow-100 text-yellow-700" },
  en_marcacion:     { label: "En marcación",       color: "bg-purple-100 text-purple-700" },
  salida_marcacion: { label: "Salida marcación",   color: "bg-indigo-100 text-indigo-700" },
  en_camino:        { label: "En camino",          color: "bg-orange-100 text-orange-700" },
  entregado:        { label: "Entregado ✓",        color: "bg-green-100 text-green-700 font-semibold" },
};

export default function PedidosPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const fetchOrders = async () => {
    let query = supabase
      .from("orders")
      .select("*, client:clients(id,name,company), quote:quotes(id,quote_number)")
      .order("created_at", { ascending: false });

    if (filterStatus !== "all") query = query.eq("current_status", filterStatus);

    const { data } = await query;
    setOrders(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, [filterStatus]);

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.order_number.toLowerCase().includes(q) ||
      (o.client as any)?.name?.toLowerCase().includes(q) ||
      (o.client as any)?.company?.toLowerCase().includes(q)
    );
  });

  // Stats
  const stats = {
    total: orders.length,
    active: orders.filter((o) => o.current_status !== "entregado").length,
    en_camino: orders.filter((o) => o.current_status === "en_camino").length,
    entregados: orders.filter((o) => o.current_status === "entregado").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-sm text-zinc-500 mt-1">Gestión y seguimiento de pedidos</p>
        </div>
        <Link href="/admin/proveedores">
          <Button variant="outline" className="gap-2">
            <Users className="h-4 w-4" />
            Proveedores
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total pedidos",  value: stats.total,     icon: PackageCheck, color: "text-zinc-700" },
          { label: "Activos",        value: stats.active,    icon: PackageCheck, color: "text-blue-600" },
          { label: "En camino",      value: stats.en_camino, icon: Truck,        color: "text-orange-500" },
          { label: "Entregados",     value: stats.entregados, icon: PackageCheck, color: "text-green-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border p-4">
            <p className="text-xs text-zinc-500 font-medium">{s.label}</p>
            <p className={`text-3xl font-black mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Buscar por número o cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? "all")}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(ORDER_STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-zinc-400">Cargando pedidos...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <PackageCheck className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-400 font-medium">No hay pedidos</p>
            <p className="text-sm text-zinc-400 mt-1">Los pedidos se crean desde cotizaciones confirmadas</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50">
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Cotización</TableHead>
                <TableHead>Total facturado</TableHead>
                <TableHead>Anticipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((order) => {
                const client = order.client as any;
                const quote = order.quote as any;
                const st = ORDER_STATUS_CONFIG[order.current_status] ?? ORDER_STATUS_CONFIG.confirmado;
                const saldo = order.total_billed - order.advance_payment;

                return (
                  <TableRow key={order.id} className="hover:bg-zinc-50">
                    <TableCell>
                      <span className="font-mono font-bold text-sm text-orange-600">
                        {order.order_number}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{client?.name ?? "—"}</p>
                      {client?.company && <p className="text-xs text-zinc-400">{client.company}</p>}
                    </TableCell>
                    <TableCell>
                      {quote ? (
                        <Link
                          href={`/admin/cotizaciones/${order.quote_id}`}
                          className="text-xs text-blue-600 hover:underline font-mono"
                        >
                          {quote.quote_number}
                        </Link>
                      ) : <span className="text-zinc-400 text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">{formatPrice(order.total_billed)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="text-green-600 font-medium">{formatPrice(order.advance_payment)}</p>
                        {saldo > 0 && <p className="text-xs text-zinc-400">Saldo: {formatPrice(saldo)}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.color}`}>
                        {st.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-zinc-500">
                      {new Date(order.order_date).toLocaleDateString("es-CO")}
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/pedidos/${order.id}`}>
                        <Button variant="ghost" size="sm">Ver</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
