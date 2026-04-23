import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";

/**
 * GET /api/v1/quotes/:id
 * Returns the full quote including items and client.
 *
 * PATCH /api/v1/quotes/:id
 * Update quote metadata (status, notes, discount, valid_until).
 * Body (JSON — all fields optional):
 * {
 *   "status":           "sent" | "accepted" | "rejected" | "expired",
 *   "notes":            string,
 *   "discount_percent": number,
 *   "valid_until":      "2026-05-30"
 * }
 */

const ALLOWED_STATUSES = ["draft", "sent", "accepted", "rejected", "expired"] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = validateApiKey(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { id } = await params;

  const { data, error } = await supabase
    .from("quotes")
    .select(`
      id, quote_number, status, subtotal, discount_percent, iva_percent, total,
      notes, valid_until, pdf_storage_path, created_at, updated_at, confirmed_at, confirmed_total,
      client:clients(id, name, company, email, phone, nit, city),
      quote_items(
        id, product_id, product_name, product_reference,
        quantity, unit_price, marking_type, marking_price, line_total,
        notes, display_order, is_confirmed, confirmed_quantity
      )
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  // Sort items by display_order
  (data as any).quote_items?.sort((a: any, b: any) => a.display_order - b.display_order);

  // Build PDF URL if stored
  const pdfUrl = (data as any).pdf_storage_path
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/quotes/${id}/pdf`
    : null;

  return NextResponse.json({ data: { ...(data as any), pdf_url: pdfUrl } });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = validateApiKey(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { id } = await params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate status if provided
  if (body.status && !ALLOWED_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (body.status           !== undefined) patch.status           = body.status;
  if (body.notes            !== undefined) patch.notes            = body.notes;
  if (body.discount_percent !== undefined) patch.discount_percent = body.discount_percent;
  if (body.valid_until      !== undefined) patch.valid_until      = body.valid_until;

  const { data, error } = await (supabase as any)
    .from("quotes")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Quote not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}
