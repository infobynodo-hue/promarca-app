import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getShopifyCredentials, syncProductToShopify } from "@/lib/shopify/sync";

export async function POST() {
  try {
    const supabase = await createClient();

    const credentials = await getShopifyCredentials(supabase);
    if (!credentials) {
      return NextResponse.json(
        { error: "Shopify no configurado. Ve a Integraciones → Shopify." },
        { status: 400 }
      );
    }

    // Fetch all active products that have images
    const { data: products, error } = await supabase
      .from("products")
      .select("id, name, reference, product_images(storage_path)")
      .eq("is_active", true)
      .order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const details: Array<{
      productId: string;
      name?: string;
      ok: boolean;
      shopifyUrl?: string;
      error?: string;
    }> = [];

    let synced = 0;
    let errors = 0;

    for (const product of products ?? []) {
      const result = await syncProductToShopify(product.id, supabase, credentials);
      if (result.ok) {
        synced++;
        details.push({ productId: product.id, name: product.name, ok: true, shopifyUrl: result.shopifyUrl });
      } else {
        errors++;
        details.push({ productId: product.id, name: product.name, ok: false, error: result.error });
      }
    }

    return NextResponse.json({ synced, errors, details });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
