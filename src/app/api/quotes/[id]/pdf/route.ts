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

  const [quoteRes, itemsRes, settingsRes] = await Promise.all([
    supabase.from("quotes").select("*, client:clients(*)").eq("id", id).single(),
    supabase.from("quote_items").select("*").eq("quote_id", id).order("display_order"),
    supabase.from("app_settings").select("key, value"),
  ]);

  if (!quoteRes.data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const quote  = quoteRes.data;
  const items  = itemsRes.data ?? [];
  const client = quote.client;

  // ── Settings with defaults ───────────────────────────────────────────────
  const s: Record<string, string> = {
    quote_company_name:    "ProMarca",
    quote_company_tagline: "Productos Promocionales",
    quote_company_email:   "promarcapop@gmail.com",
    quote_company_phone:   "302 521 2938 - 311 5096743",
    quote_company_nit:     "XXX.XXX.XXX-X",
    quote_primary_color:   "#FF6B1A",
    quote_conditions:      "Si desea el servicio personalizado con su marca requerimos el logo editable que va brandeado en el producto respectivo.",
    quote_payment_terms:   "Pago Anticipado. El costo del envío varía según la ciudad destino, descrito en la cotización.",
    quote_footer_extra:    "",
    quote_contact_name:    "Sthefany Ahumada",
    quote_contact_title:   "Publicista y Estratega de Marketing",
    quote_instagram:       "pro__marca",
    quote_website:         "promarca.co",
  };
  for (const { key, value } of settingsRes.data ?? []) {
    if (value !== null) s[key] = value;
  }

  const primary = s.quote_primary_color;

  // ── Fetch primary images for all products in this quote ──────────────────
  const productIds = items.map((i: any) => i.product_id).filter(Boolean);
  let imageMap: Record<string, string> = {};

  if (productIds.length > 0) {
    const { data: imgRows } = await supabase
      .from("product_images")
      .select("product_id, storage_path, is_primary, display_order")
      .in("product_id", productIds)
      .order("display_order");

    // Build map: productId → public URL of primary (or first) image
    const grouped: Record<string, any[]> = {};
    for (const row of imgRows ?? []) {
      if (!grouped[row.product_id]) grouped[row.product_id] = [];
      grouped[row.product_id].push(row);
    }
    for (const [pid, imgs] of Object.entries(grouped)) {
      const primary_img = imgs.find((i) => i.is_primary) ?? imgs[0];
      if (primary_img) {
        const { data } = supabase.storage.from("products").getPublicUrl(primary_img.storage_path);
        imageMap[pid] = data.publicUrl;
      }
    }
  }

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

  const discountAmount    = Math.round(quote.subtotal * (quote.discount_percent / 100));
  const baseAfterDiscount = quote.subtotal - discountAmount;
  const ivaAmount         = Math.round(baseAfterDiscount * (quote.iva_percent / 100));

  const html = buildQuoteHTML({
    quote, items, client, s, primary,
    formatPrice, discountAmount, ivaAmount,
    autoPrint, imageMap,
  });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
function buildQuoteHTML({ quote, items, client, s, primary, formatPrice, discountAmount, ivaAmount, autoPrint, imageMap }: any) {

  const clientName = client?.company || client?.name || "Cliente";
  const quoteDate  = new Date(quote.created_at).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });

  const totalGeneral = quote.total;
  const shippingCost = quote.notes?.match(/envío[:\s]+\$?([\d.,]+)/i)?.[1] ?? null;

  // ── Product cards ─────────────────────────────────────────────────────────
  const productCards = items.map((item: any) => {
    const imgUrl = imageMap[item.product_id] ?? null;
    const lineTotal = item.line_total ?? (item.quantity * item.unit_price + item.quantity * (item.marking_price ?? 0));

    return `
    <div class="product-card">
      <div class="product-info">
        <div class="product-header">
          <p class="product-name">${item.product_name}</p>
          ${item.product_reference ? `<p class="product-ref">${item.product_reference}</p>` : ""}
        </div>
        ${item.notes ? `<p class="product-desc">${item.notes}</p>` : ""}
        <div class="price-row">
          <div class="price-block">
            <span class="price-main">${formatPrice(item.unit_price)}</span>
            <span class="price-label">1 und</span>
          </div>
          <div class="price-block">
            <span class="price-main price-total">${formatPrice(lineTotal)}</span>
            <span class="price-label">${item.quantity} unds</span>
          </div>
        </div>
        ${item.marking_type && item.marking_type !== "Sin marcado" ? `
        <p class="marking-label">
          ${item.marking_type}${item.marking_price > 0 ? ` · +${formatPrice(item.marking_price)}/und` : ""}
        </p>` : ""}
      </div>
      <div class="product-image-wrap">
        ${imgUrl
          ? `<img src="${imgUrl}" alt="${item.product_name}" class="product-img" />`
          : `<div class="product-img-placeholder">📦</div>`
        }
      </div>
    </div>`;
  }).join("");

  // ── Summary total ─────────────────────────────────────────────────────────
  const summaryRows = `
    <div class="summary-row"><span>Subtotal</span><span>${formatPrice(quote.subtotal)}</span></div>
    ${quote.discount_percent > 0 ? `<div class="summary-row"><span>Descuento (${quote.discount_percent}%)</span><span class="neg">-${formatPrice(discountAmount)}</span></div>` : ""}
    ${quote.iva_percent > 0 ? `<div class="summary-row"><span>IVA (${quote.iva_percent}%)</span><span>${formatPrice(ivaAmount)}</span></div>` : ""}
    <div class="summary-row summary-total"><span>TOTAL</span><span>${formatPrice(totalGeneral)}</span></div>
  `;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cotización ${quote.quote_number} — ${clientName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
    background: #f0f0f0;
    color: #1a1a1a;
    font-size: 13px;
  }

  /* ── Print toolbar ── */
  .print-toolbar {
    position: fixed; top: 16px; right: 16px; z-index: 1000;
    display: flex; gap: 8px;
  }
  .btn-print {
    background: ${primary}; color: white; border: none; border-radius: 8px;
    padding: 10px 20px; font-size: 13px; font-weight: 600;
    cursor: pointer; box-shadow: 0 2px 12px rgba(0,0,0,0.18);
  }
  .btn-close {
    background: white; color: #333; border: 1px solid #ddd;
    border-radius: 8px; padding: 10px 16px; font-size: 13px; cursor: pointer;
  }

  /* ── Page wrapper ── */
  .page {
    max-width: 680px;
    margin: 0 auto;
    background: white;
    min-height: 100vh;
  }

  /* ── TOP HEADER BAR ── */
  .top-bar {
    background: white;
    padding: 24px 32px 20px;
    border-bottom: 1px solid #f0f0f0;
  }
  .top-bar-inner {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .logo-wrap { display: flex; flex-direction: column; gap: 4px; }
  .logo {
    font-size: 26px; font-weight: 800; letter-spacing: -0.5px; line-height: 1;
  }
  .logo .pro { color: ${primary}; }
  .logo .marca { color: #1a1a1a; }
  .logo-tagline {
    display: flex; gap: 16px; margin-top: 4px;
  }
  .logo-tagline span {
    font-size: 10px; font-weight: 600; color: #999;
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .logo-tagline .accent { color: ${primary}; }
  .top-contact {
    text-align: right; font-size: 11px; color: #666; line-height: 1.7;
  }
  .top-contact a { color: #666; text-decoration: none; }

  /* ── CLIENT NAME ── */
  .client-hero {
    padding: 36px 32px 28px;
    background: white;
  }
  .client-hero-label {
    font-size: 10px; font-weight: 600; color: #999;
    text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;
  }
  .client-hero-name {
    font-size: 48px; font-weight: 800; color: #111;
    line-height: 1; letter-spacing: -1px;
  }
  .quote-meta {
    margin-top: 10px; display: flex; gap: 20px; font-size: 11px; color: #999;
  }
  .quote-meta span strong { color: #555; }

  /* ── SECTION WRAPPER ── */
  .section { padding: 0 32px; }

  /* ── PRODUCT CARDS ── */
  .product-card {
    display: flex;
    justify-content: space-between;
    align-items: stretch;
    background: white;
    border: 1px solid #ebebeb;
    border-radius: 16px;
    margin-bottom: 14px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  .product-info {
    flex: 1;
    padding: 20px 20px 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .product-header { display: flex; flex-direction: column; gap: 2px; }
  .product-name {
    font-size: 14px; font-weight: 700; color: #111; line-height: 1.3;
  }
  .product-ref {
    font-size: 10px; font-weight: 600; color: #999;
    text-transform: uppercase; letter-spacing: 0.06em;
  }
  .product-desc {
    font-size: 11px; color: #666; line-height: 1.5;
    max-width: 340px;
  }
  .price-row {
    display: flex; gap: 28px; margin-top: 4px;
  }
  .price-block { display: flex; flex-direction: column; gap: 1px; }
  .price-main {
    font-size: 18px; font-weight: 800; color: #111; line-height: 1;
  }
  .price-total { color: ${primary}; }
  .price-label {
    font-size: 10px; color: #aaa; font-weight: 500;
  }
  .marking-label {
    font-size: 10px; color: #888; border-top: 1px solid #f0f0f0;
    padding-top: 8px; margin-top: 2px;
    font-style: italic;
  }
  .product-image-wrap {
    width: 160px;
    min-height: 140px;
    background: #f7f7f7;
    display: flex;
    align-items: center;
    justify-content: center;
    border-left: 1px solid #ebebeb;
    flex-shrink: 0;
  }
  .product-img {
    width: 100%; height: 100%;
    object-fit: contain;
    padding: 12px;
  }
  .product-img-placeholder {
    font-size: 36px; color: #ccc;
  }

  /* ── TOTAL SUMMARY ── */
  .summary-box {
    background: #f8f8f8;
    border: 1px solid #ebebeb;
    border-radius: 16px;
    padding: 20px 24px;
    margin-bottom: 14px;
  }
  .summary-row {
    display: flex; justify-content: space-between;
    font-size: 13px; padding: 5px 0;
    color: #555;
  }
  .summary-row.summary-total {
    font-size: 20px; font-weight: 800; color: #111;
    border-top: 2px solid #222; padding-top: 12px; margin-top: 6px;
  }
  .neg { color: #e53e3e; }

  /* ── RECORDATORIO ── */
  .recordatorio-box {
    border: 1px solid #ebebeb;
    border-radius: 16px;
    padding: 20px 24px;
    margin-bottom: 14px;
    background: white;
  }
  .badge {
    display: inline-block;
    background: ${primary};
    color: white;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-radius: 20px;
    padding: 3px 12px;
    margin-bottom: 12px;
  }
  .recordatorio-text {
    font-size: 12px; color: #444; line-height: 1.7; font-style: italic;
  }
  .recordatorio-text strong { font-style: normal; color: #111; }
  .shipping-row {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid #f0f0f0;
    font-size: 12px;
    color: #666;
    display: flex;
    justify-content: space-between;
  }
  .shipping-row strong { color: #111; font-size: 14px; }

  /* ── INFO BOXES ── */
  .info-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
    margin-bottom: 14px;
  }
  .info-box {
    border: 1px solid #ebebeb; border-radius: 16px;
    padding: 18px 20px; background: white;
  }
  .info-box-title {
    display: inline-flex; align-items: center; gap: 6px;
    background: ${primary}; color: white;
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; border-radius: 20px;
    padding: 3px 12px; margin-bottom: 12px;
  }
  .info-row {
    display: flex; justify-content: space-between;
    font-size: 11px; color: #555; padding: 4px 0;
    border-bottom: 1px solid #f5f5f5;
    gap: 12px;
  }
  .info-row:last-child { border-bottom: none; }
  .info-row .label { color: #888; flex-shrink: 0; }
  .info-row .value { font-weight: 600; color: #222; text-align: right; }
  .info-text { font-size: 11px; color: #555; line-height: 1.6; }
  .info-text strong { color: #111; }

  /* ── LOGO NOTE ── */
  .logo-note {
    background: #fffbf5; border: 1px solid #ffe0b2;
    border-radius: 12px; padding: 14px 18px;
    font-size: 11px; color: #666; line-height: 1.6;
    margin-bottom: 14px;
  }
  .logo-note strong { color: #111; }

  /* ── FOOTER ── */
  .footer-divider {
    height: 1px; background: #ebebeb; margin: 0 32px 28px;
  }
  .footer {
    padding: 0 32px 32px;
    text-align: center;
  }
  .footer-logo {
    font-size: 22px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 4px;
  }
  .footer-logo .pro { color: ${primary}; }
  .footer-contact-name {
    font-size: 15px; font-weight: 700; color: #111; margin-bottom: 2px;
  }
  .footer-contact-title {
    font-size: 11px; color: #888; margin-bottom: 12px;
  }
  .footer-contact-grid {
    display: flex; justify-content: center; gap: 24px;
    font-size: 11px; color: #555; flex-wrap: wrap;
    margin-bottom: 20px;
  }
  .footer-contact-grid span { display: flex; align-items: center; gap: 4px; }
  .footer-bottom-logo {
    font-size: 18px; font-weight: 800; color: #111; letter-spacing: -0.5px;
    margin-top: 16px;
  }
  .footer-bottom-logo .pro { color: ${primary}; }

  /* ── Print ── */
  @media print {
    .print-toolbar { display: none !important; }
    body { background: white; }
    .page { max-width: 100%; box-shadow: none; }
    .product-card { page-break-inside: avoid; }
    @page { margin: 10mm; size: A4; }
  }
</style>
${autoPrint ? `<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},800);});</script>` : ""}
</head>
<body>

<!-- Print toolbar -->
<div class="print-toolbar">
  <button class="btn-print" onclick="window.print()">⬇ Descargar PDF</button>
  <button class="btn-close" onclick="window.close()">✕ Cerrar</button>
</div>

<div class="page">

  <!-- ── TOP HEADER ── -->
  <div class="top-bar">
    <div class="top-bar-inner">
      <div class="logo-wrap">
        <div class="logo"><span class="pro">Pro</span><span class="marca">marca</span></div>
        <div class="logo-tagline">
          <span class="accent">Inversión</span>
          <span>Fidelización</span>
          <span>Retorno</span>
        </div>
      </div>
      <div class="top-contact">
        <div>${s.quote_company_phone}</div>
        <div>${s.quote_company_email}</div>
        <div>@${s.quote_instagram} &nbsp;·&nbsp; ${s.quote_website}</div>
      </div>
    </div>
  </div>

  <!-- ── CLIENT NAME ── -->
  <div class="client-hero">
    <div class="client-hero-label">Propuesta comercial</div>
    <div class="client-hero-name">${clientName}</div>
    <div class="quote-meta">
      <span><strong>${quote.quote_number}</strong></span>
      <span>${quoteDate}</span>
      ${quote.valid_until ? `<span>Válida hasta ${new Date(quote.valid_until).toLocaleDateString("es-CO")}</span>` : ""}
    </div>
  </div>

  <!-- ── PRODUCT CARDS ── -->
  <div class="section">
    ${productCards}
  </div>

  <!-- ── TOTAL SUMMARY ── -->
  <div class="section">
    <div class="summary-box">
      ${summaryRows}
    </div>
  </div>

  <!-- ── RECORDATORIO ── -->
  <div class="section">
    <div class="recordatorio-box">
      <div class="badge">Recordatorio</div>
      <p class="recordatorio-text">
        Un <strong>material POP</strong> no es solo un detalle, es una <strong>inversión inteligente</strong>
        para <strong>fidelizar clientes</strong>, creando una conexión duradera que
        fortalece su preferencia por tu marca.
      </p>
      ${quote.notes ? `
      <div class="shipping-row">
        <span>Notas</span>
        <span>${quote.notes}</span>
      </div>` : ""}
    </div>
  </div>

  <!-- ── LOGO NOTE ── -->
  <div class="section">
    <div class="logo-note">
      ${s.quote_conditions}
    </div>
  </div>

  <!-- ── DELIVERY + PAYMENT ── -->
  <div class="section">
    <div class="info-grid">
      <div class="info-box">
        <div class="info-box-title">⏱ Tiempo de entrega</div>
        <div class="info-row">
          <span class="label">100 a 1.000 unidades marcadas</span>
          <span class="value">10 a 13 días hábiles</span>
        </div>
        <div class="info-row">
          <span class="label">3.000 a 5.000 unidades marcadas</span>
          <span class="value">20 a 30 días hábiles</span>
        </div>
        <div class="info-row">
          <span class="label">Sin marca</span>
          <span class="value">6 a 8 días hábiles</span>
        </div>
      </div>
      <div class="info-box">
        <div class="info-box-title">💳 Método de pago</div>
        <p class="info-text"><strong>Pago Anticipado</strong><br/>${s.quote_payment_terms}</p>
      </div>
    </div>
  </div>

  <!-- ── FOOTER DIVIDER ── -->
  <div class="footer-divider"></div>

  <!-- ── FOOTER ── -->
  <div class="footer">
    <div class="footer-logo"><span class="pro">Pro</span>marca</div>
    <div class="footer-contact-name">${s.quote_contact_name}</div>
    <div class="footer-contact-title">${s.quote_contact_title}</div>
    <div class="footer-contact-grid">
      <span>📱 ${s.quote_company_phone}</span>
      <span>📧 ${s.quote_company_email}</span>
      <span>📸 @${s.quote_instagram}</span>
      <span>🌐 ${s.quote_website}</span>
    </div>
    <div class="footer-bottom-logo"><span class="pro">Pro</span>marca</div>
  </div>

</div><!-- /page -->
</body>
</html>`;
}
