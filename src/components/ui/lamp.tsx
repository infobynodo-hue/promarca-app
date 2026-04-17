"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * LampContainer — ProMarca edition
 * Orange glow instead of cyan, scalable height via className.
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
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden w-full z-0",
        // Default height for catalog hero — override via className if needed
        "min-h-[420px]",
        className
      )}
      style={{ background: "#0a0a0a" }}
    >
      {/* ── Light beams ── */}
      <div className="relative flex w-full flex-1 scale-y-125 items-center justify-center isolate z-0">

        {/* Left beam */}
        <motion.div
          initial={{ opacity: 0.5, width: "12rem" }}
          whileInView={{ opacity: 1, width: "26rem" }}
          transition={{ delay: 0.2, duration: 0.9, ease: "easeInOut" }}
          style={{
            backgroundImage:
              "conic-gradient(from 70deg at center top, #FF6B1A, transparent, transparent)",
          }}
          className="absolute inset-auto right-1/2 h-48 overflow-visible w-[26rem]"
        >
          <div
            className="absolute w-full left-0 h-36 bottom-0 z-20"
            style={{
              background: "#0a0a0a",
              maskImage: "linear-gradient(to top, white, transparent)",
              WebkitMaskImage: "linear-gradient(to top, white, transparent)",
            }}
          />
          <div
            className="absolute w-36 h-full left-0 bottom-0 z-20"
            style={{
              background: "#0a0a0a",
              maskImage: "linear-gradient(to right, white, transparent)",
              WebkitMaskImage: "linear-gradient(to right, white, transparent)",
            }}
          />
        </motion.div>

        {/* Right beam */}
        <motion.div
          initial={{ opacity: 0.5, width: "12rem" }}
          whileInView={{ opacity: 1, width: "26rem" }}
          transition={{ delay: 0.2, duration: 0.9, ease: "easeInOut" }}
          style={{
            backgroundImage:
              "conic-gradient(from 290deg at center top, transparent, transparent, #FF6B1A)",
          }}
          className="absolute inset-auto left-1/2 h-48 w-[26rem]"
        >
          <div
            className="absolute w-36 h-full right-0 bottom-0 z-20"
            style={{
              background: "#0a0a0a",
              maskImage: "linear-gradient(to left, white, transparent)",
              WebkitMaskImage: "linear-gradient(to left, white, transparent)",
            }}
          />
          <div
            className="absolute w-full right-0 h-36 bottom-0 z-20"
            style={{
              background: "#0a0a0a",
              maskImage: "linear-gradient(to top, white, transparent)",
              WebkitMaskImage: "linear-gradient(to top, white, transparent)",
            }}
          />
        </motion.div>

        {/* Dark overlay to blend beams into bg */}
        <div
          className="absolute top-1/2 h-40 w-full translate-y-10 scale-x-150 blur-2xl"
          style={{ background: "#0a0a0a" }}
        />

        {/* Outer wide glow */}
        <div
          className="absolute inset-auto z-50 h-32 w-[28rem] -translate-y-1/2 rounded-full opacity-40 blur-3xl"
          style={{ background: "#FF6B1A" }}
        />

        {/* Inner tight glow */}
        <motion.div
          initial={{ width: "6rem" }}
          whileInView={{ width: "14rem" }}
          transition={{ delay: 0.2, duration: 0.9, ease: "easeInOut" }}
          className="absolute inset-auto z-30 h-28 -translate-y-[5rem] rounded-full blur-2xl"
          style={{ background: "#FF8C42" }}
        />

        {/* Horizontal light bar */}
        <motion.div
          initial={{ width: "12rem" }}
          whileInView={{ width: "26rem" }}
          transition={{ delay: 0.2, duration: 0.9, ease: "easeInOut" }}
          className="absolute inset-auto z-50 h-0.5 -translate-y-[6rem]"
          style={{ background: "#FFB380" }}
        />

        {/* Bottom dark cutoff */}
        <div
          className="absolute inset-auto z-40 h-40 w-full -translate-y-[11rem]"
          style={{ background: "#0a0a0a" }}
        />
      </div>

      {/* ── Content slot — sits in the lamp glow zone ── */}
      <div className="relative z-50 flex -translate-y-52 flex-col items-center px-5 w-full">
        {children}
      </div>
    </div>
  );
};
