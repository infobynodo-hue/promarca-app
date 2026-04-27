import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/providers/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  const { data, error } = await supabase
    .from("providers")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

// PUT /api/providers/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;
  const body = await req.json();

  const { data, error } = await supabase
    .from("providers")
    .update({
      name: body.name,
      type: body.type,
      phone: body.phone ?? null,
      email: body.email ?? null,
      notes: body.notes ?? null,
      is_active: body.is_active,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/providers/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  // Check if provider is referenced in order_costs
  const { data: costs } = await supabase
    .from("order_costs")
    .select("id")
    .eq("provider_id", id)
    .limit(1);

  if (costs && costs.length > 0) {
    // Soft delete instead
    await supabase.from("providers").update({ is_active: false }).eq("id", id);
    return NextResponse.json({ message: "Provider deactivated (has linked costs)" });
  }

  const { error } = await supabase.from("providers").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: "Deleted" });
}
