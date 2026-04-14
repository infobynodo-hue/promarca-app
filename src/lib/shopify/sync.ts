import { SupabaseClient } from "@supabase/supabase-js";

export interface ShopifyCredentials {
  storeDomain: string;
  accessToken: string;
}

export interface SyncResult {
  ok: boolean;
  shopifyUrl?: string;
  shopifyId?: string;
  error?: string;
}

export async function getShopifyCredentials(
  supabase: SupabaseClient
): Promise<ShopifyCredentials | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["shopify_store_domain", "shopify_access_token"]);

  if (error || !data || data.length < 2) return null;

  const map = Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value]));
  const storeDomain = map["shopify_store_domain"];
  const accessToken = map["shopify_access_token"];

  if (!storeDomain || !accessToken) return null;

  return { storeDomain, accessToken };
}

export async function syncProductToShopify(
  productId: string,
  supabase: SupabaseClient,
  credentials: ShopifyCredentials
): Promise<SyncResult> {
  // Fetch product with images and category
  const { data: product, error: prodError } = await supabase
    .from("products")
    .select("*, category:categories(name), product_images(storage_path, is_primary, display_order)")
    .eq("id", productId)
    .single();

  if (prodError || !product) {
    return { ok: false, error: "Producto no encontrado" };
  }

  // Build public image URLs
  const sortedImages = ((product.product_images ?? []) as Array<{
    storage_path: string;
    is_primary: boolean;
    display_order: number;
  }>).sort((a, b) => {
    if (a.is_primary) return -1;
    if (b.is_primary) return 1;
    return a.display_order - b.display_order;
  });

  const images = sortedImages.map((img) => ({
    src: supabase.storage.from("products").getPublicUrl(img.storage_path).data.publicUrl,
  }));

  const categoryName = (product.category as { name: string } | null)?.name ?? "";

  const shopifyPayload = {
    product: {
      title: product.name,
      body_html: product.description || product.name,
      vendor: "ProMarca",
      product_type: categoryName,
      tags: [product.reference],
      variants: [
        {
          price: String(product.price),
          sku: product.reference,
          inventory_management: null,
        },
      ],
      images,
    },
  };

  // Check if already synced
  const { data: existingSync } = await supabase
    .from("shopify_syncs")
    .select("id, shopify_id")
    .eq("product_id", productId)
    .maybeSingle();

  const { storeDomain, accessToken } = credentials;
  let shopifyResponse: Response;
  let method: string;
  let url: string;

  if (existingSync?.shopify_id) {
    method = "PUT";
    url = `https://${storeDomain}/admin/api/2024-01/products/${existingSync.shopify_id}.json`;
  } else {
    method = "POST";
    url = `https://${storeDomain}/admin/api/2024-01/products.json`;
  }

  try {
    shopifyResponse = await fetch(url, {
      method,
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(shopifyPayload),
    });
  } catch (fetchError) {
    const errMsg = fetchError instanceof Error ? fetchError.message : "Error de red";
    await upsertShopifySync(supabase, productId, existingSync?.id, null, "error", errMsg);
    return { ok: false, error: errMsg };
  }

  const responseData = await shopifyResponse.json();

  if (!shopifyResponse.ok) {
    const errMsg =
      responseData?.errors
        ? JSON.stringify(responseData.errors)
        : `Shopify error ${shopifyResponse.status}`;
    await upsertShopifySync(supabase, productId, existingSync?.id, null, "error", errMsg);
    return { ok: false, error: errMsg };
  }

  const shopifyProduct = responseData.product;
  const shopifyId = String(shopifyProduct.id);
  const shopifyHandle = shopifyProduct.handle;
  const shopifyUrl = `https://${storeDomain}/products/${shopifyHandle}`;

  await upsertShopifySync(
    supabase,
    productId,
    existingSync?.id,
    shopifyId,
    "synced",
    null,
    shopifyHandle,
    shopifyUrl
  );

  return { ok: true, shopifyUrl, shopifyId };
}

async function upsertShopifySync(
  supabase: SupabaseClient,
  productId: string,
  existingSyncId: string | undefined,
  shopifyId: string | null,
  status: "synced" | "error",
  errorMessage: string | null,
  shopifyHandle?: string,
  shopifyUrl?: string
) {
  const now = new Date().toISOString();

  if (existingSyncId) {
    await supabase
      .from("shopify_syncs")
      .update({
        shopify_id: shopifyId ?? undefined,
        shopify_handle: shopifyHandle ?? undefined,
        shopify_url: shopifyUrl ?? undefined,
        status,
        last_synced_at: now,
        error_message: errorMessage,
      })
      .eq("id", existingSyncId);
  } else {
    await supabase.from("shopify_syncs").insert({
      product_id: productId,
      shopify_id: shopifyId,
      shopify_handle: shopifyHandle ?? null,
      shopify_url: shopifyUrl ?? null,
      status,
      last_synced_at: now,
      error_message: errorMessage,
    });
  }
}
