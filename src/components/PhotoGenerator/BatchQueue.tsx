"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export interface QueueItem {
  id: string;
  fileName: string;
  imageBase64: string;
  productDescription: string;
  productId?: string;
  status: "pending" | "processing" | "completed" | "failed";
  generatedImageUrl?: string;
  error?: string;
}

interface Props {
  items: QueueItem[];
  onRetry: (id: string) => void;
}

const statusConfig = {
  pending:    { label: "Pendiente",   color: "secondary",     icon: null },
  processing: { label: "Generando…",  color: "default",       icon: Loader2 },
  completed:  { label: "Completado",  color: "default",       icon: CheckCircle2 },
  failed:     { label: "Error",       color: "destructive",   icon: XCircle },
};

export function BatchQueue({ items, onRetry }: Props) {
  if (items.length === 0) return null;

  const completed = items.filter((i) => i.status === "completed").length;
  const failed = items.filter((i) => i.status === "failed").length;
  const processing = items.filter((i) => i.status === "processing").length;

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-zinc-500">
          <span>{completed} de {items.length} completadas</span>
          <span>{failed > 0 && `${failed} con error · `}{processing > 0 && `${processing} en proceso`}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
          <div
            className="h-full bg-orange-500 transition-all duration-500"
            style={{ width: `${(completed / items.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Item list */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {items.map((item) => {
          const cfg = statusConfig[item.status];
          const Icon = cfg.icon;
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 bg-white"
            >
              {/* Thumbnail */}
              <div className="h-12 w-12 shrink-0 rounded-lg overflow-hidden bg-zinc-100 border border-zinc-200">
                <img
                  src={item.status === "completed" && item.generatedImageUrl ? item.generatedImageUrl : item.imageBase64}
                  alt={item.fileName}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-800 truncate">{item.fileName}</p>
                {item.productDescription && (
                  <p className="text-xs text-zinc-500 truncate">{item.productDescription}</p>
                )}
                {item.error && (
                  <p className="text-xs text-red-500 truncate">{item.error}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={cfg.color as any} className="text-xs gap-1">
                  {Icon && <Icon className={`h-3 w-3 ${item.status === "processing" ? "animate-spin" : ""}`} />}
                  {cfg.label}
                </Badge>

                {item.status === "completed" && item.generatedImageUrl && (
                  <a href={item.generatedImageUrl} download={`ia-${item.fileName}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Descargar">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                )}

                {item.status === "failed" && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRetry(item.id)} title="Reintentar">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
