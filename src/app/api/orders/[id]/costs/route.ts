import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/orders/[id]/costs
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  const { data, error } = await supabase
    .from("order_costs")
    .select("*, provider:providers(*)")
    .eq("order_id", id)
    .order("display_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/orders/[id]/costs — add a cost line
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;
  const body = await req.json();

  // Get max display_order
  const { data: existing } = await supabase
    .from("order_costs")
    .select("display_order")
    .eq("order_id", id)
    .order("display_order", { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;

  // Snapshot provider name if provider_id is given
  let providerName = body.provider_name ?? null;
  if (body.provider_id && !providerName) {
    const { data: prov } = await supabase
      .from("providers")
      .select("name")
      .eq("id", body.provider_id)
      .single();
    providerName = prov?.name ?? null;
  }

  const { data, error } = await supabase
    .from("order_costs")
    .insert({
      order_id: id,
      cost_type: body.cost_type ?? "otro",
      provider_id: body.provider_id ?? null,
      provider_name: providerName,
      description: body.description,
      amount: body.amount ?? 0,
      display_order: nextOrder,
    })
    .select("*, provider:providers(*)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
