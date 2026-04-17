"use client";

import { useEffect, useState, useCallback } from "react";

const slides = [
  {
    src: "/img/hero/slide-eventos.png",
    label: "Eventos corporativos",
  },
  {
    src: "/img/hero/slide-oracle.png",
    label: "Tecnología promocional",
  },
  {
    src: "/img/hero/slide-viviendas.png",
    label: "Kits inmobiliarios",
  },
  {
    src: "/img/hero/slide-ecoimagen.png",
    label: "Sector salud",
  },
];

const INTERVAL = 5000;

export function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % slides.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(next, INTERVAL);
    return () => clearInterval(timer);
  }, [next, paused]);

  return (
    <>
      {/* ── Slides ── */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          overflow: "hidden",
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {slides.map((s, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${s.src})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: i === current ? 1 : 0,
              transition: "opacity 1.1s ease",
              willChange: "opacity",
            }}
          >
            {/* Dark gradient overlay — ensures text above is always legible */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to bottom, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.52) 50%, rgba(0,0,0,0.72) 100%)",
              }}
            />
          </div>
        ))}
      </div>

      {/* ── Dot indicators ── */}
      <div
        style={{
          position: "absolute",
          bottom: "28px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: "8px",
          zIndex: 2,
        }}
      >
        {slides.map((s, i) => (
          <button
            key={i}
            aria-label={s.label}
            onClick={() => setCurrent(i)}
            style={{
              width: i === current ? "24px" : "7px",
              height: "7px",
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
              padding: 0,
              background:
                i === current ? "#FF6B1A" : "rgba(255,255,255,0.50)",
              transition: "width 0.3s ease, background 0.3s ease",
            }}
          />
        ))}
      </div>
    </>
  );
}
