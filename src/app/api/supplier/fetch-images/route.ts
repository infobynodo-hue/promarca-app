import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SUPPLIER_BASE = "https://catalogospromocionales.com/images/galeria";
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
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<FetchResult> {
  // Skip references with special characters or spaces
  if (!reference || /[\s<>{}|\\^`]/.test(reference)) {
    return { found: false, imagesCount: 0, reference, productId, productName, error: "Referencia inválida" };
  }

  const foundUrls: string[] = [];
  const refVariants = [reference.toUpperCase(), reference.toLowerCase()];

  for (const ref of refVariants) {
    if (foundUrls.length > 0) break; // Stop if we already found images with first variant

    // Try numbered gallery images
    for (let n = 1; n <= MAX_GALLERY_IMAGES; n++) {
      const url = `${SUPPLIER_BASE}/${ref}/${ref}-${n}.jpg`;
      const exists = await checkUrlExists(url);
      if (!exists) {
        // Also try starting at 2 if n=1 didn't work
        if (n === 1) {
          const url2 = `${SUPPLIER_BASE}/${ref}/${ref}-2.jpg`;
          const exists2 = await checkUrlExists(url2);
          if (!exists2) break; // No images at all with this variant
          // Start from 2
          foundUrls.push(url2);
          continue;
        }
        break; // Stop on first consecutive 404
      }
      foundUrls.push(url);
    }

    // Also try the unnumbered version
    const plainUrl = `${SUPPLIER_BASE}/${ref}/${ref}.jpg`;
    const plainExists = await checkUrlExists(plainUrl);
    if (plainExists) {
      foundUrls.push(plainUrl);
    }
  }

  if (foundUrls.length === 0) {
    return { found: false, imagesCount: 0, reference, productId, productName };
  }

  // Upload each image to Supabase storage and insert DB rows
  const insertedImages: { storage_path: string; is_primary: boolean; display_order: number; alt_text: string }[] = [];

  for (let i = 0; i < foundUrls.length; i++) {
    const url = foundUrls[i];
    const buffer = await fetchImageBuffer(url);
    if (!buffer) continue;

    const storagePath = `${productId}/${reference.toUpperCase()}-supplier-${i + 1}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("products")
      .upload(storagePath, buffer, { contentType: "image/jpeg", upsert: true });

    if (uploadError) {
      console.error(`Upload error for ${storagePath}:`, uploadError.message);
      continue;
    }

    insertedImages.push({
      storage_path: storagePath,
      is_primary: i === 0,
      display_order: i,
      alt_text: `${productName} - imagen ${i + 1}`,
    });
  }

  if (insertedImages.length === 0) {
    return { found: false, imagesCount: 0, reference, productId, productName, error: "Error al descargar imágenes" };
  }

  const { error: insertError } = await supabase.from("product_images").insert(
    insertedImages.map((img) => ({
      product_id: productId,
      storage_path: img.storage_path,
      is_primary: img.is_primary,
      display_order: img.display_order,
      alt_text: img.alt_text,
    }))
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
    const supabase = await createClient();

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
