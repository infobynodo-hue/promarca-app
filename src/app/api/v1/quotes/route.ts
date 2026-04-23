import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";

/**
 * GET /api/v1/quotes
 *
 * Query params:
 *   status=draft|sent|accepted|rejected|expired
 *   client_id=uuid
 *   limit=number    default 20
 *   offset=number   default 0
 *
 * POST /api/v1/quotes
 *
 * Crea una cotización completa con sus ítems en una sola llamada.
 *
 * Body (JSON):
 * {
 *   "client_id": "uuid",              // required — use POST /api/v1/clients first
 *   "notes": "Envío a Bogotá",
 *   "valid_until": "2026-05-30",      // ISO date string
 *   "discount_percent": 10,           // default 0
 *   "iva_percent": 19,                // default 19
 *   "items": [
 *     {
 *       "product_id": "uuid",         // optional if product_reference is provided
 *       "product_reference": "TM-1001",
 *       "product_name": "Termo Acero 500ml",
 *       "quantity": 100,
 *       "unit_price": 45000,
 *       "marking_type": "Serigrafía 1 tinta",
 *       "marking_price": 5000,        // per unit
 *       "notes": "Color negro"
 *     }
 *   ]
 * }
 *
 * Totals are calculated automatically.
 * Returns the full quote object including generated quote_number.
 */

function generateQuoteNumber(): string {
  const now = new Date();
  const yy  = String(now.getFullYear()).slice(-2);
  const mm  = String(now.getMonth() + 1).padStart(2, "0");
  const dd  = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 900) + 100;
  return `PM-${yy}${mm}${dd}-${rand}`;
}

export async function GET(request: NextRequest) {
  const auth = validateApiKey(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { searchParams } = new URL(request.url);
  const status   = searchParams.get("status");
  const clientId = searchParams.get("client_id");
  const limit    = Math.min(parseInt(searchParams.get("limit")  ?? "20"), 100);
  const offset   = parseInt(searchParams.get("offset") ?? "0");

  let query = supabase
    .from("quotes")
    .select(`
      id, quote_number, status, subtotal, discount_percent, iva_percent, total,
      notes, valid_until, created_at, updated_at,
      client:clients(id, name, company, email, phone)
    `)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status)   query = query.eq("status", status);
  if (clientId) query = query.eq("client_id", clientId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [], count: data?.length ?? 0, offset, limit });
}

export async function POST(request: NextRequest) {
  const auth = validateApiKey(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    client_id,
    notes,
    valid_until,
    discount_percent = 0,
    iva_percent      = 19,
    items            = [],
  } = body;

  if (!client_id) {
    return NextResponse.json({ error: "Field 'client_id' is required" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "At least one item is required in 'items'" }, { status: 400 });
  }

  // Verify client exists
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", client_id)
    .single();
  if (!client) return NextResponse.json({ error: "client_id not found" }, { status: 404 });

  // Resolve product_id from reference if needed
  const resolvedItems = await Promise.all(
    items.map(async (item: any, idx: number) => {
      let productId = item.product_id;
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
        return { error: `Item ${idx + 1}: 'product_name' is required when product cannot be resolved` };
      }

      const qty          = parseInt(item.quantity ?? 1);
      const unitPrice    = parseInt(item.unit_price ?? 0);
      const markingPrice = parseInt(item.marking_price ?? 0);
      const lineTotal    = qty * (unitPrice + markingPrice);

      return {
        product_id:        productId ?? null,
        product_name:      productName,
        product_reference: productRef ?? null,
        quantity:          qty,
        unit_price:        unitPrice,
        marking_type:      item.marking_type ?? null,
        marking_price:     markingPrice,
        line_total:        lineTotal,
        notes:             item.notes ?? null,
        display_order:     idx,
      };
    })
  );

  // Check for resolution errors
  const itemError = resolvedItems.find((i) => (i as any).error);
  if (itemError) return NextResponse.json({ error: (itemError as any).error }, { status: 400 });

  // Calculate totals
  const subtotal       = resolvedItems.reduce((s, i) => s + (i as any).line_total, 0);
  const discountAmount = Math.round(subtotal * (discount_percent / 100));
  const base           = subtotal - discountAmount;
  const ivaAmount      = Math.round(base * (iva_percent / 100));
  const total          = base + ivaAmount;

  // Insert quote
  const { data: quote, error: quoteErr } = await (supabase as any)
    .from("quotes")
    .insert({
      quote_number:     generateQuoteNumber(),
      client_id,
      status:           "draft",
      notes:            notes ?? null,
      valid_until:      valid_until ?? null,
      discount_percent,
      iva_percent,
      subtotal,
      total,
    })
    .select()
    .single();

  if (quoteErr || !quote) {
    return NextResponse.json({ error: quoteErr?.message ?? "Failed to create quote" }, { status: 500 });
  }

  // Insert items
  const { error: itemsErr } = await (supabase as any)
    .from("quote_items")
    .insert(resolvedItems.map((i) => ({ ...i, quote_id: (quote as any).id })));

  if (itemsErr) {
    // Rollback quote
    await supabase.from("quotes").delete().eq("id", (quote as any).id);
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  // Return full quote with items
  const { data: full } = await supabase
    .from("quotes")
    .select(`
      id, quote_number, status, subtotal, discount_percent, iva_percent, total,
      notes, valid_until, created_at,
      client:clients(id, name, company, email, phone),
      quote_items(id, product_id, product_name, product_reference, quantity, unit_price,
                  marking_type, marking_price, line_total, notes, display_order)
    `)
    .eq("id", (quote as any).id)
    .single();

  return NextResponse.json({ data: full }, { status: 201 });
}
