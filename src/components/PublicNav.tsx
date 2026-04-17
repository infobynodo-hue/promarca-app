"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useFavorites } from "@/contexts/FavoritesContext";

const NAV_LINKS = [
  { label: "Catálogo",        href: "/#catalogo" },
  { label: "Personalización", href: "/#personalizacion" },
  { label: "Nosotros",        href: "/#nosotros" },
  { label: "Contacto",        href: "/#contacto" },
];

interface Position {
  left: number;
  width: number;
  opacity: number;
}

function NavTab({
  href,
  children,
  setPosition,
}: {
  href: string;
  children: React.ReactNode;
  setPosition: React.Dispatch<React.SetStateAction<Position>>;
}) {
  const ref = useRef<HTMLLIElement>(null);

  return (
    <li
      ref={ref}
      onMouseEnter={() => {
        if (!ref.current) return;
        const { width } = ref.current.getBoundingClientRect();
        setPosition({ width, opacity: 1, left: ref.current.offsetLeft });
      }}
      style={{ position: "relative", zIndex: 10, listStyle: "none" }}
    >
      <Link
        href={href}
        style={{
          display: "block",
          padding: "8px 18px",
          fontSize: "13.5px",
          fontWeight: 500,
          color: "#1d1d1f",
          whiteSpace: "nowrap",
          textDecoration: "none",
          letterSpacing: "-0.01em",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {children}
      </Link>
    </li>
  );
}

function SlidingCursor({ position }: { position: Position }) {
  return (
    <motion.li
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      animate={position as any}
      style={{
        position: "absolute",
        zIndex: 0,
        height: "34px",
        borderRadius: "9999px",
        background: "#FF6B1A",
        listStyle: "none",
        top: "50%",
        transform: "translateY(-50%)",
        margin: 0,
        padding: 0,
      }}
    />
  );
}

export function PublicNav() {
  const [position, setPosition] = useState<Position>({
    left: 0,
    width: 0,
    opacity: 0,
  });
  const { count, openDrawer } = useFavorites();

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 200,
        height: "60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        boxSizing: "border-box",
        width: "100%",
      }}
    >
      {/* ── Logo ── */}
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          textDecoration: "none",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/img/promarca-logo.png"
          alt="ProMarca"
          style={{ height: "30px", width: "auto", display: "block" }}
        />
      </Link>

      {/* ── Sliding pill nav (desktop) ── */}
      <ul
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          borderRadius: "9999px",
          border: "1px solid rgba(0,0,0,0.10)",
          background: "rgba(245,245,247,0.80)",
          padding: "4px",
          margin: 0,
          listStyle: "none",
          gap: 0,
        }}
        onMouseLeave={() => setPosition((pv) => ({ ...pv, opacity: 0 }))}
        className="hidden md:flex"
      >
        {NAV_LINKS.map((link) => (
          <NavTab key={link.href} href={link.href} setPosition={setPosition}>
            {link.label}
          </NavTab>
        ))}
        <SlidingCursor position={position} />
      </ul>

      {/* ── Mobile links ── */}
      <ul
        className="flex md:hidden"
        style={{
          alignItems: "center",
          gap: "16px",
          listStyle: "none",
          margin: 0,
          padding: 0,
        }}
      >
        {NAV_LINKS.map((link) => (
          <li key={link.href} style={{ listStyle: "none" }}>
            <Link
              href={link.href}
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "#3f3f46",
                textDecoration: "none",
              }}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      {/* ── Right: Favorites + Cotizar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexShrink: 0,
        }}
      >
        {/* Favorites heart button */}
        <button
          onClick={openDrawer}
          aria-label="Ver favoritos"
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: "1px solid rgba(255,107,26,0.20)",
            background: count > 0
              ? "rgba(255,107,26,0.10)"
              : "rgba(245,245,247,0.80)",
            cursor: "pointer",
            color: "#FF6B1A",
            transition: "all 0.2s ease",
            flexShrink: 0,
          }}
        >
          <Heart
            style={{
              width: 16,
              height: 16,
              fill: count > 0 ? "#FF6B1A" : "none",
              color: "#FF6B1A",
              transition: "fill 0.2s ease",
            }}
          />
          {count > 0 && (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                minWidth: 18,
                height: 18,
                borderRadius: 9999,
                background: "#FF6B1A",
                color: "#ffffff",
                fontSize: 10,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 4px",
                lineHeight: 1,
                boxShadow: "0 1px 4px rgba(255,107,26,0.50)",
              }}
            >
              {count}
            </span>
          )}
        </button>
        <a
          href="https://wa.me/573025212938?text=Hola!%20Quisiera%20cotizar%20productos%20promocionales"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex"
          style={{
            alignItems: "center",
            gap: "7px",
            borderRadius: "9999px",
            padding: "9px 20px",
            fontSize: "13.5px",
            fontWeight: 600,
            color: "#fff",
            background: "#FF6B1A",
            textDecoration: "none",
            whiteSpace: "nowrap",
            flexShrink: 0,
            transition: "opacity 0.15s",
          }}
        >
          <svg
            style={{ width: "15px", height: "15px", fill: "currentColor", flexShrink: 0 }}
            viewBox="0 0 24 24"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Cotizar
        </a>
      </div>
    </nav>
  );
}
