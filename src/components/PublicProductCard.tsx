"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Color {
  id: string;
  name: string;
  hex_color: string;
}

export interface PublicProductCardProps {
  id: string;
  reference: string;
  name: string;
  price: number;
  price_label: string;
  has_variants: boolean;
  product_colors: Color[];
  images: string[]; // array of public URLs, primary first
  onClick: () => void;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(price);

export function PublicProductCard({
  reference,
  name,
  price,
  price_label,
  has_variants,
  product_colors,
  images,
  onClick,
}: PublicProductCardProps) {
  const [imgIdx, setImgIdx] = useState(0);
  const [hovered, setHovered] = useState(false);
  const hasMultiple = images.length > 1;

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIdx((i) => (i - 1 + images.length) % images.length);
  };
  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIdx((i) => (i + 1) % images.length);
  };

  return (
    <article
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-orange-100"
    >
      {/* ── Image area ── */}
      <div className="relative overflow-hidden rounded-t-2xl bg-zinc-50">
        {/* Aspect ratio 1:1 */}
        <div className="relative w-full" style={{ paddingBottom: "100%" }}>
          {images.length > 0 ? (
            <img
              src={images[imgIdx]}
              alt={name}
              className="absolute inset-0 h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-4xl text-zinc-200">
              📦
            </div>
          )}

          {/* Gradient overlay on hover */}
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.08) 0%, transparent 50%)",
              opacity: hovered ? 1 : 0,
            }}
          />

          {/* Prev / Next arrows — only if multiple images */}
          {hasMultiple && hovered && (
            <>
              <button
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-md border border-zinc-100 transition-all hover:bg-white hover:scale-110"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-zinc-700" />
              </button>
              <button
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-md border border-zinc-100 transition-all hover:bg-white hover:scale-110"
              >
                <ChevronRight className="h-3.5 w-3.5 text-zinc-700" />
              </button>
            </>
          )}

          {/* Dot indicators */}
          {hasMultiple && (
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
              {images.slice(0, 6).map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setImgIdx(i); }}
                  className="rounded-full transition-all"
                  style={{
                    width: i === imgIdx ? 16 : 5,
                    height: 5,
                    background: i === imgIdx ? "#FF6B1A" : "rgba(255,255,255,0.75)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Thumbnail strip — visible on hover, scrollable */}
        {hasMultiple && (
          <div
            className="flex gap-1.5 overflow-x-auto px-3 pb-2 pt-1 transition-all duration-300 scrollbar-hide"
            style={{
              maxHeight: hovered ? 52 : 0,
              opacity: hovered ? 1 : 0,
              overflow: "hidden",
            }}
          >
            {images.map((url, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setImgIdx(i); }}
                className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all"
                style={{
                  borderColor: i === imgIdx ? "#FF6B1A" : "transparent",
                  opacity: i === imgIdx ? 1 : 0.6,
                }}
              >
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Product info ── */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {/* Reference */}
        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          {reference}
        </p>

        {/* Name — glass orange pill */}
        <span
          className="inline-block self-start rounded-full px-2.5 py-1 text-[11px] font-semibold leading-snug"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,107,26,0.16) 0%, rgba(255,165,80,0.07) 100%)",
            border: "1px solid rgba(255,107,26,0.28)",
            boxShadow:
              "0 1px 4px rgba(255,107,26,0.10), inset 0 1px 0 rgba(255,255,255,0.8)",
            color: "#b83a00",
            maxWidth: "100%",
          }}
        >
          {name}
        </span>

        {/* Colors */}
        {product_colors.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product_colors.slice(0, 6).map((c) => (
              <span
                key={c.id}
                title={c.name}
                className="h-3.5 w-3.5 rounded-full border border-black/10 shadow-sm"
                style={{ background: c.hex_color }}
              />
            ))}
            {product_colors.length > 6 && (
              <span className="text-[10px] text-zinc-400 leading-3.5 self-center">
                +{product_colors.length - 6}
              </span>
            )}
          </div>
        )}

        {/* Price row */}
        <div className="mt-auto flex items-baseline justify-between pt-1">
          <div>
            {!has_variants && (
              <span className="mr-1.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
                {price_label}
              </span>
            )}
            <span className="text-base font-black text-zinc-900 tracking-tight">
              {has_variants ? `Desde ${formatPrice(price)}` : formatPrice(price)}
            </span>
          </div>

          {/* Mini CTA */}
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-bold text-white transition-all group-hover:opacity-100 opacity-0"
            style={{ background: "#FF6B1A" }}
          >
            Ver →
          </span>
        </div>
      </div>
    </article>
  );
}
