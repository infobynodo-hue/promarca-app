import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getShopifyCredentials, syncProductToShopify } from "@/lib/shopify/sync";

export async function POST(request: NextRequest) {
  try {
    const { productId } = await request.json();

    if (!productId) {
      return NextResponse.json({ error: "productId es requerido" }, { status: 400 });
    }

    const supabase = await createClient();

    const credentials = await getShopifyCredentials(supabase);
    if (!credentials) {
      return NextResponse.json(
        { error: "Shopify no configurado. Ve a Integraciones → Shopify." },
        { status: 400 }
      );
    }

    const result = await syncProductToShopify(productId, supabase, credentials);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      shopifyUrl: result.shopifyUrl,
      shopifyId: result.shopifyId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
