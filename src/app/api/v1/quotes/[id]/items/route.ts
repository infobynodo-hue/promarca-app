import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";

/**
 * POST /api/v1/quotes/:id/items
 *
 * Adds one or more items to an existing quote and recalculates totals.
 *
 * Body (JSON):
 * {
 *   "items": [
 *     {
 *       "product_id": "uuid",             // optional
 *       "product_reference": "TM-1001",   // optional (resolved to id)
 *       "product_name": "Termo 500ml",    // required if product cannot be resolved
 *       "quantity": 50,
 *       "unit_price": 45000,
 *       "marking_type": "Grabado láser",
 *       "marking_price": 8000,
 *       "notes": "Color plateado"
 *     }
 *   ]
 * }
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = validateApiKey(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { id: quoteId } = await params;

  // Verify quote exists
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, subtotal, discount_percent, iva_percent")
    .eq("id", quoteId)
    .single();
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { items = [] } = body;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Field 'items' must be a non-empty array" }, { status: 400 });
  }

  // Get current max display_order
  const { data: existing } = await (supabase as any)
    .from("quote_items")
    .select("display_order")
    .eq("quote_id", quoteId)
    .order("display_order", { ascending: false })
    .limit(1);
  const baseOrder = ((existing as any[])?.[0]?.display_order ?? -1) + 1;

  // Resolve items
  const resolved = await Promise.all(
    items.map(async (item: any, idx: number) => {
      let productId   = item.product_id;
      let productName = item.product_name;
      let productRef  = item.product_reference;

      if (!productId && item.product_reference) {
        const { data: prod } = await (supabase as any)
          .from("products")
          .select("id, name, reference")
          .eq("reference", item.product_reference)
          .single();
        if (prod) {
          productId   = (prod as any).id;
          productName = productName ?? (prod as any).name;
          productRef  = (prod as any).reference;
        }
      }

      if (!productName) {
        return { _error: `Item ${idx + 1}: 'product_name' is required` };
      }

      const qty          = parseInt(item.quantity ?? 1);
      const unitPrice    = parseInt(item.unit_price ?? 0);
      const markingPrice = parseInt(item.marking_price ?? 0);
      const lineTotal    = qty * (unitPrice + markingPrice);

      return {
        quote_id:          quoteId,
        product_id:        productId ?? null,
        product_name:      productName,
        product_reference: productRef ?? null,
        quantity:          qty,
        unit_price:        unitPrice,
        marking_type:      item.marking_type ?? null,
        marking_price:     markingPrice,
        line_total:        lineTotal,
        notes:             item.notes ?? null,
        display_order:     baseOrder + idx,
      };
    })
  );

  const itemError = resolved.find((i) => (i as any)._error);
  if (itemError) return NextResponse.json({ error: (itemError as any)._error }, { status: 400 });

  const { error: insertErr } = await (supabase as any).from("quote_items").insert(resolved);
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Recalculate totals
  const { data: allItems } = await (supabase as any)
    .from("quote_items")
    .select("line_total")
    .eq("quote_id", quoteId);

  const subtotal       = ((allItems as any[]) ?? []).reduce((s: number, i: any) => s + (i.line_total ?? 0), 0);
  const discountAmount = Math.round(subtotal * ((quote as any).discount_percent / 100));
  const base           = subtotal - discountAmount;
  const ivaAmount      = Math.round(base * ((quote as any).iva_percent / 100));
  const total          = base + ivaAmount;

  await (supabase as any)
    .from("quotes")
    .update({ subtotal, total, updated_at: new Date().toISOString() })
    .eq("id", quoteId);

  // Return updated quote
  const { data: updated } = await supabase
    .from("quotes")
    .select(`
      id, quote_number, status, subtotal, discount_percent, iva_percent, total,
      notes, valid_until, created_at, updated_at,
      client:clients(id, name, company, email, phone),
      quote_items(
        id, product_id, product_name, product_reference,
        quantity, unit_price, marking_type, marking_price, line_total, notes, display_order
      )
    `)
    .eq("id", quoteId)
    .single();

  return NextResponse.json({ data: updated }, { status: 201 });
}
