import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/providers
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const active = searchParams.get("active");

  let query = supabase
    .from("providers")
    .select("*")
    .order("name");

  if (type) query = query.eq("type", type);
  if (active !== null) query = query.eq("is_active", active !== "false");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/providers
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();

  const { data, error } = await supabase
    .from("providers")
    .insert({
      name: body.name,
      type: body.type ?? "general",
      phone: body.phone ?? null,
      email: body.email ?? null,
      notes: body.notes ?? null,
      is_active: body.is_active ?? true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
