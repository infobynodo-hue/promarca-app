"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { TemplateSelector, TemplateId } from "./TemplateSelector";
import { PromptEditor } from "./PromptEditor";
import { ResultPreview } from "./ResultPreview";
import { Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_PROMPTS: Record<TemplateId, string> = {
  dark_studio: `Photograph of [PRODUCT] taken in a professional commercial photography studio. Shot on a Phase One medium format camera with a 120mm macro lens at f/8, ISO 100. The image must look like a real photograph, not a 3D render or CGI. The product sits on a dark matte surface with a very subtle barely visible reflection beneath it. Background is a deep dark charcoal, naturally lit with two large softbox lights, one from the upper left as key light and one from the right as a soft rim light. The product finish shows real physical micro-texture under studio light with natural imperfections that make it look tactile and real. Photojournalistic realism, tack sharp focus, neutral-cool color grading, no grain, no blur, 4K resolution, no text, no logos.`,
  exploded: `Professional commercial product photography exploded view of [PRODUCT], all individual components floating and separated in mid-air around the main body, arranged in a clean organized composition. Each component casts a very subtle soft shadow as if lit from above by a large softbox. Background is a neutral warm light gray gradient, clean and minimal. The floating pieces are sharp and in focus with breathing room between them. Lighting is soft, even, and diffused. Clean premium product catalog aesthetic, shot on a seamless white-to-light-gray paper backdrop in a professional studio. Phase One medium format camera, photorealistic, not a 3D render, tack sharp, 4K. No text, no logos.`,
  clean_white: `Ultra-realistic professional e-commerce product photography of [PRODUCT] on a pure white seamless background. Shot on a medium format camera at f/11, ISO 100. Even diffused lighting from both sides with no harsh shadows, only a very soft natural drop shadow beneath the product. The product is centered, tack sharp from top to bottom, true-to-color representation. Amazon-style product photography, commercial quality, 4K resolution. No text, no logos, no props.`,
};

export function SingleMode() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imageBase64, setImageBase64] = useState<string>("");
  const [imagePreview, setImagePreview] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const [template, setTemplate] = useState<TemplateId>("clean_white");
  const [description, setDescription] = useState("");
  const [customPrompt, setCustomPrompt] = useState(DEFAULT_PROMPTS.clean_white);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ url: string; id: string } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Update prompt when template or description changes
  const handleTemplateChange = (t: TemplateId) => {
    setTemplate(t);
    setCustomPrompt(DEFAULT_PROMPTS[t].replace(/\[PRODUCT\]/g, description || "[PRODUCT]"));
  };

  const handleDescriptionChange = (v: string) => {
    setDescription(v);
    setCustomPrompt(DEFAULT_PROMPTS[template].replace(/\[PRODUCT\]/g, v || "[PRODUCT]"));
  };

  const loadFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se aceptan imágenes");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("La imagen no puede superar 10MB");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, []);

  const handleGenerate = async () => {
    if (!imageBase64) { toast.error("Sube una imagen primero"); return; }
    if (!description.trim()) { toast.error("Describe el producto"); return; }

    setGenerating(true);
    setResult(null);
    setProgress(10);

    // Simulate progress
    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 5, 90));
    }, 2000);

    try {
      const res = await fetch("/api/generate-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          template,
          productDescription: description,
          customPrompt,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Error al generar");
      setResult({ url: data.generatedImageUrl, id: data.generationId });
      setProgress(100);
      toast.success("¡Foto generada correctamente! ✨");
    } catch (err: any) {
      toast.error(err.message);
      setProgress(0);
    } finally {
      clearInterval(interval);
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <div>
        <Label className="text-sm font-medium">Imagen del producto (del proveedor)</Label>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !imagePreview && fileInputRef.current?.click()}
          className={`mt-2 relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all ${
            dragging ? "border-orange-400 bg-orange-50" :
            imagePreview ? "border-zinc-200 bg-zinc-50 cursor-default" :
            "border-zinc-300 bg-zinc-50 hover:border-orange-300 hover:bg-orange-50/50"
          }`}
        >
          {imagePreview ? (
            <div className="relative w-full p-3">
              <img src={imagePreview} alt="Preview" className="mx-auto max-h-52 rounded-lg object-contain" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setImagePreview(""); setImageBase64(""); setFileName(""); }}
                className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <X className="h-4 w-4" />
              </button>
              <p className="mt-2 text-center text-xs text-zinc-500">{fileName}</p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="mt-1 block mx-auto text-xs text-orange-600 hover:underline"
              >
                Cambiar imagen
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
                <Upload className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="font-medium text-zinc-700">Arrastra la foto del proveedor</p>
                <p className="text-sm text-zinc-500">o haz clic para seleccionar · JPG, PNG, WebP · máx 10MB</p>
              </div>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />
        </div>
      </div>

      {/* Description */}
      <div>
        <Label className="text-sm font-medium">Descripción del producto <span className="text-red-500">*</span></Label>
        <Input
          value={description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder="Ej: termo de acero inoxidable 500ml color negro"
          className="mt-1.5"
        />
        <p className="mt-1 text-xs text-zinc-400">Sé específico: material, color, tamaño. Mejor descripción = mejor foto.</p>
      </div>

      {/* Template selector */}
      <div>
        <Label className="text-sm font-medium mb-2 block">Estilo de fotografía</Label>
        <TemplateSelector value={template} onChange={handleTemplateChange} />
      </div>

      {/* Prompt editor */}
      <PromptEditor
        template={template}
        productDescription={description}
        value={customPrompt}
        onChange={setCustomPrompt}
      />

      {/* Generate button */}
      {generating ? (
        <div className="space-y-2">
          <div className="h-3 w-full rounded-full bg-zinc-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-1000 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center text-sm text-zinc-500">
            Generando con IA… esto puede tardar 20-40 segundos ☕
          </p>
        </div>
      ) : (
        <Button
          onClick={handleGenerate}
          disabled={!imageBase64 || !description.trim()}
          className="w-full h-12 text-base gap-2 bg-orange-500 hover:bg-orange-600"
        >
          <Sparkles className="h-5 w-5" />
          Generar foto profesional
        </Button>
      )}

      {/* Result */}
      {result && !generating && (
        <Card className="border-orange-200 bg-orange-50/30">
          <CardContent className="pt-4">
            <ResultPreview
              originalUrl={imagePreview}
              generatedUrl={result.url}
              onRegenerate={handleGenerate}
              generating={generating}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
