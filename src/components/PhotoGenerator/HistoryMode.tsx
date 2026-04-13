"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, RefreshCw, Columns2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Generation {
  id: string;
  product_description: string;
  template_used: string;
  prompt_used: string;
  original_image_path: string | null;
  generated_image_url: string | null;
  status: string;
  created_at: string;
}

const TEMPLATE_LABELS: Record<string, string> = {
  dark_studio: "Estudio oscuro",
  exploded: "Vista explosionada",
  clean_white: "Fondo blanco",
};

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  processing: "secondary",
  pending: "secondary",
  failed: "destructive",
};

export function HistoryMode() {
  const supabase = createClient();
  const [items, setItems] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTemplate, setFilterTemplate] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selected, setSelected] = useState<Generation | null>(null);
  const [comparing, setComparing] = useState(false);

  const fetchHistory = async () => {
    let query = supabase
      .from("photo_generations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (filterTemplate !== "all") query = query.eq("template_used", filterTemplate);
    if (filterStatus !== "all") query = query.eq("status", filterStatus);

    const { data } = await query;
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchHistory(); }, [filterTemplate, filterStatus]);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este registro?")) return;
    await supabase.from("photo_generations").delete().eq("id", id);
    toast.success("Eliminado");
    fetchHistory();
  };

  if (loading) return <p className="text-zinc-500 py-8 text-center">Cargando historial…</p>;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterTemplate} onValueChange={(v) => setFilterTemplate(v ?? "all")}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos los estilos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estilos</SelectItem>
            <SelectItem value="dark_studio">Estudio oscuro</SelectItem>
            <SelectItem value="exploded">Vista explosionada</SelectItem>
            <SelectItem value="clean_white">Fondo blanco</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? "all")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="completed">Completados</SelectItem>
            <SelectItem value="failed">Con error</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={fetchHistory}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Actualizar
        </Button>
        <span className="ml-auto text-xs text-zinc-400 self-center">{items.length} registros</span>
      </div>

      {/* Grid */}
      {items.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-zinc-400 text-sm">No hay generaciones aún</p>
          <p className="text-zinc-300 text-xs mt-1">Genera tu primera foto en la pestaña "Individual"</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="group relative rounded-xl overflow-hidden border border-zinc-200 bg-white cursor-pointer hover:shadow-md transition-all"
              onClick={() => { setSelected(item); setComparing(false); }}
            >
              {/* Image */}
              <div className="aspect-square bg-zinc-100">
                {item.generated_image_url ? (
                  <img
                    src={item.generated_image_url}
                    alt={item.product_description}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <span className="text-2xl">
                      {item.status === "processing" ? "⏳" : item.status === "failed" ? "❌" : "📷"}
                    </span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-2.5">
                <p className="text-xs font-medium text-zinc-800 truncate">{item.product_description}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400">{TEMPLATE_LABELS[item.template_used] ?? item.template_used}</span>
                  <Badge variant={STATUS_COLORS[item.status] ?? "outline"} className="text-[10px] h-4 px-1.5">
                    {item.status === "completed" ? "✓" : item.status}
                  </Badge>
                </div>
                <p className="text-[10px] text-zinc-300 mt-0.5">
                  {new Date(item.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>

              {/* Hover actions */}
              <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                {item.generated_image_url && (
                  <a
                    href={item.generated_image_url}
                    download={`ia-${item.product_description}.jpg`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </a>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-base">{selected?.product_description}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              {/* Image view */}
              {comparing ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-center text-zinc-500 mb-1">Original (referencia)</p>
                    <div className="h-64 rounded-xl bg-zinc-100 border flex items-center justify-center">
                      <p className="text-xs text-zinc-400">Imagen original no almacenada</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-center font-medium mb-1">Generado con IA</p>
                    {selected.generated_image_url && (
                      <img src={selected.generated_image_url} className="h-64 w-full object-contain rounded-xl border" alt="Generated" />
                    )}
                  </div>
                </div>
              ) : (
                selected.generated_image_url && (
                  <img src={selected.generated_image_url} className="w-full max-h-80 object-contain rounded-xl border" alt="Generated" />
                )
              )}

              {/* Prompt used */}
              <details className="rounded-lg bg-zinc-50 border border-zinc-200">
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-600">Ver prompt utilizado</summary>
                <p className="px-3 pb-3 text-xs text-zinc-500 font-mono whitespace-pre-wrap">{selected.prompt_used}</p>
              </details>

              {/* Meta */}
              <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-500">
                <span>Estilo: <strong>{TEMPLATE_LABELS[selected.template_used]}</strong></span>
                <span>·</span>
                <span>{new Date(selected.created_at).toLocaleString("es-CO")}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {selected.generated_image_url && (
                  <a href={selected.generated_image_url} download={`ia-${selected.product_description}.jpg`} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button className="w-full gap-2">
                      <Download className="h-4 w-4" /> Descargar
                    </Button>
                  </a>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
