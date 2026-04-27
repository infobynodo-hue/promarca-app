import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/orders/[id] — full order detail
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      client:clients(*),
      quote:quotes(id, quote_number, total, quote_items(*)),
      order_status_history(*),
      order_costs(*, provider:providers(*))
    `)
    .eq("id", id)
    .order("display_order", { referencedTable: "order_costs" })
    .order("created_at", { referencedTable: "order_status_history", ascending: true })
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

// PUT /api/orders/[id] — update order metadata
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;
  const body = await req.json();

  const { data, error } = await supabase
    .from("orders")
    .update({
      estimated_delivery: body.estimated_delivery ?? null,
      advance_payment: body.advance_payment,
      client_notification_email: body.client_notification_email ?? null,
      notes: body.notes ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
