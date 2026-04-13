"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TemplateSelector, TemplateId } from "./TemplateSelector";
import { BatchQueue, QueueItem } from "./BatchQueue";
import { Upload, Play, Download, FileImage } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const MAX_CONCURRENT = 3;

export function BatchMode() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [template, setTemplate] = useState<TemplateId>("clean_white");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) { toast.error("Solo se aceptan imágenes"); return; }

    const newItems: QueueItem[] = [];
    arr.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const nameStem = file.name.replace(/\.[^.]+$/, "");
        newItems.push({
          id: `${Date.now()}-${Math.random()}`,
          fileName: file.name,
          imageBase64: base64,
          productDescription: nameStem.replace(/[-_]/g, " "),
          status: "pending",
        });
        if (newItems.length === arr.length) {
          setQueue((prev) => [...prev, ...newItems]);
          toast.success(`${arr.length} imagen(es) en cola`);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  const updateItemStatus = (id: string, patch: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const processItem = async (item: QueueItem) => {
    updateItemStatus(item.id, { status: "processing" });
    try {
      const res = await fetch("/api/generate-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: item.imageBase64,
          template,
          productDescription: item.productDescription,
          productId: item.productId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Error");
      updateItemStatus(item.id, { status: "completed", generatedImageUrl: data.generatedImageUrl });
    } catch (err: any) {
      updateItemStatus(item.id, { status: "failed", error: err.message });
    }
  };

  const handleRun = async () => {
    const pending = queue.filter((i) => i.status === "pending" || i.status === "failed");
    if (pending.length === 0) { toast.error("No hay imágenes pendientes"); return; }

    setRunning(true);
    // Process in chunks
    for (let i = 0; i < pending.length; i += MAX_CONCURRENT) {
      const chunk = pending.slice(i, i + MAX_CONCURRENT);
      await Promise.all(chunk.map((item) => processItem(item)));
    }
    setRunning(false);
    toast.success("Proceso completado");
  };

  const handleRetry = (id: string) => {
    updateItemStatus(id, { status: "pending", error: undefined });
  };

  const handleDownloadAll = async () => {
    const completed = queue.filter((i) => i.status === "completed" && i.generatedImageUrl);
    if (completed.length === 0) { toast.error("No hay fotos generadas para descargar"); return; }

    toast.info("Preparando ZIP…");
    const zip = new JSZip();
    await Promise.all(
      completed.map(async (item) => {
        try {
          const res = await fetch(item.generatedImageUrl!);
          const blob = await res.blob();
          zip.file(`${item.fileName.replace(/\.[^.]+$/, "")}-ia.jpg`, blob);
        } catch {}
      })
    );
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `fotos-ia-${Date.now()}.zip`);
  };

  const completed = queue.filter((i) => i.status === "completed").length;

  return (
    <div className="space-y-6">
      {/* Upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all ${
          dragging ? "border-orange-400 bg-orange-50" : "border-zinc-300 bg-zinc-50 hover:border-orange-300 hover:bg-orange-50/50"
        }`}
      >
        <div className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
            <FileImage className="h-6 w-6 text-orange-500" />
          </div>
          <div>
            <p className="font-medium text-zinc-700">Arrastra varias fotos aquí</p>
            <p className="text-sm text-zinc-500">o haz clic para seleccionar múltiples imágenes</p>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); }} />
      </div>

      {/* Tip: name files by reference */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
        💡 <strong>Tip:</strong> Nombra los archivos con la referencia del producto (ej: <code>TM-2201.jpg</code>) para identificarlos fácilmente. La descripción se autocompleta con el nombre del archivo.
      </div>

      {/* Template */}
      <div>
        <Label className="text-sm font-medium mb-2 block">Estilo para todas las fotos</Label>
        <TemplateSelector value={template} onChange={setTemplate} />
      </div>

      {/* Description override per item (inline in queue) */}
      {queue.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-700">
              Cola de generación · <span className="text-zinc-500">{queue.length} imagen(es)</span>
            </p>
            <Button variant="ghost" size="sm" className="text-xs text-red-500" onClick={() => setQueue([])}>
              Limpiar cola
            </Button>
          </div>

          {/* Inline descriptions */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {queue.filter(i => i.status === "pending").map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-2.5">
                <img src={item.imageBase64} alt={item.fileName} className="h-10 w-10 rounded object-cover border border-zinc-100" />
                <span className="text-xs text-zinc-500 w-28 truncate shrink-0">{item.fileName}</span>
                <Input
                  value={item.productDescription}
                  onChange={(e) => updateItemStatus(item.id, { productDescription: e.target.value })}
                  placeholder="Descripción del producto"
                  className="h-8 text-xs flex-1"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleRun}
          disabled={running || queue.filter(i => i.status === "pending" || i.status === "failed").length === 0}
          className="flex-1 h-11 gap-2 bg-orange-500 hover:bg-orange-600"
        >
          <Play className="h-4 w-4" />
          {running ? "Generando…" : `Generar ${queue.filter(i => i.status === "pending" || i.status === "failed").length} foto(s)`}
        </Button>
        {completed > 0 && (
          <Button variant="outline" onClick={handleDownloadAll} className="gap-2">
            <Download className="h-4 w-4" /> Descargar ZIP ({completed})
          </Button>
        )}
      </div>

      {/* Queue with status */}
      {queue.filter(i => i.status !== "pending").length > 0 && (
        <BatchQueue
          items={queue.filter(i => i.status !== "pending")}
          onRetry={handleRetry}
        />
      )}
    </div>
  );
}
