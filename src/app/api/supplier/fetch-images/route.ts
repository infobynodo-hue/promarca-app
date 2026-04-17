import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const GALLERY_BASE  = "https://catalogospromocionales.com/images/galeria";
const PRODUCTS_BASE = "https://catalogospromocionales.com/images/productos";
const MAX_GALLERY_IMAGES = 12;
const FETCH_TIMEOUT_MS = 8000;

interface FetchResult {
  found: boolean;
  imagesCount: number;
  reference: string;
  productId: string;
  productName: string;
  descriptionUpdated?: boolean;
  error?: string;
}

async function checkUrlExists(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      next: { revalidate: 0 },
    });
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
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 0 },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

async function fetchImagesForProduct(
  productId: string,
  reference: string,
  productName: string,
  supabase: ReturnType<typeof createAdminClient>
): Promise<FetchResult> {
  // Skip references with special characters or spaces
  if (!reference || /[\s<>{}|\\^`]/.test(reference)) {
    return { found: false, imagesCount: 0, reference, productId, productName, error: "Referencia inválida" };
  }

  const ref = reference.toUpperCase();

  // ── 1. Look up supplier cache to get the numeric product ID ──
  // page_url format: https://catalogospromocionales.com/p/slug/10852/9 → ID = 10852
  let mainImageUrl: string | null = null;
  try {
    const { data: cacheRow } = await supabase
      .from("supplier_product_cache")
      .select("page_url")
      .eq("reference", ref)
      .maybeSingle();

    if (cacheRow?.page_url) {
      const m = cacheRow.page_url.match(/\/p\/[^/]+\/(\d+)\//);
      if (m) {
        const candidate = `${PRODUCTS_BASE}/${m[1]}.jpg`;
        if (await checkUrlExists(candidate)) mainImageUrl = candidate;
      }
    }
  } catch { /* ignore */ }

  // ── 2. Collect gallery images in order ──
  // Gallery images on catalogospromocionales.com start at -2 (not -1).
  // We probe 2 first, then 1 as a rare fallback.
  const galleryUrls: string[] = [];
  const refVariants = [ref, reference.toLowerCase()];

  for (const variant of refVariants) {
    if (galleryUrls.length > 0) break;

    const startCandidates = [2, 1];
    let startN: number | null = null;
    for (const n of startCandidates) {
      if (await checkUrlExists(`${GALLERY_BASE}/${variant}/${variant}-${n}.jpg`)) {
        startN = n; break;
      }
    }

    if (startN !== null) {
      for (let n = startN; n <= startN + MAX_GALLERY_IMAGES; n++) {
        const url = `${GALLERY_BASE}/${variant}/${variant}-${n}.jpg`;
        if (!(await checkUrlExists(url))) break;
        galleryUrls.push(url);
      }
    }

    // Some products also have an unnumbered REF.jpg
    const plain = `${GALLERY_BASE}/${variant}/${variant}.jpg`;
    if (await checkUrlExists(plain)) galleryUrls.push(plain);
  }

  // ── 3. Build final ordered list: main image first, then gallery ──
  // This mirrors exactly what the supplier shows on their product page.
  const orderedUrls: { url: string; isPrimary: boolean; label: string }[] = [];

  if (mainImageUrl) {
    orderedUrls.push({ url: mainImageUrl, isPrimary: true, label: "principal" });
  }
  galleryUrls.forEach((url, i) => {
    orderedUrls.push({
      url,
      isPrimary: !mainImageUrl && i === 0, // primary only if no main image
      label: `galeria-${i + 1}`,
    });
  });

  if (orderedUrls.length === 0) {
    return { found: false, imagesCount: 0, reference, productId, productName };
  }

  // ── 4. Download & upload each image in order ──
  const insertedImages: { storage_path: string; is_primary: boolean; display_order: number; alt_text: string }[] = [];
  const uploadErrors: string[] = [];

  for (let i = 0; i < orderedUrls.length; i++) {
    const { url, isPrimary, label } = orderedUrls[i];
    const buffer = await fetchImageBuffer(url);
    if (!buffer) {
      console.error(`[fetch-images] Failed to download buffer from: ${url}`);
      continue;
    }

    const storagePath = `${productId}/${ref}-${label}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("products")
      .upload(storagePath, buffer, { contentType: "image/jpeg", upsert: true });

    if (uploadError) {
      const msg = `Upload error for ${storagePath}: ${uploadError.message}`;
      console.error(`[fetch-images] ${msg}`);
      uploadErrors.push(msg);
      continue;
    }

    insertedImages.push({
      storage_path: storagePath,
      is_primary: isPrimary,
      display_order: i,
      alt_text: `${productName}${label === "principal" ? "" : ` - imagen ${i}`}`,
    });
  }

  if (insertedImages.length === 0) {
    const errMsg = uploadErrors.length > 0
      ? `Error al subir imágenes: ${uploadErrors[0]}`
      : "Error al descargar imágenes";
    console.error(`[fetch-images] No images saved for ${reference} (${productId}): ${errMsg}`);
    return { found: false, imagesCount: 0, reference, productId, productName, error: errMsg };
  }

  // Clear any stale primary flags before inserting (prevents double-primary bug)
  await supabase.from("product_images").update({ is_primary: false }).eq("product_id", productId);

  // Ensure only ONE image in the batch has is_primary true
  let primaryAssigned = false;
  const { error: insertError } = await supabase.from("product_images").insert(
    insertedImages.map((img) => {
      const shouldBePrimary = img.is_primary && !primaryAssigned;
      if (shouldBePrimary) primaryAssigned = true;
      return {
        product_id: productId,
        storage_path: img.storage_path,
        is_primary: shouldBePrimary,
        display_order: img.display_order,
        alt_text: img.alt_text,
      };
    })
  );

  if (insertError) {
    console.error(`Insert error for product ${productId}:`, insertError.message);
    return { found: false, imagesCount: 0, reference, productId, productName, error: insertError.message };
  }

  // After uploading images, check supplier_product_cache for a description to backfill
  let descriptionUpdated = false;
  try {
    const { data: cacheEntry } = await supabase
      .from("supplier_product_cache")
      .select("description")
      .eq("reference", reference.toUpperCase())
      .maybeSingle();

    if (cacheEntry?.description) {
      // Only update if our product has no description
      const { data: productRow } = await supabase
        .from("products")
        .select("description")
        .eq("id", productId)
        .maybeSingle();

      if (!productRow?.description) {
        const { error: updateError } = await supabase
          .from("products")
          .update({ description: cacheEntry.description })
          .eq("id", productId);

        if (!updateError) {
          descriptionUpdated = true;
        }
      }
    }
  } catch (descErr) {
    console.error("Error updating description from cache:", descErr);
  }

  return { found: true, imagesCount: insertedImages.length, reference, productId, productName, descriptionUpdated };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createAdminClient();

    // Single product mode
    if (body.productId && !body.all) {
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id, reference, name")
        .eq("id", body.productId)
        .single();

      if (productError || !product) {
        return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
      }

      const result = await fetchImagesForProduct(
        product.id,
        product.reference,
        product.name,
        supabase
      );

      return NextResponse.json(result);
    }

    // Batch mode: { batch: true, offset: 0, limit: 20 }
    if (body.batch === true) {
      const offset: number = body.offset ?? 0;
      const limit: number  = body.limit  ?? 20;

      // Get all products without images (sorted for stable pagination)
      const { data: products } = await supabase
        .from("products")
        .select("id, reference, name")
        .eq("is_active", true)
        .order("reference");

      const { data: imagesData } = await supabase
        .from("product_images")
        .select("product_id");

      const withImgSet = new Set((imagesData ?? []).map((r) => r.product_id));
      const allWithout = (products ?? []).filter((p) => !withImgSet.has(p.id));
      const total      = allWithout.length;
      const slice      = allWithout.slice(offset, offset + limit);

      const details: FetchResult[] = [];
      let withImages = 0, noImages = 0;

      for (const product of slice) {
        const result = await fetchImagesForProduct(
          product.id, product.reference, product.name, supabase
        );
        details.push(result);
        if (result.found) withImages++; else noImages++;
      }

      return NextResponse.json({
        processed: slice.length,
        total,
        offset,
        nextOffset: offset + slice.length < total ? offset + limit : null,
        withImages,
        noImages,
        details,
      });
    }

    // Legacy all mode (kept for compatibility)
    if (body.all === true) {
      return NextResponse.json(
        { error: "Usa batch:true con offset/limit para evitar timeouts" },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
