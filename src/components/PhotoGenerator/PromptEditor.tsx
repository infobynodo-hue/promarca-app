"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { TemplateId } from "./TemplateSelector";

const DEFAULT_PROMPTS: Record<TemplateId, string> = {
  dark_studio: `Photograph of [PRODUCT] taken in a professional commercial photography studio. Shot on a Phase One medium format camera with a 120mm macro lens at f/8, ISO 100. The image must look like a real photograph, not a 3D render or CGI. The product sits on a dark matte surface with a very subtle barely visible reflection beneath it. Background is a deep dark charcoal, naturally lit with two large softbox lights, one from the upper left as key light and one from the right as a soft rim light. The product finish shows real physical micro-texture under studio light with natural imperfections that make it look tactile and real. Photojournalistic realism, tack sharp focus, neutral-cool color grading, no grain, no blur, 4K resolution, no text, no logos.`,

  exploded: `Professional commercial product photography exploded view of [PRODUCT], all individual components floating and separated in mid-air around the main body, arranged in a clean organized composition. Each component casts a very subtle soft shadow as if lit from above by a large softbox. Background is a neutral warm light gray gradient, clean and minimal. The floating pieces are sharp and in focus with breathing room between them. Lighting is soft, even, and diffused. Clean premium product catalog aesthetic, shot on a seamless white-to-light-gray paper backdrop in a professional studio. Phase One medium format camera, photorealistic, not a 3D render, tack sharp, 4K. No text, no logos.`,

  clean_white: `Ultra-realistic professional e-commerce product photography of [PRODUCT] on a pure white seamless background. Shot on a medium format camera at f/11, ISO 100. Even diffused lighting from both sides with no harsh shadows, only a very soft natural drop shadow beneath the product. The product is centered, tack sharp from top to bottom, true-to-color representation. Amazon-style product photography, commercial quality, 4K resolution. No text, no logos, no props.`,
};

interface Props {
  template: TemplateId;
  productDescription: string;
  value: string;
  onChange: (v: string) => void;
}

export function PromptEditor({ template, productDescription, value, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  const handleReset = () => {
    const base = DEFAULT_PROMPTS[template];
    onChange(base.replace(/\[PRODUCT\]/g, productDescription || "[PRODUCT]"));
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-xs bg-zinc-200 text-zinc-600 rounded px-1.5 py-0.5 font-mono">PROMPT</span>
          Editar prompt de IA
        </span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="border-t border-zinc-200 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500">Edita el prompt completo antes de generar. <strong>[PRODUCT]</strong> se reemplaza automáticamente.</p>
            <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-xs gap-1">
              <RotateCcw className="h-3 w-3" /> Restaurar
            </Button>
          </div>
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={6}
            className="text-xs font-mono bg-white"
            placeholder="Prompt de generación..."
          />
        </div>
      )}
    </div>
  );
}
