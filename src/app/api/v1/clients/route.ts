import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";

/**
 * GET /api/v1/clients
 *
 * Query params:
 *   search=string      search on name, company, email
 *   limit=number       default 50
 *   offset=number      default 0
 *
 * POST /api/v1/clients
 *
 * Body (JSON):
 *   name*      string   Contact person name
 *   company    string   Company / business name
 *   email      string
 *   phone      string
 *   nit        string   Tax ID
 *   address    string
 *   city       string
 *   notes      string
 *
 * Returns the created client object.
 * If a client with the same email already exists, returns the existing one (idempotent).
 */

export async function GET(request: NextRequest) {
  const auth = validateApiKey(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const limit  = Math.min(parseInt(searchParams.get("limit")  ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  let query = supabase
    .from("clients")
    .select("id, name, company, email, phone, nit, address, city, notes, created_at, updated_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

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

  const { name, company, email, phone, nit, address, city, notes } = body;

  if (!name) {
    return NextResponse.json({ error: "Field 'name' is required" }, { status: 400 });
  }

  // Idempotency: if email exists, return the existing client
  if (email) {
    const { data: existing } = await supabase
      .from("clients")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ data: existing, created: false }, { status: 200 });
    }
  }

  const { data, error } = await (supabase as any)
    .from("clients")
    .insert({ name, company, email, phone, nit, address, city, notes })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, created: true }, { status: 201 });
}
