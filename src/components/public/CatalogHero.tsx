"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { LampContainer } from "@/components/ui/lamp";

interface Stat {
  num: number;
  label: string;
}

interface CatalogHeroProps {
  categoryName: string;
  description?: string | null;
  stats: Stat[];
}

export function CatalogHero({ categoryName, description, stats }: CatalogHeroProps) {
  return (
    <LampContainer>
      {/* Breadcrumb */}
      <motion.nav
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5, ease: "easeOut" }}
        aria-label="Breadcrumb"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "rgba(255,255,255,0.45)",
          marginBottom: 12,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <Link href="/" style={{ color: "rgba(255,255,255,0.45)", textDecoration: "none" }}>
          Inicio
        </Link>
        <span style={{ color: "rgba(255,255,255,0.25)" }}>/</span>
        <Link href="/#catalogo" style={{ color: "rgba(255,255,255,0.45)", textDecoration: "none" }}>
          Catálogo
        </Link>
        <span style={{ color: "rgba(255,255,255,0.25)" }}>/</span>
        <span style={{ color: "rgba(255,255,255,0.75)" }}>{categoryName}</span>
      </motion.nav>

      {/* Eyebrow */}
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#FF6B1A",
          marginBottom: 10,
        }}
      >
        Catálogo 2026
      </motion.p>

      {/* Category name — illuminated title */}
      <motion.h1
        initial={{ opacity: 0.4, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.85, ease: "easeInOut" }}
        style={{
          fontSize: "clamp(3rem, 8vw, 6rem)",
          fontWeight: 900,
          lineHeight: 1.0,
          textAlign: "center",
          margin: "0 0 16px",
          background: "linear-gradient(to bottom right, #ffffff 30%, rgba(255,107,26,0.55) 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          letterSpacing: "-0.03em",
        }}
      >
        {categoryName}
      </motion.h1>

      {/* Description */}
      {description && (
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5, ease: "easeOut" }}
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.55)",
            textAlign: "center",
            maxWidth: 480,
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          {description}
        </motion.p>
      )}

      {/* Stats row */}
      {stats.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5, ease: "easeOut" }}
          style={{
            display: "flex",
            gap: 32,
            marginTop: description ? 0 : 8,
            justifyContent: "center",
          }}
        >
          {stats.map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "clamp(1.5rem, 4vw, 2.2rem)",
                  fontWeight: 800,
                  color: "#ffffff",
                  lineHeight: 1,
                }}
              >
                {s.num}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.40)",
                  marginTop: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontWeight: 500,
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </LampContainer>
  );
}
