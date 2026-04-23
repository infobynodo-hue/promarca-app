import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";

/**
 * GET /api/v1/products/:id
 *
 * Returns full product detail including images, colors, variants.
 * :id can be the UUID or the product reference string (e.g. "TM-1001")
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = validateApiKey(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const { id } = await params;

  // Determine if :id is a UUID or a reference string
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  let query = supabase
    .from("products")
    .select(`
      id, reference, name, description, price, price_label, has_variants, is_active, created_at, updated_at,
      category:categories(id, name, slug),
      product_images(storage_path, is_primary, display_order, alt_text),
      product_colors(id, name, hex_color, display_order),
      product_variants(id, label, price, reference, is_default, display_order)
    `)
    .single();

  query = isUUID
    ? (query as any).eq("id", id)
    : (query as any).eq("reference", id);

  const { data, error } = await query;

  if (error || !data) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const STORAGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products`;

  const imgs = ((data as any).product_images ?? []).sort((a: any, b: any) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return a.display_order - b.display_order;
  });

  return NextResponse.json({
    data: {
      id:          (data as any).id,
      reference:   (data as any).reference,
      name:        (data as any).name,
      description: (data as any).description,
      price:       (data as any).price,
      price_label: (data as any).price_label,
      has_variants:(data as any).has_variants,
      is_active:   (data as any).is_active,
      category:    (data as any).category,
      images: imgs.map((img: any) => ({
        url:        `${STORAGE_URL}/${img.storage_path}`,
        is_primary: img.is_primary,
        alt_text:   img.alt_text,
      })),
      image_url: imgs[0] ? `${STORAGE_URL}/${imgs[0].storage_path}` : null,
      colors:   (data as any).product_colors   ?? [],
      variants: (data as any).product_variants ?? [],
      created_at: (data as any).created_at,
      updated_at: (data as any).updated_at,
    },
  });
}
