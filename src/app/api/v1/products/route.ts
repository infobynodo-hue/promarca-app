import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";

/**
 * GET /api/v1/products
 *
 * Query params:
 *   category_id=uuid        filter by category
 *   category_slug=string    filter by category slug (e.g. "termos")
 *   search=string           text search on name / reference
 *   active=true|false       default true
 *   limit=number            default 50, max 200
 *   offset=number           default 0
 *   with_images=true        include primary image URL
 *   with_colors=true        include color swatches
 *   with_variants=true      include price variants
 */
export async function GET(request: NextRequest) {
  const auth = validateApiKey(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { searchParams } = new URL(request.url);
  const categoryId   = searchParams.get("category_id");
  const categorySlug = searchParams.get("category_slug");
  const search       = searchParams.get("search");
  const onlyActive   = searchParams.get("active") !== "false";
  const limit        = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset       = parseInt(searchParams.get("offset") ?? "0");
  const withImages   = searchParams.get("with_images") === "true";
  const withColors   = searchParams.get("with_colors") === "true";
  const withVariants = searchParams.get("with_variants") === "true";

  // Build select
  const selectParts = [
    "id, reference, name, description, price, price_label, has_variants, is_active, created_at, updated_at",
    "category:categories(id, name, slug)",
  ];
  if (withImages)   selectParts.push("product_images(storage_path, is_primary, display_order)");
  if (withColors)   selectParts.push("product_colors(id, name, hex_color, display_order)");
  if (withVariants) selectParts.push("product_variants(id, label, price, reference, is_default, display_order)");

  let query = supabase
    .from("products")
    .select(selectParts.join(", "))
    .order("name")
    .range(offset, offset + limit - 1);

  if (onlyActive)   query = query.eq("is_active", true);
  if (categoryId)   query = query.eq("category_id", categoryId);
  if (search)       query = query.or(`name.ilike.%${search}%,reference.ilike.%${search}%`);

  // Filter by category slug — resolve to id first
  if (categorySlug && !categoryId) {
    const { data: cat } = await (supabase as any)
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .single();
    if (!cat) return NextResponse.json({ error: "Category not found", data: [], count: 0 }, { status: 404 });
    query = query.eq("category_id", (cat as any).id);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Build public image URLs
  const STORAGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products`;

  const result = (data ?? []).map((p: any) => {
    const out: any = {
      id:          p.id,
      reference:   p.reference,
      name:        p.name,
      description: p.description,
      price:       p.price,
      price_label: p.price_label,
      has_variants:p.has_variants,
      is_active:   p.is_active,
      category:    p.category,
      created_at:  p.created_at,
      updated_at:  p.updated_at,
    };

    if (withImages) {
      const imgs: any[] = p.product_images ?? [];
      imgs.sort((a: any, b: any) => {
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        return a.display_order - b.display_order;
      });
      out.images = imgs.map((img: any) => ({
        url: `${STORAGE_URL}/${img.storage_path}`,
        is_primary: img.is_primary,
      }));
      out.image_url = out.images[0]?.url ?? null;
    }

    if (withColors)   out.colors   = p.product_colors   ?? [];
    if (withVariants) out.variants = p.product_variants ?? [];

    return out;
  });

  return NextResponse.json({ data: result, count: result.length, offset, limit });
}
