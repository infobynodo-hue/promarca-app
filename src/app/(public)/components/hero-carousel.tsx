"use client";

import { useEffect, useState } from "react";

const slides = [
  { bg: "#2a1a0e" },
  { bg: "#0d1a2a" },
  { bg: "#1a0d2a" },
  { bg: "#0d2a1a" },
  { bg: "#2a1a0d" },
];

export function HeroCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <div className="hero-carousel" aria-hidden="true">
        {slides.map((s, i) => (
          <div
            key={i}
            className={`slide${i === current ? " active" : ""}`}
            style={{ backgroundColor: s.bg }}
          />
        ))}
      </div>
      <div className="carousel-dots">
        {slides.map((_, i) => (
          <button
            key={i}
            className={`dot${i === current ? " active" : ""}`}
            aria-label={`Slide ${i + 1}`}
            onClick={() => setCurrent(i)}
          />
        ))}
      </div>
    </>
  );
}
