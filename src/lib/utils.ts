import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a number as Colombian Peso currency.
 * Ej: 45000 → "$45.000"
 */
export function formatCOP(n: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(n);
}

/**
 * Formats an ISO date string for display in Colombian locale.
 * Ej: "2026-04-23T..." → "23 abr. 2026"
 */
export function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
