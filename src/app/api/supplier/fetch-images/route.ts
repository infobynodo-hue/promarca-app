import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const GALLERY_BASE  = "https://catalogospromocionales.com/images/galeria";
const PRODUCTS_BASE = "https://catalogospromocionales.com/images/productos";
const MAX_GALLERY_IMAGES = 12;
const FETCH_TIMEOUT_MS = 8000;

// ─── Reason codes — shown directly in the UI ──────────────────────────────────
export type FailReason =
  | "ref_invalid"          // referencia con caracteres especiales o vacía
  | "no_cache_match"       // no está en el índice del proveedor
  | "no_gallery_images"    // el proveedor no tiene fotos en la galería
  | "download_failed"      // se encontraron URLs pero no se pudo descargar
  | "upload_failed"        // se descargó pero Supabase Storage rechazó el upload
  | "db_insert_failed"     // imágenes subidas pero falló el INSERT en product_images
  | "unknown";

export interface FetchResult {
  found: boolean;
  imagesCount: number;
  reference: string;
  productId: string;
  productName: string;
  descriptionUpdated?: boolean;
  // When found === false, these explain exactly why:
  failReason?: FailReason;
  failDetail?: string; // extra context (e.g. the URL that failed, the DB error message)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function checkUrlExists(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, { method: "HEAD", signal: controller.signal, next: { revalidate: 0 } });
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
    const res = await fetch(url, { signal: controller.signal, next: { revalidate: 0 } });
    clearTimeout(timer);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// ─── Core fetch logic ─────────────────────────────────────────────────────────

async function fetchImagesForProduct(
  productId: string,
  reference: string,
  productName: string,
  supabase: ReturnType<typeof createAdminClient>
): Promise<FetchResult> {

  // 1. Validate reference ────────────────────────────────────────────────────
  if (!reference || /[<>{}|\\^`]/.test(reference)) {
    return {
      found: false, imagesCount: 0, reference, productId, productName,
      failReason: "ref_invalid",
      failDetail: `Referencia con caracteres no válidos`,
    };
  }

  const ref = reference.toUpperCase();

  // Helper — builds a safe gallery URL regardless of spaces or special chars
  const galleryUrl = (variant: string, suffix: string) =>
    `${GALLERY_BASE}/${encodeURIComponent(variant)}/${encodeURIComponent(variant)}${suffix}`;

  // 2. Look up supplier cache for the numeric product ID (exact match) ───────
  // Note: productos/{id}.jpg is a low-res thumbnail (~30KB) used by the supplier
  // for category listings — NOT the main product photo. We store the ID so we can
  // use it as a last resort if no gallery images exist.
  let fallbackMainUrl: string | null = null;
  let foundInCache = false;

  try {
    const { data: cacheRow } = await supabase
      .from("supplier_product_cache")
      .select("page_url, supplier_id")
      .eq("reference", ref)
      .maybeSingle();

    if (cacheRow?.page_url) {
      foundInCache = true;
      const id = cacheRow.supplier_id ?? cacheRow.page_url.match(/\/p\/[^/]+\/(\d+)\//)?.[1];
      if (id) {
        const candidate = `${PRODUCTS_BASE}/${id}.jpg`;
        if (await checkUrlExists(candidate)) fallbackMainUrl = candidate;
      }
    }
  } catch { /* ignore */ }

  // 3. Collect gallery images — try multiple reference format variants ────────
  // The supplier's gallery folder can use the original reference (with spaces),
  // URL-encoded, or with spaces replaced by dashes. We try all combinations.
  const galleryUrls: string[] = [];

  const refVariants = [...new Set([
    ref,                                          // SO-66 / PETRUS BOL (original uppercase)
    reference.toLowerCase(),                       // so-66 / petrus bol
    ref.replace(/\s+/g, '-'),                      // PETRUS-BOL / ELLISON-SO
    reference.toLowerCase().replace(/\s+/g, '-'),  // petrus-bol / ellison-so
  ])];

  for (const variant of refVariants) {
    if (galleryUrls.length > 0) break;

    // Probe starting index: supplier uses -2 most often, -1 sometimes
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

    // Some products have an unnumbered plain REF.jpg
    const plain = galleryUrl(variant, '.jpg');
    if (await checkUrlExists(plain)) galleryUrls.push(plain);
  }

  // 4. Name-based cache fallback ────────────────────────────────────────────
  // When gallery is empty AND no exact cache match: search by supplier_name
  // to get supplier_id → fallback thumbnail (productos/{id}.jpg).
  if (galleryUrls.length === 0 && !foundInCache) {
    try {
      const SKIP_WORDS = new Set(['lapicero', 'boligrafo', 'bolígrafo', 'sombrilla',
        'lapiz', 'lápiz', 'tarro', 'tula', 'mochila', 'gorra', 'termo', 'mug', 'poncho']);
      const words = productName.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !SKIP_WORDS.has(w));
      const keyword = words[0] ?? productName.split(' ')[1] ?? productName;

      if (keyword) {
        const { data: nameMatches } = await supabase
          .from("supplier_product_cache")
          .select("supplier_id, supplier_name")
          .ilike("supplier_name", `%${keyword}%`)
          .order("supplier_id", { ascending: false })
          .limit(5);

        const best = nameMatches?.find(m =>
          productName.toLowerCase().split(' ').some(w => w.length > 3 &&
            m.supplier_name.toLowerCase().includes(w))
        ) ?? nameMatches?.[0];

        if (best?.supplier_id) {
          const candidate = `${PRODUCTS_BASE}/${best.supplier_id}.jpg`;
          if (await checkUrlExists(candidate)) {
            fallbackMainUrl = candidate;
            foundInCache = true;
          }
        }
      }
    } catch { /* non-critical */ }
  }

  // 5. Still nothing found ───────────────────────────────────────────────────
  if (galleryUrls.length === 0 && !fallbackMainUrl) {
    return {
      found: false, imagesCount: 0, reference, productId, productName,
      failReason: foundInCache ? "no_gallery_images" : "no_cache_match",
      failDetail: `No se encontraron imágenes para "${ref}"`,
    };
  }

  // 6. Build ordered list — gallery first (matches supplier display order) ──
  // The supplier shows gallery images (-2, -3, -4...) as the primary photos.
  // productos/{id}.jpg is a low-res thumbnail used only as fallback when
  // no gallery images exist.
  const orderedUrls: { url: string; isPrimary: boolean; label: string }[] = [];

  if (galleryUrls.length > 0) {
    // Gallery images in order: first one is primary
    galleryUrls.forEach((url, i) =>
      orderedUrls.push({ url, isPrimary: i === 0, label: `galeria-${i + 1}` })
    );
  } else if (fallbackMainUrl) {
    // No gallery: use thumbnail as sole image
    orderedUrls.push({ url: fallbackMainUrl, isPrimary: true, label: "principal" });
  }

  // 7. Download & upload ────────────────────────────────────────────────────
  const insertedImages: { storage_path: string; is_primary: boolean; display_order: number; alt_text: string }[] = [];
  const downloadFailed: string[] = [];
  const uploadFailed: string[] = [];

  for (let i = 0; i < orderedUrls.length; i++) {
    const { url, isPrimary, label } = orderedUrls[i];
    const buffer = await fetchImageBuffer(url);
    if (!buffer) {
      downloadFailed.push(url);
      continue;
    }

    const storagePath = `${productId}/${ref}-${label}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("products")
      .upload(storagePath, buffer, { contentType: "image/jpeg", upsert: true });

    if (uploadError) {
      uploadFailed.push(`${storagePath}: ${uploadError.message}`);
      continue;
    }

    insertedImages.push({
      storage_path: storagePath,
      is_primary: isPrimary,
      display_order: i,
      alt_text: `${productName}${label === "principal" ? "" : ` - imagen ${i}`}`,
    });
  }

  // Distinguish between download vs upload failures
  if (insertedImages.length === 0) {
    if (uploadFailed.length > 0) {
      return {
        found: false, imagesCount: 0, reference, productId, productName,
        failReason: "upload_failed",
        failDetail: `Se encontraron ${orderedUrls.length} imagen(es) pero el almacenamiento rechazó el upload. ` +
          `Primer error: ${uploadFailed[0]}`,
      };
    }
    return {
      found: false, imagesCount: 0, reference, productId, productName,
      failReason: "download_failed",
      failDetail: `Se encontraron ${orderedUrls.length} URL(s) de imagen pero ninguna se pudo descargar. ` +
        `Puede ser un problema temporal de red o que el proveedor bloquee las peticiones automáticas. ` +
        `Primera URL fallida: ${downloadFailed[0] ?? "desconocida"}`,
    };
  }

  // 8. Save to DB ───────────────────────────────────────────────────────────
  await supabase.from("product_images").update({ is_primary: false }).eq("product_id", productId);

  let primaryAssigned = false;
  const { error: insertError } = await supabase.from("product_images").insert(
    insertedImages.map((img) => {
      const shouldBePrimary = img.is_primary && !primaryAssigned;
      if (shouldBePrimary) primaryAssigned = true;
      return { product_id: productId, ...img, is_primary: shouldBePrimary };
    })
  );

  if (insertError) {
    return {
      found: false, imagesCount: 0, reference, productId, productName,
      failReason: "db_insert_failed",
      failDetail: `Las imágenes se subieron a Storage correctamente pero falló el registro en la BD: ${insertError.message}`,
    };
  }

  // 9. Backfill description from cache ──────────────────────────────────────
  let descriptionUpdated = false;
  try {
    const { data: cacheEntry } = await supabase
      .from("supplier_product_cache").select("description").eq("reference", ref).maybeSingle();

    if (cacheEntry?.description) {
      const { data: productRow } = await supabase
        .from("products").select("description").eq("id", productId).maybeSingle();

      if (!productRow?.description) {
        const { error: updateError } = await supabase
          .from("products").update({ description: cacheEntry.description }).eq("id", productId);
        if (!updateError) descriptionUpdated = true;
      }
    }
  } catch { /* non-critical */ }

  return { found: true, imagesCount: insertedImages.length, reference, productId, productName, descriptionUpdated };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createAdminClient();

    // Single product mode
    if (body.productId && !body.all) {
      const { data: product, error: productError } = await supabase
        .from("products").select("id, reference, name").eq("id", body.productId).single();

      if (productError || !product)
        return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

      const result = await fetchImagesForProduct(product.id, product.reference, product.name, supabase);
      return NextResponse.json(result);
    }

    // Batch mode
    if (body.batch === true) {
      const offset: number = body.offset ?? 0;
      const limit: number  = body.limit  ?? 20;

      const { data: products } = await supabase
        .from("products").select("id, reference, name").eq("is_active", true).order("reference");

      const { data: imagesData } = await supabase.from("product_images").select("product_id");
      const withImgSet = new Set((imagesData ?? []).map((r) => r.product_id));
      const allWithout = (products ?? []).filter((p) => !withImgSet.has(p.id));
      const total      = allWithout.length;
      const slice      = allWithout.slice(offset, offset + limit);

      const details: FetchResult[] = [];
      let withImages = 0, noImages = 0;

      for (const product of slice) {
        const result = await fetchImagesForProduct(product.id, product.reference, product.name, supabase);
        details.push(result);
        if (result.found) withImages++; else noImages++;
      }

      return NextResponse.json({
        processed: slice.length, total, offset,
        nextOffset: offset + slice.length < total ? offset + limit : null,
        withImages, noImages, details,
      });
    }

    if (body.all === true)
      return NextResponse.json({ error: "Usa batch:true con offset/limit para evitar timeouts" }, { status: 400 });

    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
