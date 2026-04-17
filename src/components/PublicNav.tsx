"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

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
      className="relative z-10"
    >
      <Link
        href={href}
        className="block cursor-pointer select-none px-4 py-2 text-[13px] font-medium text-white mix-blend-difference md:px-5 md:py-2.5 md:text-sm whitespace-nowrap"
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
      className="absolute z-0 h-8 rounded-full md:h-9"
      style={{ background: "#FF6B1A" }}
    />
  );
}

export function PublicNav() {
  const [position, setPosition] = useState<Position>({
    left: 0,
    width: 0,
    opacity: 0,
  });

  return (
    <nav
      className="sticky top-0 z-[200] flex items-center justify-between px-5 py-3"
      style={{
        background: "rgba(255,255,255,0.88)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        height: "52px",
      }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/promarca-logo.png" alt="ProMarca" className="h-7 w-auto" />
      </Link>

      {/* Sliding pill nav */}
      <ul
        className="relative hidden md:flex items-center rounded-full border p-1"
        style={{
          borderColor: "rgba(0,0,0,0.10)",
          background: "rgba(245,245,247,0.70)",
        }}
        onMouseLeave={() => setPosition((pv) => ({ ...pv, opacity: 0 }))}
      >
        {NAV_LINKS.map((link) => (
          <NavTab key={link.href} href={link.href} setPosition={setPosition}>
            {link.label}
          </NavTab>
        ))}
        <SlidingCursor position={position} />
      </ul>

      {/* Mobile links (plain) */}
      <ul className="flex md:hidden items-center gap-4">
        {NAV_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-xs font-medium text-zinc-700 hover:text-orange-500 transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      {/* Right actions */}
      <div className="flex items-center gap-4 flex-shrink-0">
        {/* WhatsApp CTA */}
        <a
          href="https://wa.me/573025212938?text=Hola!%20Quisiera%20cotizar%20productos%20promocionales"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-85"
          style={{ background: "#FF6B1A" }}
        >
          <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Cotizar
        </a>
      </div>
    </nav>
  );
}
