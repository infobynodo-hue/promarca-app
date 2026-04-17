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
  images: string[];
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
      className="product-card-new"
    >
      {/* ── Image ── */}
      <div className="product-thumb-new">
        {images.length > 0 ? (
          <img
            src={images[imgIdx]}
            alt={name}
            className="product-thumb-img"
            style={{ transform: hovered ? "scale(1.04)" : "scale(1)" }}
          />
        ) : (
          <div className="product-thumb-placeholder">📦</div>
        )}

        {/* Arrows — only on hover with multiple images */}
        {hasMultiple && hovered && (
          <>
            <button onClick={prev} className="product-arrow product-arrow-left">
              <ChevronLeft style={{ width: 12, height: 12 }} />
            </button>
            <button onClick={next} className="product-arrow product-arrow-right">
              <ChevronRight style={{ width: 12, height: 12 }} />
            </button>
          </>
        )}

        {/* Dot indicators */}
        {hasMultiple && (
          <div className="product-dots">
            {images.slice(0, 5).map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setImgIdx(i); }}
                className="product-dot"
                style={{
                  width: i === imgIdx ? 14 : 5,
                  background: i === imgIdx ? "#FF6B1A" : "rgba(255,255,255,0.8)",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Info ── */}
      <div className="product-info">
        {product_colors.length > 0 && (
          <div className="color-dots">
            {product_colors.slice(0, 5).map((c) => (
              <span
                key={c.id}
                className="color-dot"
                style={{ background: c.hex_color }}
                title={c.name}
              />
            ))}
            {product_colors.length > 5 && (
              <span className="color-more">+{product_colors.length - 5}</span>
            )}
          </div>
        )}

        <p className="product-ref">{reference}</p>

        {/* Glass orange pill for name */}
        <span className="product-name-glass">{name}</span>

        <div className="product-price-block">
          {!has_variants && <span className="price-badge">{price_label}</span>}
          <p className="product-price">
            {has_variants ? `Desde ${formatPrice(price)}` : formatPrice(price)}
          </p>
        </div>

        <button className="btn-personalizar" onClick={(e) => { e.stopPropagation(); onClick(); }}>
          Ver detalles
        </button>
      </div>
    </article>
  );
}
