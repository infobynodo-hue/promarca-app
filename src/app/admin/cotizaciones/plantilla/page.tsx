"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Save,
  RefreshCw,
  ExternalLink,
  BookMarked,
  CheckCircle2,
  Trash2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Settings {
  quote_company_name: string;
  quote_company_tagline: string;
  quote_company_email: string;
  quote_company_phone: string;
  quote_company_nit: string;
  quote_primary_color: string;
  quote_conditions: string;
  quote_payment_terms: string;
  quote_footer_extra: string;
  quote_contact_name: string;
  quote_contact_title: string;
  quote_instagram: string;
  quote_website: string;
}

interface SavedTemplate {
  id: string;
  name: string;
  settings: Settings;
  is_default: boolean;
  created_at: string;
}

const DEFAULTS: Settings = {
  quote_company_name: "ProMarca",
  quote_company_tagline: "Productos Promocionales",
  quote_company_email: "promarcapop@gmail.com",
  quote_company_phone: "302 521 2938 - 311 5096743",
  quote_company_nit: "XXX.XXX.XXX-X",
  quote_primary_color: "#FF6B1A",
  quote_conditions: "Si desea el servicio personalizado con su marca requerimos el logo editable que va brandeado en el producto respectivo.",
  quote_payment_terms: "Pago Anticipado. El costo del envío varía según la ciudad destino, descrito en la cotización.",
  quote_footer_extra: "",
  quote_contact_name: "Sthefany Ahumada",
  quote_contact_title: "Publicista y Estratega de Marketing",
  quote_instagram: "pro__marca",
  quote_website: "promarca.co",
};

// ── Sample quote data for preview ──────────────────────────────────────────
const SAMPLE = {
  quote_number: "COT-2025-0042",
  created_at: new Date().toISOString(),
  valid_until: new Date(Date.now() + 15 * 86400000).toISOString(),
  subtotal: 3500000,
  discount_percent: 10,
  iva_percent: 19,
  notes: "Incluye entrega en Bogotá. Diseño aprobado por el cliente.",
  client: {
    name: "Laura Gómez",
    company: "Café La Sierra S.A.S.",
    nit: "900.123.456-1",
    email: "laura@cafelasiera.co",
    phone: "+57 310 456 7890",
    address: "Calle 93 # 15-47",
    city: "Bogotá",
  },
  items: [
    {
      product_reference: "TM-2201",
      product_name: "Termo Acero Inox 500ml",
      quantity: 100,
      unit_price: 18000,
      marking_type: "Grabado láser",
      marking_price: 3500,
      line_total: 2150000,
    },
    {
      product_reference: "MU-105",
      product_name: "Mugs Cerámicos Blancos 11oz",
      quantity: 50,
      unit_price: 12000,
      marking_type: "Sublimación",
      marking_price: 4000,
      line_total: 800000,
    },
    {
      product_reference: "LA-320",
      product_name: "Lapicero Metálico Premium",
      quantity: 200,
      unit_price: 2750,
      marking_type: "1 tinta",
      marking_price: 500,
      line_total: 550000,
    },
  ],
};

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(n);
}

function buildPreviewHTML(s: Settings): string {
  const primary = s.quote_primary_color;
  const discountAmount = Math.round(SAMPLE.subtotal * (SAMPLE.discount_percent / 100));
  const baseAfterDiscount = SAMPLE.subtotal - discountAmount;
  const ivaAmount = Math.round(baseAfterDiscount * (SAMPLE.iva_percent / 100));
  const total = baseAfterDiscount + ivaAmount;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1d1d1f; padding: 40px; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .logo { font-size: 24px; font-weight: 700; }
  .logo span { color: ${primary}; }
  .quote-info { text-align: right; }
  .quote-number { font-size: 18px; font-weight: 700; color: ${primary}; }
  .client-box { background: #f5f5f7; border-radius: 8px; padding: 20px; margin-bottom: 30px; }
  .client-box h3 { font-size: 11px; text-transform: uppercase; color: #6e6e73; margin-bottom: 8px; letter-spacing: 0.05em; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  th { background: #1d1d1f; color: white; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; }
  td { padding: 10px 12px; border-bottom: 1px solid #e5e5e7; }
  .text-right { text-align: right; }
  .summary { float: right; width: 280px; }
  .summary-row { display: flex; justify-content: space-between; padding: 6px 0; }
  .summary-total { font-size: 18px; font-weight: 700; border-top: 2px solid #1d1d1f; padding-top: 10px; margin-top: 6px; }
  .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e5e5e7; font-size: 10px; color: #6e6e73; }
  .notes { background: #FFFBF5; border: 1px solid #FFE0C0; border-radius: 8px; padding: 16px; margin-bottom: 30px; }
  .sample-badge { display:inline-block; background:#f5f5f7; border-radius:4px; padding:2px 8px; font-size:10px; color:#6e6e73; margin-top:6px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo"><span>${s.quote_company_name.slice(0, 3)}</span>${s.quote_company_name.slice(3)}</div>
      <p style="color:#6e6e73; margin-top:4px;">${s.quote_company_tagline}</p>
      <p style="color:#6e6e73;">${s.quote_company_email} | ${s.quote_company_phone}</p>
    </div>
    <div class="quote-info">
      <div class="quote-number">${SAMPLE.quote_number}</div>
      <p style="color:#6e6e73;">Fecha: ${new Date(SAMPLE.created_at).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}</p>
      <p style="color:#6e6e73;">Válida hasta: ${new Date(SAMPLE.valid_until).toLocaleDateString("es-CO")}</p>
      <span class="sample-badge">Vista previa — datos de ejemplo</span>
    </div>
  </div>
  <div class="client-box">
    <h3>Datos del cliente</h3>
    <p><strong>${SAMPLE.client.name}</strong></p>
    <p>${SAMPLE.client.company}</p>
    <p>NIT: ${SAMPLE.client.nit}</p>
    <p>${SAMPLE.client.email}</p>
    <p>${SAMPLE.client.phone}</p>
    <p>${SAMPLE.client.address}, ${SAMPLE.client.city}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Ref.</th><th>Producto</th><th>Cant.</th><th>Precio Unit.</th><th>Marcado</th><th class="text-right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${SAMPLE.items.map((item) => `
      <tr>
        <td><strong>${item.product_reference}</strong></td>
        <td>${item.product_name}</td>
        <td>${item.quantity}</td>
        <td>${formatCOP(item.unit_price)}</td>
        <td>${item.marking_type}${item.marking_price > 0 ? ` (+${formatCOP(item.marking_price)}/u)` : ""}</td>
        <td class="text-right"><strong>${formatCOP(item.line_total)}</strong></td>
      </tr>`).join("")}
    </tbody>
  </table>
  <div class="notes"><strong>Notas:</strong> ${SAMPLE.notes}</div>
  <div class="summary">
    <div class="summary-row"><span>Subtotal</span><span>${formatCOP(SAMPLE.subtotal)}</span></div>
    <div class="summary-row"><span>Descuento (${SAMPLE.discount_percent}%)</span><span style="color:red">-${formatCOP(discountAmount)}</span></div>
    <div class="summary-row"><span>IVA (${SAMPLE.iva_percent}%)</span><span>${formatCOP(ivaAmount)}</span></div>
    <div class="summary-row summary-total"><span>TOTAL</span><span>${formatCOP(total)}</span></div>
  </div>
  <div style="clear:both;"></div>
  <div class="footer">
    <p><strong>Condiciones:</strong> ${s.quote_conditions}</p>
    <p style="margin-top:4px;"><strong>Pago:</strong> ${s.quote_payment_terms}</p>
    ${s.quote_footer_extra ? `<p style="margin-top:4px;">${s.quote_footer_extra}</p>` : ""}
    <p style="margin-top:8px;">${s.quote_company_name} — ${s.quote_company_tagline} | NIT: ${s.quote_company_nit}</p>
  </div>
</body>
</html>`;
}

export default function PlantillaPage() {
  const supabase = createClient();
  const [settings, setSettings] = useState<Settings>({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [firstQuoteId, setFirstQuoteId] = useState<string | null>(null);

  // Saved templates
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("quote_templates")
      .select("*")
      .order("created_at", { ascending: false });
    setTemplates(data ?? []);
  };

  // Fetch settings + templates + first quote
  useEffect(() => {
    const load = async () => {
      const [settingsRes, quotesRes] = await Promise.all([
        supabase.from("app_settings").select("key, value"),
        supabase.from("quotes").select("id").order("created_at", { ascending: false }).limit(1),
      ]);

      const merged = { ...DEFAULTS };
      for (const { key, value } of settingsRes.data ?? []) {
        if (value !== null && key in merged) {
          (merged as any)[key] = value;
        }
      }
      setSettings(merged);
      setFirstQuoteId(quotesRes.data?.[0]?.id ?? null);
      setLoading(false);
    };
    load();
    fetchTemplates();
  }, []);

  // Regenerate preview whenever settings change
  useEffect(() => {
    if (!loading) {
      setPreviewHtml(buildPreviewHTML(settings));
    }
  }, [settings, loading]);

  // Save current settings to app_settings (active template)
  const handleSave = async () => {
    setSaving(true);
    const entries = Object.entries(settings) as [string, string][];
    const upsertData = entries.map(([key, value]) => ({ key, value }));

    const { error } = await supabase
      .from("app_settings")
      .upsert(upsertData, { onConflict: "key" });

    if (error) {
      toast.error("Error al guardar: " + error.message);
    } else {
      toast.success("Plantilla guardada correctamente");
    }
    setSaving(false);
  };

  // Save current settings as a named template in history
  const handleSaveAsTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error("Escribe un nombre para la plantilla");
      return;
    }
    setSavingTemplate(true);

    // Mark all others as non-default, this one as default
    await supabase.from("quote_templates").update({ is_default: false }).neq("id", "00000000-0000-0000-0000-000000000000");

    const { error } = await supabase.from("quote_templates").insert({
      name: newTemplateName.trim(),
      settings,
      is_default: true,
    });

    if (error) {
      toast.error("Error: " + error.message);
    } else {
      toast.success(`Plantilla "${newTemplateName}" guardada`);
      setSaveDialogOpen(false);
      setNewTemplateName("");
      fetchTemplates();
      // Also save to app_settings
      await handleSave();
    }
    setSavingTemplate(false);
  };

  // Activate a saved template (load its settings + save as active)
  const handleActivateTemplate = async (tpl: SavedTemplate) => {
    setSettings(tpl.settings);

    // Update is_default flags
    await supabase.from("quote_templates").update({ is_default: false }).neq("id", tpl.id);
    await supabase.from("quote_templates").update({ is_default: true }).eq("id", tpl.id);

    // Save settings to app_settings
    const entries = Object.entries(tpl.settings) as [string, string][];
    await supabase
      .from("app_settings")
      .upsert(entries.map(([key, value]) => ({ key, value })), { onConflict: "key" });

    toast.success(`Plantilla "${tpl.name}" activada`);
    fetchTemplates();
  };

  const handleDeleteTemplate = async (tpl: SavedTemplate) => {
    if (!confirm(`¿Eliminar la plantilla "${tpl.name}"?`)) return;
    await supabase.from("quote_templates").delete().eq("id", tpl.id);
    toast.success("Plantilla eliminada");
    fetchTemplates();
  };

  const set = (key: keyof Settings, value: string) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  if (loading) return <p className="text-zinc-500">Cargando...</p>;

  return (
    <div className="flex flex-col gap-0">
      {/* ── Header ── */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/cotizaciones">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Plantilla de cotización</h1>
          <p className="text-sm text-zinc-500">
            Personaliza el diseño y texto · los cambios aplican a todas las cotizaciones nuevas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {firstQuoteId && (
            <a href={`/api/quotes/${firstQuoteId}/pdf`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-1.5 h-4 w-4" />
                Ver PDF real
              </Button>
            </a>
          )}
          <Button variant="outline" onClick={() => setSaveDialogOpen(true)}>
            <BookMarked className="mr-2 h-4 w-4" />
            Guardar como plantilla
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Guardando..." : "Aplicar cambios"}
          </Button>
        </div>
      </div>

      {/* ── Three-column layout ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr_260px]">

        {/* ── LEFT: Editor ── */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Datos de la empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Nombre de la empresa</Label>
                <Input value={settings.quote_company_name} onChange={(e) => set("quote_company_name", e.target.value)} placeholder="ProMarca" />
              </div>
              <div>
                <Label className="text-xs">Tagline / Subtítulo</Label>
                <Input value={settings.quote_company_tagline} onChange={(e) => set("quote_company_tagline", e.target.value)} placeholder="Productos Promocionales" />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input value={settings.quote_company_email} onChange={(e) => set("quote_company_email", e.target.value)} type="email" />
              </div>
              <div>
                <Label className="text-xs">Teléfono</Label>
                <Input value={settings.quote_company_phone} onChange={(e) => set("quote_company_phone", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">NIT</Label>
                <Input value={settings.quote_company_nit} onChange={(e) => set("quote_company_nit", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Nombre del asesor / contacto</Label>
                <Input value={settings.quote_contact_name} onChange={(e) => set("quote_contact_name", e.target.value)} placeholder="Sthefany Ahumada" />
              </div>
              <div>
                <Label className="text-xs">Cargo del asesor</Label>
                <Input value={settings.quote_contact_title} onChange={(e) => set("quote_contact_title", e.target.value)} placeholder="Publicista y Estratega de Marketing" />
              </div>
              <div>
                <Label className="text-xs">Instagram (sin @)</Label>
                <Input value={settings.quote_instagram} onChange={(e) => set("quote_instagram", e.target.value)} placeholder="pro__marca" />
              </div>
              <div>
                <Label className="text-xs">Sitio web</Label>
                <Input value={settings.quote_website} onChange={(e) => set("quote_website", e.target.value)} placeholder="promarca.co" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Color de marca
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.quote_primary_color}
                  onChange={(e) => set("quote_primary_color", e.target.value)}
                  className="h-10 w-16 cursor-pointer rounded border border-zinc-200 p-0.5"
                />
                <Input
                  value={settings.quote_primary_color}
                  onChange={(e) => set("quote_primary_color", e.target.value)}
                  placeholder="#FF6B1A"
                  className="font-mono text-sm"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-400">Aplica al número, logo y acentos del PDF</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Términos y pie de página
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Condiciones generales</Label>
                <Textarea value={settings.quote_conditions} onChange={(e) => set("quote_conditions", e.target.value)} rows={3} className="text-xs" />
              </div>
              <div>
                <Label className="text-xs">Términos de pago</Label>
                <Textarea value={settings.quote_payment_terms} onChange={(e) => set("quote_payment_terms", e.target.value)} rows={2} className="text-xs" />
              </div>
              <div>
                <Label className="text-xs">Texto adicional (opcional)</Label>
                <Textarea value={settings.quote_footer_extra} onChange={(e) => set("quote_footer_extra", e.target.value)} rows={2} className="text-xs" placeholder="Redes sociales, dirección, etc." />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── CENTER: Live preview ── */}
        <div className="flex flex-col">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-700">Vista previa en tiempo real</p>
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Se actualiza al escribir
            </span>
          </div>
          <div className="flex-1 rounded-xl border border-zinc-200 overflow-hidden bg-white shadow-sm" style={{ minHeight: "820px" }}>
            <iframe
              srcDoc={previewHtml}
              className="h-full w-full"
              style={{ minHeight: "820px", border: "none" }}
              title="Vista previa de plantilla"
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        {/* ── RIGHT: Saved templates ── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-700">Plantillas guardadas</p>
            <Button variant="ghost" size="sm" onClick={() => setSaveDialogOpen(true)} className="h-7 px-2">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {templates.length === 0 && (
            <div className="rounded-lg border-2 border-dashed border-zinc-200 p-6 text-center">
              <BookMarked className="h-6 w-6 text-zinc-300 mx-auto mb-2" />
              <p className="text-xs text-zinc-400">Guarda versiones de tu plantilla para reutilizarlas</p>
            </div>
          )}

          <div className="space-y-2">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className={`rounded-lg border p-3 transition-colors ${tpl.is_default ? "border-orange-300 bg-orange-50" : "border-zinc-200 bg-white hover:border-zinc-300"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-zinc-800 truncate">{tpl.name}</p>
                      {tpl.is_default && (
                        <Badge className="text-[10px] h-4 px-1.5 bg-orange-500 shrink-0">Activa</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {new Date(tpl.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    {/* Color swatch */}
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <div
                        className="h-3 w-3 rounded-full border border-zinc-200"
                        style={{ background: tpl.settings.quote_primary_color }}
                      />
                      <span className="text-[10px] font-mono text-zinc-400">{tpl.settings.quote_primary_color}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleDeleteTemplate(tpl)}
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-zinc-400 hover:text-red-500" />
                  </Button>
                </div>

                <div className="mt-2 flex gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 flex-1 text-xs border border-zinc-200"
                    onClick={() => setSettings(tpl.settings)}
                    title="Cargar en el editor sin activar"
                  >
                    Editar
                  </Button>
                  {!tpl.is_default && (
                    <Button
                      size="sm"
                      className="h-7 flex-1 text-xs bg-orange-500 hover:bg-orange-600"
                      onClick={() => handleActivateTemplate(tpl)}
                    >
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Activar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Save as template dialog ── */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar plantilla</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-500">
            Guarda la configuración actual con un nombre para poder reutilizarla o volver a ella más adelante.
          </p>
          <div className="space-y-3 pt-1">
            <div>
              <Label>Nombre de la plantilla</Label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Ej: Plantilla navidad 2025, Plantilla formal..."
                onKeyDown={(e) => e.key === "Enter" && handleSaveAsTemplate()}
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-zinc-50 border border-zinc-200 p-3">
              <div className="h-4 w-4 rounded-full border" style={{ background: settings.quote_primary_color }} />
              <div className="text-xs text-zinc-600">
                <strong>{settings.quote_company_name}</strong> · {settings.quote_primary_color}
              </div>
            </div>
            <Button
              onClick={handleSaveAsTemplate}
              disabled={savingTemplate || !newTemplateName.trim()}
              className="w-full"
            >
              <BookMarked className="mr-2 h-4 w-4" />
              {savingTemplate ? "Guardando..." : "Guardar y activar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
