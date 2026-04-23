import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";

/**
 * GET /api/v1/categories
 *
 * Query params:
 *   active=true|false   (default: true — only active)
 *   with_counts=true    (include product count per category)
 */
export async function GET(request: NextRequest) {
  const auth = validateApiKey(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { searchParams } = new URL(request.url);
  const onlyActive = searchParams.get("active") !== "false";
  const withCounts = searchParams.get("with_counts") === "true";

  let query = supabase
    .from("categories")
    .select(
      withCounts
        ? "id, name, slug, description, icon, display_order, is_active, created_at, products(count)"
        : "id, name, slug, description, icon, display_order, is_active, created_at"
    )
    .order("display_order");

  if (onlyActive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten count if requested
  const result = withCounts
    ? data?.map(({ products, ...cat }: any) => ({
        ...cat,
        product_count: (products as any[])?.[0]?.count ?? 0,
      }))
    : data;

  return NextResponse.json({ data: result, count: result?.length ?? 0 });
}
