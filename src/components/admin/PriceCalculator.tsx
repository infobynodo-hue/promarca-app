"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calculator, ChevronDown, ChevronUp, Check } from "lucide-react";

interface Props {
  onApply: (price: number) => void;
  currentPrice?: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(Math.round(n));

export function PriceCalculator({ onApply, currentPrice }: Props) {
  const [open, setOpen] = useState(false);
  const [providerPrice, setProviderPrice] = useState("");
  const [discountPct, setDiscountPct] = useState(52);
  const [marginPct, setMarginPct] = useState(40);
  const [ivaPct] = useState(19);
  const [applied, setApplied] = useState(false);

  const provider = parseFloat(providerPrice.replace(/\./g, "").replace(",", ".")) || 0;
  const cost         = provider * (1 - discountPct / 100);
  const margin       = cost * (marginPct / 100);
  const subtotal     = cost + margin;
  const iva          = subtotal * (ivaPct / 100);
  const finalPrice   = subtotal + iva;

  const hasResult = provider > 0;

  const handleApply = () => {
    if (!hasResult) return;
    onApply(Math.round(finalPrice));
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-orange-500" />
          Calculadora de precio
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-zinc-200 pt-4">
          {/* Provider price input */}
          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1.5 block">
              Precio del proveedor (lo que aparece en su página)
            </label>
            <Input
              value={providerPrice}
              onChange={(e) => {
                setProviderPrice(e.target.value);
                setApplied(false);
              }}
              placeholder="Ej: 150000"
              className="text-base font-semibold"
              autoFocus
            />
          </div>

          {/* Adjustable percentages */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">
                Tu descuento como distribuidor (%)
              </label>
              <Input
                type="number"
                value={discountPct}
                onChange={(e) => setDiscountPct(parseFloat(e.target.value) || 0)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">
                Tu margen de ganancia (%)
              </label>
              <Input
                type="number"
                value={marginPct}
                onChange={(e) => setMarginPct(parseFloat(e.target.value) || 0)}
                className="text-sm"
              />
            </div>
          </div>

          {/* Breakdown card */}
          {hasResult && (
            <div className="rounded-lg border border-zinc-200 bg-white divide-y divide-zinc-100 text-sm overflow-hidden">
              <div className="flex justify-between px-4 py-2.5 text-zinc-500">
                <span>Precio del proveedor</span>
                <span className="font-medium text-zinc-700">{fmt(provider)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5 text-zinc-500">
                <span>Menos tu descuento de distribuidor ({discountPct}%)</span>
                <span className="font-medium text-red-500">− {fmt(provider - cost)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5 bg-zinc-50 font-medium text-zinc-700">
                <span>Lo que te cuesta a ti</span>
                <span>{fmt(cost)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5 text-zinc-500">
                <span>Tu ganancia ({marginPct}% sobre tu costo)</span>
                <span className="font-medium text-green-600">+ {fmt(margin)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5 text-zinc-500">
                <span>IVA ({ivaPct}%)</span>
                <span className="font-medium text-zinc-600">+ {fmt(iva)}</span>
              </div>
              <div className="flex justify-between px-4 py-3 bg-orange-50 border-t-2 border-orange-200">
                <span className="font-bold text-zinc-800">Precio final al cliente</span>
                <span className="text-lg font-black text-orange-600">{fmt(finalPrice)}</span>
              </div>
            </div>
          )}

          {/* Apply button */}
          {hasResult && (
            <Button
              type="button"
              onClick={handleApply}
              className={`w-full gap-2 transition-all ${
                applied
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-orange-500 hover:bg-orange-600"
              }`}
            >
              {applied ? (
                <><Check className="h-4 w-4" /> Precio aplicado — {fmt(finalPrice)}</>
              ) : (
                <><Calculator className="h-4 w-4" /> Aplicar {fmt(finalPrice)} como precio del producto</>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
