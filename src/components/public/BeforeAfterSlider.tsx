"use client";

import * as React from "react";

interface BeforeAfterSliderProps {
  /** Producto SIN marcar (lado izquierdo) */
  beforeImage: string;
  /** Producto marcado con logo (lado derecho) */
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export function BeforeAfterSlider({
  beforeImage,
  afterImage,
  beforeLabel = "Sin logo",
  afterLabel = "Con tu logo",
}: BeforeAfterSliderProps) {
  const [position, setPosition] = React.useState(50);
  const [dragging, setDragging] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const move = React.useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const { left, width } = containerRef.current.getBoundingClientRect();
    const pct = Math.min(Math.max(((clientX - left) / width) * 100, 2), 98);
    setPosition(pct);
  }, []);

  const onMouseMove = React.useCallback(
    (e: MouseEvent) => { if (dragging) move(e.clientX); },
    [dragging, move]
  );
  const onTouchMove = React.useCallback(
    (e: TouchEvent) => { if (dragging && e.touches[0]) move(e.touches[0].clientX); },
    [dragging, move]
  );
  const stopDrag = React.useCallback(() => setDragging(false), []);

  React.useEffect(() => {
    if (!dragging) return;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", stopDrag);
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", stopDrag);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", stopDrag);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", stopDrag);
    };
  }, [dragging, onMouseMove, onTouchMove, stopDrag]);

  return (
    <div
      ref={containerRef}
      onMouseDown={() => setDragging(true)}
      onTouchStart={() => setDragging(true)}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "4/3",
        borderRadius: 20,
        overflow: "hidden",
        cursor: "ew-resize",
        userSelect: "none",
        background: "#1a1a1a",
        boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
      }}
    >
      {/* ── AFTER image (right / full) ── */}
      <div style={{ position: "absolute", inset: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={afterImage}
          alt={afterLabel}
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        {/* Label */}
        <span
          style={{
            position: "absolute",
            bottom: 14,
            right: 14,
            padding: "5px 12px",
            borderRadius: 9999,
            fontSize: 12,
            fontWeight: 700,
            color: "#fff",
            background: "rgba(255,107,26,0.82)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,140,60,0.50)",
            boxShadow: "0 2px 10px rgba(255,107,26,0.30)",
            textShadow: "0 1px 3px rgba(0,0,0,0.25)",
            letterSpacing: "0.02em",
            pointerEvents: "none",
          }}
        >
          {afterLabel}
        </span>
      </div>

      {/* ── BEFORE image (left / clipped) ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: `inset(0 ${100 - position}% 0 0)`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeImage}
          alt={beforeLabel}
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        {/* Label */}
        <span
          style={{
            position: "absolute",
            bottom: 14,
            left: 14,
            padding: "5px 12px",
            borderRadius: 9999,
            fontSize: 12,
            fontWeight: 700,
            color: "#18181b",
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(0,0,0,0.10)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            letterSpacing: "0.02em",
            pointerEvents: "none",
          }}
        >
          {beforeLabel}
        </span>
      </div>

      {/* ── Divider line ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${position}%`,
          width: 2,
          transform: "translateX(-50%)",
          background: "rgba(255,255,255,0.85)",
          boxShadow: "0 0 12px rgba(255,255,255,0.50)",
          zIndex: 10,
          pointerEvents: "none",
        }}
      />

      {/* ── Handle circle ── */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: `${position}%`,
          transform: "translate(-50%, -50%)",
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "#ffffff",
          boxShadow: "0 2px 16px rgba(0,0,0,0.28), 0 0 0 3px rgba(255,107,26,0.35)",
          zIndex: 11,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          cursor: "ew-resize",
          pointerEvents: "none",
        }}
      >
        {/* Left arrow */}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FF6B1A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        {/* Right arrow */}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FF6B1A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </div>
  );
}
