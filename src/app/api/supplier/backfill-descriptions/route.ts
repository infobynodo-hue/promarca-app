import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();

    // Get all products without description that have a match in cache
    const { data: products, error: prodError } = await supabase
      .from("products")
      .select("id, reference")
      .or("description.is.null,description.eq.")
      .eq("is_active", true);

    if (prodError) {
      return NextResponse.json({ error: prodError.message }, { status: 500 });
    }

    const refs = (products ?? []).map((p) => p.reference.toUpperCase());
    if (refs.length === 0) {
      return NextResponse.json({ updated: 0, message: "Todos los productos ya tienen descripción" });
    }

    // Fetch matching cache entries with descriptions
    const { data: cacheEntries, error: cacheError } = await supabase
      .from("supplier_product_cache")
      .select("reference, description")
      .in("reference", refs)
      .not("description", "is", null)
      .neq("description", "");

    if (cacheError) {
      return NextResponse.json({ error: cacheError.message }, { status: 500 });
    }

    const cacheMap = new Map(
      (cacheEntries ?? []).map((e) => [e.reference.toUpperCase(), e.description])
    );

    let updated = 0;
    const errors: string[] = [];

    for (const product of products ?? []) {
      const description = cacheMap.get(product.reference.toUpperCase());
      if (!description) continue;

      const { error: updateError } = await supabase
        .from("products")
        .update({ description })
        .eq("id", product.id);

      if (updateError) {
        errors.push(`${product.reference}: ${updateError.message}`);
      } else {
        updated++;
      }
    }

    return NextResponse.json({
      updated,
      total: products?.length ?? 0,
      cached: cacheMap.size,
      errors: errors.slice(0, 20),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
