import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const autoPrint = url.searchParams.get("download") === "1";
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Load quote + settings in parallel
  const [quoteRes, itemsRes, settingsRes] = await Promise.all([
    supabase.from("quotes").select("*, client:clients(*)").eq("id", id).single(),
    supabase.from("quote_items").select("*").eq("quote_id", id).order("display_order"),
    supabase.from("app_settings").select("key, value"),
  ]);

  if (!quoteRes.data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Build settings map with defaults
  const s: Record<string, string> = {
    quote_company_name: "ProMarca",
    quote_company_tagline: "Productos Promocionales",
    quote_company_email: "hola@promarca.co",
    quote_company_phone: "+57 300 000 0000",
    quote_company_nit: "XXX.XXX.XXX-X",
    quote_primary_color: "#FF6B1A",
    quote_conditions: "Precios sujetos a cambio sin previo aviso. Tiempo de producción: 8-15 días hábiles según producto y cantidad.",
    quote_payment_terms: "50% anticipo, 50% contra entrega.",
    quote_footer_extra: "",
  };
  for (const { key, value } of settingsRes.data ?? []) {
    if (value !== null) s[key] = value;
  }

  const quote = quoteRes.data;
  const items = itemsRes.data ?? [];
  const client = quote.client;
  const primary = s.quote_primary_color;

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

  const discountAmount = Math.round(quote.subtotal * (quote.discount_percent / 100));
  const baseAfterDiscount = quote.subtotal - discountAmount;
  const ivaAmount = Math.round(baseAfterDiscount * (quote.iva_percent / 100));

  const html = buildQuoteHTML({ quote, items, client, s, primary, formatPrice, discountAmount, ivaAmount, autoPrint });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function buildQuoteHTML({ quote, items, client, s, primary, formatPrice, discountAmount, ivaAmount, autoPrint }: any) {
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
  .accent { color: ${primary}; }

  /* ── Floating toolbar (hidden when printing) ── */
  .print-toolbar {
    position: fixed; top: 16px; right: 16px; z-index: 1000;
    display: flex; gap: 8px;
  }
  .btn-print {
    background: ${primary}; color: white; border: none; border-radius: 8px;
    padding: 10px 20px; font-size: 13px; font-weight: 600;
    cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.18);
    display: flex; align-items: center; gap: 6px;
  }
  .btn-print:hover { opacity: 0.9; }
  .btn-close {
    background: #f5f5f7; color: #1d1d1f; border: 1px solid #e5e5e7;
    border-radius: 8px; padding: 10px 16px; font-size: 13px;
    cursor: pointer;
  }
  @media print {
    .print-toolbar { display: none !important; }
    body { padding: 20px; }
    @page { margin: 15mm; size: A4; }
  }
</style>
${autoPrint ? `<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 600); });</script>` : ""}
</head>
<body>
  <!-- Floating print toolbar -->
  <div class="print-toolbar">
    <button class="btn-print" onclick="window.print()">
      ⬇ Descargar PDF
    </button>
    <button class="btn-close" onclick="window.close()">✕ Cerrar</button>
  </div>

  <div class="header">
    <div>
      <div class="logo"><span>${s.quote_company_name.slice(0, 3)}</span>${s.quote_company_name.slice(3)}</div>
      <p style="color:#6e6e73; margin-top:4px;">${s.quote_company_tagline}</p>
      <p style="color:#6e6e73;">${s.quote_company_email} | ${s.quote_company_phone}</p>
    </div>
    <div class="quote-info">
      <div class="quote-number">${quote.quote_number}</div>
      <p style="color:#6e6e73;">Fecha: ${new Date(quote.created_at).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}</p>
      ${quote.valid_until ? `<p style="color:#6e6e73;">Válida hasta: ${new Date(quote.valid_until).toLocaleDateString("es-CO")}</p>` : ""}
    </div>
  </div>

  ${client ? `
  <div class="client-box">
    <h3>Datos del cliente</h3>
    <p><strong>${client.name}</strong></p>
    ${client.company ? `<p>${client.company}</p>` : ""}
    ${client.nit ? `<p>NIT: ${client.nit}</p>` : ""}
    ${client.email ? `<p>${client.email}</p>` : ""}
    ${client.phone ? `<p>${client.phone}</p>` : ""}
    ${client.address ? `<p>${client.address}${client.city ? `, ${client.city}` : ""}</p>` : ""}
  </div>` : ""}

  <table>
    <thead>
      <tr>
        <th>Ref.</th>
        <th>Producto</th>
        <th>Cant.</th>
        <th>Precio Unit.</th>
        <th>Marcado</th>
        <th class="text-right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item: any) => `
      <tr>
        <td><strong>${item.product_reference ?? "—"}</strong></td>
        <td>${item.product_name}</td>
        <td>${item.quantity}</td>
        <td>${formatPrice(item.unit_price)}</td>
        <td>${item.marking_type ?? "—"}${item.marking_price > 0 ? ` (+${formatPrice(item.marking_price)}/u)` : ""}</td>
        <td class="text-right"><strong>${formatPrice(item.line_total)}</strong></td>
      </tr>`).join("")}
    </tbody>
  </table>

  ${quote.notes ? `<div class="notes"><strong>Notas:</strong> ${quote.notes}</div>` : ""}

  <div class="summary">
    <div class="summary-row"><span>Subtotal</span><span>${formatPrice(quote.subtotal)}</span></div>
    ${quote.discount_percent > 0 ? `<div class="summary-row"><span>Descuento (${quote.discount_percent}%)</span><span style="color:red">-${formatPrice(discountAmount)}</span></div>` : ""}
    <div class="summary-row"><span>IVA (${quote.iva_percent}%)</span><span>${formatPrice(ivaAmount)}</span></div>
    <div class="summary-row summary-total"><span>TOTAL</span><span>${formatPrice(quote.total)}</span></div>
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
