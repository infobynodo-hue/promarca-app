"use client";

import { cn } from "@/lib/utils";

export type TemplateId = "dark_studio" | "exploded" | "clean_white";

interface Template {
  id: TemplateId;
  label: string;
  description: string;
  emoji: string;
  preview: string; // bg color for mock preview
}

const TEMPLATES: Template[] = [
  {
    id: "dark_studio",
    label: "Estudio oscuro",
    description: "Fondo negro carbón con luces suaves. Ideal para productos premium y metálicos.",
    emoji: "🌑",
    preview: "from-zinc-900 to-zinc-800",
  },
  {
    id: "exploded",
    label: "Vista explosionada",
    description: "Componentes flotando separados. Ideal para mostrar piezas y materiales.",
    emoji: "💥",
    preview: "from-slate-100 to-slate-200",
  },
  {
    id: "clean_white",
    label: "Fondo blanco",
    description: "E-commerce puro sobre fondo blanco. Estilo Amazon/catálogo web.",
    emoji: "⬜",
    preview: "from-white to-gray-100",
  },
];

interface Props {
  value: TemplateId;
  onChange: (id: TemplateId) => void;
}

export function TemplateSelector({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {TEMPLATES.map((tpl) => (
        <button
          key={tpl.id}
          type="button"
          onClick={() => onChange(tpl.id)}
          className={cn(
            "group relative flex flex-col rounded-xl border-2 p-4 text-left transition-all hover:shadow-md",
            value === tpl.id
              ? "border-orange-500 bg-orange-50 shadow-sm"
              : "border-zinc-200 bg-white hover:border-zinc-300"
          )}
        >
          {/* Mock preview gradient */}
          <div className={cn("mb-3 h-16 w-full rounded-lg bg-gradient-to-br", tpl.preview, "border border-zinc-100 flex items-center justify-center")}>
            <span className="text-2xl">{tpl.emoji}</span>
          </div>
          <p className={cn("text-sm font-semibold", value === tpl.id ? "text-orange-700" : "text-zinc-800")}>
            {tpl.label}
          </p>
          <p className="mt-1 text-xs text-zinc-500 leading-relaxed">{tpl.description}</p>
          {value === tpl.id && (
            <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500">
              <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
