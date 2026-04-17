"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * LampContainer — ProMarca edition.
 *
 * Key structural insight vs. the original (min-h-screen):
 * The original uses flex-justify-center + big negative translate-y on
 * content, which leaves a large black void below. For a compact hero we
 * instead:
 *   1. Size the container to fit content via padding (no min-h-screen).
 *   2. Put ALL beam / glow / ceiling elements inside an absolute overlay
 *      that has ITS OWN overflow-hidden — so they clip inside cleanly.
 *   3. Content sits in normal flow with padding, so the container
 *      auto-sizes and there is zero wasted space below.
 *
 * The beam elements are positioned relative to the center of the
 * absolute overlay (which equals the container center), so the math
 * from the original still holds.
 */
export const LampContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const BG = "#070707";

  return (
    <div
      className={cn("relative w-full z-0", className)}
      style={{ background: BG }}
    >
      {/* ══════════════════════════════════════════════
          Beam overlay — position:absolute, own overflow-hidden
          Beam elements are centered relative to THIS div's height,
          which matches the container height (inset:0).
      ══════════════════════════════════════════════ */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        {/* scale-y-125 stretches beams vertically — same as original */}
        <div className="relative flex w-full h-full scale-y-125 items-center justify-center isolate z-0">

          {/* ── LEFT beam ── */}
          <motion.div
            initial={{ opacity: 0.5, width: "15rem" }}
            whileInView={{ opacity: 1, width: "30rem" }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-auto right-1/2 h-56 overflow-visible w-[30rem]"
            style={{
              backgroundImage:
                "conic-gradient(from 70deg at center top, #FF6B1A, transparent, transparent)",
            }}
          >
            <div
              className="absolute w-full left-0 h-40 bottom-0 z-20"
              style={{
                background: BG,
                maskImage: "linear-gradient(to top, white, transparent)",
                WebkitMaskImage: "linear-gradient(to top, white, transparent)",
              }}
            />
            <div
              className="absolute w-40 h-full left-0 bottom-0 z-20"
              style={{
                background: BG,
                maskImage: "linear-gradient(to right, white, transparent)",
                WebkitMaskImage: "linear-gradient(to right, white, transparent)",
              }}
            />
          </motion.div>

          {/* ── RIGHT beam ── */}
          <motion.div
            initial={{ opacity: 0.5, width: "15rem" }}
            whileInView={{ opacity: 1, width: "30rem" }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-auto left-1/2 h-56 w-[30rem]"
            style={{
              backgroundImage:
                "conic-gradient(from 290deg at center top, transparent, transparent, #FF6B1A)",
            }}
          >
            <div
              className="absolute w-40 h-full right-0 bottom-0 z-20"
              style={{
                background: BG,
                maskImage: "linear-gradient(to left, white, transparent)",
                WebkitMaskImage: "linear-gradient(to left, white, transparent)",
              }}
            />
            <div
              className="absolute w-full right-0 h-40 bottom-0 z-20"
              style={{
                background: BG,
                maskImage: "linear-gradient(to top, white, transparent)",
                WebkitMaskImage: "linear-gradient(to top, white, transparent)",
              }}
            />
          </motion.div>

          {/* Dark blur eats beam tails at bottom */}
          <div
            className="absolute top-1/2 h-48 w-full translate-y-12 scale-x-150 blur-2xl"
            style={{ background: BG }}
          />

          {/* Subtle backdrop blur layer */}
          <div className="absolute top-1/2 z-50 h-48 w-full bg-transparent opacity-10 backdrop-blur-md" />

          {/* Wide ambient glow */}
          <div
            className="absolute inset-auto z-50 h-36 w-[28rem] -translate-y-1/2 rounded-full opacity-50 blur-3xl"
            style={{ background: "#FF6B1A" }}
          />

          {/* Tight inner glow */}
          <motion.div
            initial={{ width: "8rem" }}
            whileInView={{ width: "16rem" }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-auto z-30 h-36 w-64 -translate-y-[6rem] rounded-full blur-2xl"
            style={{ background: "#FF8C42" }}
          />

          {/* Filament — the glowing horizontal bar */}
          <motion.div
            initial={{ width: "15rem" }}
            whileInView={{ width: "30rem" }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-auto z-50 h-0.5 w-[30rem] -translate-y-[7rem]"
            style={{ background: "#FFB068" }}
          />

          {/* Hard dark ceiling — hides lamp origin, creates crisp top edge */}
          <div
            className="absolute inset-auto z-40 h-44 w-full -translate-y-[12.5rem]"
            style={{ background: BG }}
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          Content — normal flow, just padding.
          Container height = this div's height = no wasted space.
      ══════════════════════════════════════════════ */}
      <div
        className="relative z-50 flex flex-col items-center w-full"
        style={{ padding: "64px 20px 56px" }}
      >
        {children}
      </div>
    </div>
  );
};
