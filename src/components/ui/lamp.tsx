"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * LampContainer — ProMarca edition
 * Faithful port of the Aceternity lamp, orange-branded, fixed height.
 */
export const LampContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn("relative w-full", className)}
      style={{
        background: "#080808",
        /* Clip only the decorative beams, NOT the text */
        isolation: "isolate",
      }}
    >
      {/* ── Lamp beams (overflow clipped to this inner div only) ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        {/* scale-y-125 stretches beams vertically, same as original */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: "scaleY(1.25)",
            transformOrigin: "center",
          }}
        >
          {/* ── LEFT beam ── */}
          <motion.div
            initial={{ opacity: 0.5, width: "10rem" }}
            whileInView={{ opacity: 1, width: "28rem" }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, duration: 0.9, ease: "easeInOut" }}
            style={{
              position: "absolute",
              right: "50%",
              height: "14rem",
              backgroundImage:
                "conic-gradient(from 70deg at center top, #FF6B1A, transparent, transparent)",
              overflow: "visible",
            }}
          >
            {/* bottom fade */}
            <div
              style={{
                position: "absolute",
                width: "100%",
                left: 0,
                height: "10rem",
                bottom: 0,
                background: "#080808",
                maskImage: "linear-gradient(to top, white, transparent)",
                WebkitMaskImage: "linear-gradient(to top, white, transparent)",
              }}
            />
            {/* left fade */}
            <div
              style={{
                position: "absolute",
                width: "8rem",
                height: "100%",
                left: 0,
                bottom: 0,
                background: "#080808",
                maskImage: "linear-gradient(to right, white, transparent)",
                WebkitMaskImage: "linear-gradient(to right, white, transparent)",
              }}
            />
          </motion.div>

          {/* ── RIGHT beam ── */}
          <motion.div
            initial={{ opacity: 0.5, width: "10rem" }}
            whileInView={{ opacity: 1, width: "28rem" }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, duration: 0.9, ease: "easeInOut" }}
            style={{
              position: "absolute",
              left: "50%",
              height: "14rem",
              backgroundImage:
                "conic-gradient(from 290deg at center top, transparent, transparent, #FF6B1A)",
              overflow: "visible",
            }}
          >
            {/* right fade */}
            <div
              style={{
                position: "absolute",
                width: "8rem",
                height: "100%",
                right: 0,
                bottom: 0,
                background: "#080808",
                maskImage: "linear-gradient(to left, white, transparent)",
                WebkitMaskImage: "linear-gradient(to left, white, transparent)",
              }}
            />
            {/* bottom fade */}
            <div
              style={{
                position: "absolute",
                width: "100%",
                right: 0,
                height: "10rem",
                bottom: 0,
                background: "#080808",
                maskImage: "linear-gradient(to top, white, transparent)",
                WebkitMaskImage: "linear-gradient(to top, white, transparent)",
              }}
            />
          </motion.div>

          {/* Dark blur that eats the bottom of the beams */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              height: "12rem",
              width: "100%",
              transform: "translateY(3rem) scaleX(1.5)",
              background: "#080808",
              filter: "blur(24px)",
            }}
          />

          {/* Wide ambient glow at center */}
          <div
            style={{
              position: "absolute",
              height: "9rem",
              width: "28rem",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              borderRadius: "9999px",
              background: "#FF6B1A",
              opacity: 0.45,
              filter: "blur(48px)",
              zIndex: 50,
            }}
          />

          {/* Tight inner glow — the "bulb" */}
          <motion.div
            initial={{ width: "5rem" }}
            whileInView={{ width: "12rem" }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, duration: 0.9, ease: "easeInOut" }}
            style={{
              position: "absolute",
              height: "9rem",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, calc(-50% - 5.5rem))",
              borderRadius: "9999px",
              background: "#FF9450",
              filter: "blur(20px)",
              zIndex: 30,
            }}
          />

          {/* Filament — the horizontal bar */}
          <motion.div
            initial={{ width: "10rem" }}
            whileInView={{ width: "28rem" }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, duration: 0.9, ease: "easeInOut" }}
            style={{
              position: "absolute",
              height: "2px",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, calc(-50% - 7rem))",
              background: "linear-gradient(to right, transparent, #FFB380, #FFD4B3, #FFB380, transparent)",
              zIndex: 50,
              borderRadius: 9999,
            }}
          />

          {/* Hard cutoff below the lamp — creates the "ceiling" line */}
          <div
            style={{
              position: "absolute",
              height: "11rem",
              width: "100%",
              top: "50%",
              transform: "translateY(-12.5rem)",
              background: "#080808",
              zIndex: 40,
            }}
          />
        </div>
      </div>

      {/* ── Content — rendered OVER the beams, no overflow clipping ── */}
      <div
        style={{
          position: "relative",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "56px 20px 52px",
        }}
      >
        {children}
      </div>
    </div>
  );
};
