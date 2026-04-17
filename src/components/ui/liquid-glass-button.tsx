"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ─── SVG distortion filter (rendered once, shared via id) ─── */
export function LiquidGlassFilter({ id = "liquid-glass-filter" }: { id?: string }) {
  return (
    <svg
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
      aria-hidden="true"
    >
      <defs>
        <filter id={id} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65 0.75"
            numOctaves="3"
            seed="2"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="4"
            xChannelSelector="R"
            yChannelSelector="G"
            result="displaced"
          />
          <feComposite in="displaced" in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}

/* ─── CVA variants ─── */
export const liquidbuttonVariants = cva(
  // base
  [
    "relative inline-flex items-center justify-center",
    "rounded-full",
    "select-none cursor-pointer",
    "transition-all duration-200",
    "overflow-hidden",
  ].join(" "),
  {
    variants: {
      variant: {
        glass: "",
        orange: "",
        metal: "",
      },
      size: {
        sm:  "px-3 py-1 text-xs font-semibold",
        md:  "px-4 py-1.5 text-sm font-semibold",
        lg:  "px-5 py-2 text-base font-semibold",
      },
    },
    defaultVariants: {
      variant: "glass",
      size: "md",
    },
  }
);

/* ─── Inline style maps per variant ─── */
const variantStyles: Record<string, React.CSSProperties> = {
  glass: {
    background: "rgba(255,107,26,0.55)",
    backdropFilter: "blur(14px) saturate(200%)",
    WebkitBackdropFilter: "blur(14px) saturate(200%)",
    border: "1px solid rgba(255,140,60,0.55)",
    boxShadow:
      "0 2px 16px rgba(255,107,26,0.30), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.12)",
    color: "#ffffff",
    filter: "url(#liquid-glass-filter)",
  },
  orange: {
    background: "rgba(255,107,26,0.70)",
    backdropFilter: "blur(14px) saturate(200%)",
    WebkitBackdropFilter: "blur(14px) saturate(200%)",
    border: "1px solid rgba(255,150,70,0.65)",
    boxShadow:
      "0 2px 16px rgba(255,107,26,0.40), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.12)",
    color: "#ffffff",
    filter: "url(#liquid-glass-filter)",
  },
  metal: {
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.18) 100%)",
    backdropFilter: "blur(8px) saturate(160%)",
    WebkitBackdropFilter: "blur(8px) saturate(160%)",
    border: "1px solid rgba(255,255,255,0.20)",
    boxShadow:
      "0 1px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.40)",
    color: "#ffffff",
    filter: "url(#liquid-glass-filter)",
  },
};

/* ─── Main component ─── */
export interface LiquidButtonProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof liquidbuttonVariants> {
  asChild?: boolean;
  filterRef?: string;
}

export const LiquidButton = React.forwardRef<HTMLSpanElement, LiquidButtonProps>(
  (
    {
      className,
      variant = "glass",
      size = "md",
      filterRef = "liquid-glass-filter",
      style,
      children,
      ...props
    },
    ref
  ) => {
    const vStyle = variantStyles[variant ?? "glass"] ?? variantStyles.glass;

    return (
      <span
        ref={ref}
        className={cn(liquidbuttonVariants({ variant, size, className }))}
        style={{
          ...vStyle,
          filter: `url(#${filterRef})`,
          ...style,
        }}
        {...props}
      >
        {/* Specular highlight */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 60%)",
            pointerEvents: "none",
          }}
        />
        {/* Content */}
        <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
      </span>
    );
  }
);

LiquidButton.displayName = "LiquidButton";

/* ─── MetalButton shorthand ─── */
export const MetalButton = React.forwardRef<
  HTMLSpanElement,
  Omit<LiquidButtonProps, "variant">
>((props, ref) => <LiquidButton ref={ref} variant="metal" {...props} />);
MetalButton.displayName = "MetalButton";

/* ─── Button (drop-in alias for shadcn compat) ─── */
export { LiquidButton as Button };
export const buttonVariants = liquidbuttonVariants;
