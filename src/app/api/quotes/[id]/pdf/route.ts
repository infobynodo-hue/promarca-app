import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch quote data
  const { data: quote } = await supabase
    .from("quotes")
    .select("*, client:clients(*)")
    .eq("id", id)
    .single();

  if (!quote) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: items } = await supabase
    .from("quote_items")
    .select("*")
    .eq("quote_id", id)
    .order("display_order");

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(n);

  const client = quote.client;
  const discountAmount = Math.round(
    quote.subtotal * (quote.discount_percent / 100)
  );
  const baseAfterDiscount = quote.subtotal - discountAmount;
  const ivaAmount = Math.round(baseAfterDiscount * (quote.iva_percent / 100));

  // Generate HTML-based PDF (simple approach that works everywhere)
  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1d1d1f; padding: 40px; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .logo { font-size: 24px; font-weight: 700; }
  .logo span { color: #FF6B1A; }
  .quote-info { text-align: right; }
  .quote-number { font-size: 18px; font-weight: 700; color: #FF6B1A; }
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
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo"><span>Pro</span>marca</div>
      <p style="color:#6e6e73; margin-top:4px;">Productos Promocionales</p>
      <p style="color:#6e6e73;">hola@promarca.co | +57 300 000 0000</p>
    </div>
    <div class="quote-info">
      <div class="quote-number">${quote.quote_number}</div>
      <p style="color:#6e6e73;">Fecha: ${new Date(quote.created_at).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}</p>
      ${quote.valid_until ? `<p style="color:#6e6e73;">Válida hasta: ${new Date(quote.valid_until).toLocaleDateString("es-CO")}</p>` : ""}
    </div>
  </div>

  ${
    client
      ? `
  <div class="client-box">
    <h3>Datos del cliente</h3>
    <p><strong>${client.name}</strong></p>
    ${client.company ? `<p>${client.company}</p>` : ""}
    ${client.nit ? `<p>NIT: ${client.nit}</p>` : ""}
    ${client.email ? `<p>${client.email}</p>` : ""}
    ${client.phone ? `<p>${client.phone}</p>` : ""}
    ${client.address ? `<p>${client.address}${client.city ? `, ${client.city}` : ""}</p>` : ""}
  </div>
  `
      : ""
  }

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
      ${(items ?? [])
        .map(
          (item: any) => `
        <tr>
          <td><strong>${item.product_reference ?? "—"}</strong></td>
          <td>${item.product_name}</td>
          <td>${item.quantity}</td>
          <td>${formatPrice(item.unit_price)}</td>
          <td>${item.marking_type ?? "—"}${item.marking_price > 0 ? ` (+${formatPrice(item.marking_price)}/u)` : ""}</td>
          <td class="text-right"><strong>${formatPrice(item.line_total)}</strong></td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>

  ${quote.notes ? `<div class="notes"><strong>Notas:</strong> ${quote.notes}</div>` : ""}

  <div class="summary">
    <div class="summary-row">
      <span>Subtotal</span>
      <span>${formatPrice(quote.subtotal)}</span>
    </div>
    ${
      quote.discount_percent > 0
        ? `<div class="summary-row"><span>Descuento (${quote.discount_percent}%)</span><span style="color:red">-${formatPrice(discountAmount)}</span></div>`
        : ""
    }
    <div class="summary-row">
      <span>IVA (${quote.iva_percent}%)</span>
      <span>${formatPrice(ivaAmount)}</span>
    </div>
    <div class="summary-row summary-total">
      <span>TOTAL</span>
      <span>${formatPrice(quote.total)}</span>
    </div>
  </div>

  <div style="clear:both;"></div>

  <div class="footer">
    <p><strong>Condiciones:</strong> Precios sujetos a cambio sin previo aviso. Tiempo de producción: 8-15 días hábiles según producto y cantidad. Pago: 50% anticipo, 50% contra entrega.</p>
    <p style="margin-top:8px;">ProMarca — Productos Promocionales | NIT: XXX.XXX.XXX-X</p>
  </div>
</body>
</html>
  `;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
