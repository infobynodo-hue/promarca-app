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
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1, duration: 0.4 }}
        aria-label="Breadcrumb"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "rgba(255,255,255,0.40)",
          marginBottom: 14,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <Link href="/" style={{ color: "rgba(255,255,255,0.40)", textDecoration: "none" }}>
          Inicio
        </Link>
        <span style={{ color: "rgba(255,255,255,0.20)" }}>/</span>
        <Link href="/#catalogo" style={{ color: "rgba(255,255,255,0.40)", textDecoration: "none" }}>
          Catálogo
        </Link>
        <span style={{ color: "rgba(255,255,255,0.20)" }}>/</span>
        <span style={{ color: "rgba(255,255,255,0.70)" }}>{categoryName}</span>
      </motion.nav>

      {/* Eyebrow */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.18, duration: 0.4 }}
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#FF6B1A",
          marginBottom: 12,
        }}
      >
        Catálogo 2026
      </motion.p>

      {/* Category name — the illuminated word */}
      <motion.h1
        initial={{ opacity: 0.3, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.28, duration: 0.85, ease: "easeInOut" }}
        style={{
          fontSize: "clamp(3.2rem, 9vw, 7rem)",
          fontWeight: 900,
          lineHeight: 1.05,
          textAlign: "center",
          margin: "0 0 20px",
          /* White on top, fading into orange glow — mimics lamp illumination */
          background:
            "linear-gradient(to bottom, #ffffff 0%, #ffffff 40%, rgba(255,140,60,0.75) 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          letterSpacing: "-0.03em",
          /* Padding ensures descenders (g, p, y) never clip */
          paddingBottom: "0.15em",
        }}
      >
        {categoryName}
      </motion.h1>

      {/* Description */}
      {description && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.42, duration: 0.4 }}
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.50)",
            textAlign: "center",
            maxWidth: 500,
            lineHeight: 1.65,
            marginBottom: 24,
          }}
        >
          {description}
        </motion.p>
      )}

      {/* Stats */}
      {stats.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.50, duration: 0.4 }}
          style={{
            display: "flex",
            gap: 40,
            marginTop: description ? 0 : 4,
            justifyContent: "center",
          }}
        >
          {stats.map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
                  fontWeight: 800,
                  color: "#ffffff",
                  lineHeight: 1,
                }}
              >
                {s.num}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.35)",
                  marginTop: 5,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  fontWeight: 600,
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
