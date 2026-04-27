import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// DELETE /api/orders/[id]/costs/[costId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; costId: string }> }
) {
  const supabase = await createClient();
  const { costId } = await params;

  const { error } = await supabase.from("order_costs").delete().eq("id", costId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: "Deleted" });
}

// PUT /api/orders/[id]/costs/[costId] — update cost line
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; costId: string }> }
) {
  const supabase = await createClient();
  const { costId } = await params;
  const body = await req.json();

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
    .update({
      cost_type: body.cost_type,
      provider_id: body.provider_id ?? null,
      provider_name: providerName,
      description: body.description,
      amount: body.amount,
    })
    .eq("id", costId)
    .select("*, provider:providers(*)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
