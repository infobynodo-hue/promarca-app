import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, ExternalLink, Megaphone } from "lucide-react";
import { CampaignStatusToggle } from "./CampaignStatusToggle";

export const metadata = { title: "Campañas B2C — ProMarca Admin" };

export default async function CampanasPage() {
  const supabase = await createClient();

  const { data: campaigns } = await supabase
    .from("b2c_campaigns")
    .select("*, product:products(name, reference)")
    .order("created_at", { ascending: false });

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campañas B2C</h1>
          <p className="text-sm text-zinc-500">
            {campaigns?.length ?? 0} campaña{(campaigns?.length ?? 0) !== 1 ? "s" : ""} de venta directa
          </p>
        </div>
        <Link href="/admin/campanas/nueva">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Nueva campaña
          </Button>
        </Link>
      </div>

      <Card className="mt-6">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marca</TableHead>
                <TableHead>Titular</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creada</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!campaigns || campaigns.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-zinc-400">
                      <Megaphone className="h-12 w-12 text-zinc-200" />
                      <p className="font-medium">Crea tu primera campaña de venta directa</p>
                      <p className="text-sm text-zinc-400">
                        Las campañas B2C te permiten vender directamente al consumidor con una landing page personalizada.
                      </p>
                      <Link href="/admin/campanas/nueva">
                        <Button size="sm" className="mt-2">
                          <Plus className="mr-2 h-4 w-4" /> Nueva campaña
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {(campaigns ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {c.brand_logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.brand_logo_url}
                          alt={c.brand_name}
                          className="h-7 w-auto max-w-[80px] rounded object-contain"
                        />
                      ) : (
                        <span
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ background: c.primary_color ?? "#FF6B2C" }}
                        >
                          {(c.brand_name ?? "?")[0]?.toUpperCase()}
                        </span>
                      )}
                      <span className="font-medium">{c.brand_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-zinc-700">
                    {c.headline ?? "—"}
                  </TableCell>
                  <TableCell className="text-zinc-500">
                    {(c.product as any)?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={c.status === "published" ? "default" : "secondary"}
                      className={
                        c.status === "published"
                          ? "bg-green-100 text-green-700 hover:bg-green-100"
                          : ""
                      }
                    >
                      {c.status === "published" ? "Publicada" : "Borrador"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-zinc-500">
                    {new Date(c.created_at).toLocaleDateString("es-CO")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <CampaignStatusToggle
                        id={c.id}
                        currentStatus={c.status ?? "draft"}
                      />
                      <Link href={`/admin/campanas/${c.id}/editar`}>
                        <Button variant="ghost" size="sm">
                          Editar
                        </Button>
                      </Link>
                      {c.slug && (
                        <a
                          href={`/tienda/${c.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="mr-1 h-3.5 w-3.5" />
                            Ver landing
                          </Button>
                        </a>
                      )}
                    </div>
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
