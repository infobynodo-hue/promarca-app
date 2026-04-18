"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Tag, ArrowRight } from "lucide-react";

export interface KitOffer {
  id: string;
  imageSrc: string;
  imageAlt: string;
  tag: string;
  title: string;
  description: string;
  /** Optional: producto destacado del kit (ej: "Termo + Tula + Libreta") */
  includes?: string;
  href?: string;
}

/* ─── Individual card ─── */
function KitCard({ kit }: { kit: KitOffer }) {
  return (
    <motion.a
      href={kit.href ?? "#contacto"}
      whileHover={{ y: -8 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      style={{
        position: "relative",
        flexShrink: 0,
        width: 300,
        height: 390,
        borderRadius: 20,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        scrollSnapAlign: "start",
        textDecoration: "none",
        boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
        background: "#fff",
        border: "1px solid #f0f0f0",
      }}
    >
      {/* Top half — image */}
      <div style={{ position: "relative", height: "50%", overflow: "hidden", flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={kit.imageSrc}
          alt={kit.imageAlt}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            transition: "transform 0.5s ease",
          }}
          className="group-hover-scale"
        />
        {/* Orange tag pill on image */}
        <span
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 10px",
            borderRadius: 9999,
            fontSize: 11,
            fontWeight: 700,
            color: "#fff",
            background: "rgba(255,107,26,0.88)",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(255,150,70,0.50)",
            textShadow: "0 1px 2px rgba(0,0,0,0.20)",
            letterSpacing: "0.03em",
          }}
        >
          <Tag style={{ width: 10, height: 10, flexShrink: 0 }} />
          {kit.tag}
        </span>
      </div>

      {/* Bottom half — content */}
      <div
        style={{
          flex: 1,
          padding: "16px 20px 18px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fff",
        }}
      >
        <div>
          <h3
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: "#18181b",
              lineHeight: 1.2,
              marginBottom: 6,
              letterSpacing: "-0.02em",
            }}
          >
            {kit.title}
          </h3>
          <p
            style={{
              fontSize: 12.5,
              color: "#71717a",
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            {kit.description}
          </p>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 14,
            borderTop: "1px solid #f4f4f5",
            marginTop: 10,
          }}
        >
          {/* Includes tag */}
          <span
            style={{
              fontSize: 11,
              color: "#a1a1aa",
              fontWeight: 500,
            }}
          >
            {kit.includes ?? "Kit personalizable"}
          </span>

          {/* Arrow CTA */}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(255,107,26,0.10)",
              border: "1px solid rgba(255,107,26,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FF6B1A",
              flexShrink: 0,
              transition: "background 0.2s, transform 0.2s",
            }}
          >
            <ArrowRight style={{ width: 14, height: 14 }} />
          </div>
        </div>
      </div>
    </motion.a>
  );
}

/* ─── Carousel wrapper ─── */
export function KitCarousel({ kits }: { kits: KitOffer[] }) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -320 : 320,
      behavior: "smooth",
    });
  };

  return (
    <div style={{ position: "relative", width: "100%" }} className="group">
      {/* Left arrow */}
      <button
        onClick={() => scroll("left")}
        aria-label="Anterior"
        style={{
          position: "absolute",
          top: "50%",
          left: -16,
          transform: "translateY(-50%)",
          zIndex: 10,
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "1px solid #e4e4e7",
          background: "rgba(255,255,255,0.90)",
          backdropFilter: "blur(8px)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#3f3f46",
          boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
          opacity: 0,
          transition: "opacity 0.2s",
        }}
        className="carousel-arrow"
      >
        <ChevronLeft style={{ width: 18, height: 18 }} />
      </button>

      {/* Scrollable track */}
      <div
        ref={scrollRef}
        style={{
          display: "flex",
          gap: 20,
          overflowX: "auto",
          paddingBottom: 12,
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
        }}
        className="hide-scrollbar"
      >
        {kits.map((kit) => (
          <KitCard key={kit.id} kit={kit} />
        ))}
      </div>

      {/* Right arrow */}
      <button
        onClick={() => scroll("right")}
        aria-label="Siguiente"
        style={{
          position: "absolute",
          top: "50%",
          right: -16,
          transform: "translateY(-50%)",
          zIndex: 10,
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "1px solid #e4e4e7",
          background: "rgba(255,255,255,0.90)",
          backdropFilter: "blur(8px)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#3f3f46",
          boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
          opacity: 0,
          transition: "opacity 0.2s",
        }}
        className="carousel-arrow"
      >
        <ChevronRight style={{ width: 18, height: 18 }} />
      </button>

      {/* CSS for arrow hover via group */}
      <style>{`
        .group:hover .carousel-arrow { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
