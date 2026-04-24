import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

const GALLERY_BASE  = "https://catalogospromocionales.com/images/galeria";
const PRODUCTS_BASE = "https://catalogospromocionales.com/images/productos";
const MAX_GALLERY_IMAGES = 12;
const FETCH_TIMEOUT_MS = 8000;

interface ImportRequest {
  products: Array<{
    supplier_id: number;
    reference: string;
    name: string;
    category_id_supplier: number;
    slug: string;
    page_url: string;
  }>;
  target_category_id: string;      // ProMarca category UUID
  fetch_images: boolean;            // whether to download supplier images
}

interface ImportResultItem {
  reference: string;
  status: "created" | "exists" | "failed";
  product_id?: string;
  images_count?: number;
  detail?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function checkUrlExists(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, { method: "HEAD", signal: controller.signal });
    clearTimeout(timer);
    return res.status === 200;
  } catch {
    return false;
  }
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function downloadAndStoreImages(
  productId: string,
  reference: string,
  productName: string,
  supplierId: number,
  supabase: ReturnType<typeof createAdminClient>
): Promise<number> {
  const ref = reference.toUpperCase();

  const galleryUrl = (variant: string, suffix: string) =>
    `${GALLERY_BASE}/${encodeURIComponent(variant)}/${encodeURIComponent(variant)}${suffix}`;

  // 1. Portada (productos/{supplier_id}.jpg) — always the primary/first image
  const portadaUrl = `${PRODUCTS_BASE}/${supplierId}.jpg`;
  const portadaExists = await checkUrlExists(portadaUrl);

  // 2. Gallery images
  const galleryUrls: string[] = [];
  const refVariants = [...new Set([
    ref,
    reference.toLowerCase(),
    ref.replace(/\s+/g, "-"),
    reference.toLowerCase().replace(/\s+/g, "-"),
  ])];

  for (const variant of refVariants) {
    if (galleryUrls.length > 0) break;
    let startN: number | null = null;
    for (const n of [2, 1]) {
      if (await checkUrlExists(galleryUrl(variant, `-${n}.jpg`))) {
        startN = n; break;
      }
    }
    if (startN !== null) {
      for (let n = startN; n <= startN + MAX_GALLERY_IMAGES; n++) {
        const url = galleryUrl(variant, `-${n}.jpg`);
        if (!(await checkUrlExists(url))) break;
        galleryUrls.push(url);
      }
    }
    const plain = galleryUrl(variant, ".jpg");
    if (await checkUrlExists(plain)) galleryUrls.push(plain);
  }

  // Build ordered list: portada first, then gallery
  const orderedUrls: { url: string; isPrimary: boolean; label: string }[] = [];
  if (portadaExists) {
    orderedUrls.push({ url: portadaUrl, isPrimary: true, label: "principal" });
  }
  galleryUrls.forEach((url, i) =>
    orderedUrls.push({ url, isPrimary: !portadaExists && i === 0, label: `galeria-${i + 1}` })
  );

  if (orderedUrls.length === 0) return 0;

  // Download, upload, insert
  const insertedImages: { storage_path: string; is_primary: boolean; display_order: number; alt_text: string }[] = [];

  for (let i = 0; i < orderedUrls.length; i++) {
    const { url, isPrimary, label } = orderedUrls[i];
    const buffer = await fetchImageBuffer(url);
    if (!buffer) continue;

    const storagePath = `${productId}/${ref}-${label}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("products")
      .upload(storagePath, buffer, { contentType: "image/jpeg", upsert: true });
    if (uploadError) continue;

    insertedImages.push({
      storage_path: storagePath,
      is_primary: isPrimary,
      display_order: i,
      alt_text: `${productName}${label === "principal" ? "" : ` - imagen ${i}`}`,
    });
  }

  if (insertedImages.length === 0) return 0;

  let primaryAssigned = false;
  const { error: insertError } = await supabase.from("product_images").insert(
    insertedImages.map((img) => {
      const shouldBePrimary = img.is_primary && !primaryAssigned;
      if (shouldBePrimary) primaryAssigned = true;
      return { product_id: productId, ...img, is_primary: shouldBePrimary };
    })
  );

  if (insertError) return 0;
  return insertedImages.length;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: ImportRequest = await request.json();
    const { products, target_category_id, fetch_images } = body;

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: "No se especificaron productos" }, { status: 400 });
    }
    if (!target_category_id) {
      return NextResponse.json({ error: "Falta la categoría destino" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify target category exists
    const { data: category } = await supabase
      .from("categories").select("id, name").eq("id", target_category_id).maybeSingle();
    if (!category) {
      return NextResponse.json({ error: "Categoría destino no encontrada" }, { status: 404 });
    }

    const results: ImportResultItem[] = [];
    let created = 0, existed = 0, failed = 0, totalImages = 0;

    for (const p of products) {
      // Skip if already exists
      const { data: existing } = await supabase
        .from("products").select("id").eq("reference", p.reference).maybeSingle();

      if (existing) {
        results.push({ reference: p.reference, status: "exists", product_id: existing.id });
        existed++;
        continue;
      }

      // Upsert supplier cache (so future fetch-images works and we store the link)
      await supabase.from("supplier_product_cache").upsert(
        {
          reference: p.reference,
          supplier_id: p.supplier_id,
          supplier_name: p.name,
          category_id: p.category_id_supplier,
          page_url: p.page_url,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "reference" }
      );

      // Insert product
      const { data: created_product, error: insertError } = await supabase
        .from("products")
        .insert({
          reference: p.reference,
          name: p.name,
          category_id: target_category_id,
          price: 0,
          price_label: "A cotizar",
          is_active: true,
        })
        .select("id")
        .single();

      if (insertError || !created_product) {
        results.push({ reference: p.reference, status: "failed", detail: insertError?.message });
        failed++;
        continue;
      }

      let imagesCount = 0;
      if (fetch_images) {
        imagesCount = await downloadAndStoreImages(
          created_product.id, p.reference, p.name, p.supplier_id, supabase
        );
        totalImages += imagesCount;
      }

      results.push({
        reference: p.reference,
        status: "created",
        product_id: created_product.id,
        images_count: imagesCount,
      });
      created++;
    }

    return NextResponse.json({
      summary: {
        total: products.length,
        created,
        existed,
        failed,
        total_images_downloaded: totalImages,
        target_category: category.name,
      },
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
