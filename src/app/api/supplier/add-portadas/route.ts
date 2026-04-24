import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PRODUCTS_BASE = "https://catalogospromocionales.com/images/productos";
const FETCH_TIMEOUT_MS = 8000;

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

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createAdminClient();
    const offset: number = body.offset ?? 0;
    const limit: number  = body.limit  ?? 20;

    // 1. Get all products that have images but NO principal image
    //    We detect missing portada by checking: none of their images has
    //    a storage_path ending in '-principal.jpg'
    const { data: productsWithImages } = await supabase
      .from("product_images")
      .select("product_id, storage_path")
      .order("product_id");

    if (!productsWithImages) {
      return NextResponse.json({ error: "No se pudieron cargar imágenes" }, { status: 500 });
    }

    // Group by product_id to find which products already have a portada
    const byProduct = new Map<string, string[]>();
    for (const row of productsWithImages) {
      const arr = byProduct.get(row.product_id) ?? [];
      arr.push(row.storage_path);
      byProduct.set(row.product_id, arr);
    }

    // Products that have images but no '-principal.jpg' yet
    const needsPortada = [...byProduct.entries()]
      .filter(([, paths]) => !paths.some(p => p.endsWith("-principal.jpg")))
      .map(([productId]) => productId);

    const total = needsPortada.length;
    const slice = needsPortada.slice(offset, offset + limit);

    if (slice.length === 0) {
      return NextResponse.json({ processed: 0, total, offset, nextOffset: null, added: 0, skipped: 0, details: [] });
    }

    // 2. Fetch product details (reference, name) for this slice
    const { data: products } = await supabase
      .from("products")
      .select("id, reference, name")
      .in("id", slice);

    if (!products) {
      return NextResponse.json({ error: "No se pudieron cargar productos" }, { status: 500 });
    }

    // 3. Process each product
    const details: { productId: string; reference: string; status: "added" | "not_found" | "download_failed" | "upload_failed" | "db_failed" }[] = [];
    let added = 0, skipped = 0;

    for (const product of products) {
      const ref = product.reference.toUpperCase();

      // Look up supplier_id from cache (exact reference match first)
      let supplierId: string | null = null;

      try {
        const { data: cacheRow } = await supabase
          .from("supplier_product_cache")
          .select("page_url, supplier_id")
          .eq("reference", ref)
          .maybeSingle();

        if (cacheRow) {
          supplierId = cacheRow.supplier_id ??
            cacheRow.page_url?.match(/\/p\/[^/]+\/(\d+)\//)?.[1] ?? null;
        }
      } catch { /* ignore */ }

      // Fallback: name-based search
      if (!supplierId) {
        try {
          const SKIP_WORDS = new Set(['lapicero', 'boligrafo', 'bolígrafo', 'sombrilla',
            'lapiz', 'lápiz', 'tarro', 'tula', 'mochila', 'gorra', 'termo', 'mug', 'poncho']);
          const words = product.name.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2 && !SKIP_WORDS.has(w));
          const keyword = words[0] ?? product.name.split(' ')[1] ?? product.name;

          if (keyword) {
            const { data: nameMatches } = await supabase
              .from("supplier_product_cache")
              .select("supplier_id, supplier_name")
              .ilike("supplier_name", `%${keyword}%`)
              .order("supplier_id", { ascending: false })
              .limit(5);

            const best = nameMatches?.find((m: { supplier_id: string; supplier_name: string }) =>
              product.name.toLowerCase().split(' ').some((w: string) => w.length > 3 &&
                m.supplier_name.toLowerCase().includes(w))
            ) ?? nameMatches?.[0];

            if (best?.supplier_id) supplierId = best.supplier_id;
          }
        } catch { /* ignore */ }
      }

      if (!supplierId) {
        details.push({ productId: product.id, reference: ref, status: "not_found" });
        skipped++;
        continue;
      }

      // Check portada URL exists
      const portadaUrl = `${PRODUCTS_BASE}/${supplierId}.jpg`;
      const exists = await checkUrlExists(portadaUrl);
      if (!exists) {
        details.push({ productId: product.id, reference: ref, status: "not_found" });
        skipped++;
        continue;
      }

      // Download portada
      const buffer = await fetchImageBuffer(portadaUrl);
      if (!buffer) {
        details.push({ productId: product.id, reference: ref, status: "download_failed" });
        skipped++;
        continue;
      }

      // Upload to Storage
      const storagePath = `${product.id}/${ref}-principal.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("products")
        .upload(storagePath, buffer, { contentType: "image/jpeg", upsert: true });

      if (uploadError) {
        details.push({ productId: product.id, reference: ref, status: "upload_failed" });
        skipped++;
        continue;
      }

      // Shift existing images: unmark all current is_primary, bump display_order by 1
      await supabase
        .from("product_images")
        .update({ is_primary: false })
        .eq("product_id", product.id);

      // Shift display_order of existing images up by 1 (portada will be 0)
      // We need to do this manually per row since Supabase doesn't support column arithmetic in update
      const { data: existingImages } = await supabase
        .from("product_images")
        .select("id, display_order")
        .eq("product_id", product.id)
        .order("display_order");

      if (existingImages) {
        // Update from highest to lowest to avoid unique constraint issues
        for (const img of [...existingImages].reverse()) {
          await supabase
            .from("product_images")
            .update({ display_order: img.display_order + 1 })
            .eq("id", img.id);
        }
      }

      // Insert portada as display_order=0, is_primary=true
      const { error: insertError } = await supabase
        .from("product_images")
        .insert({
          product_id: product.id,
          storage_path: storagePath,
          is_primary: true,
          display_order: 0,
          alt_text: product.name,
        });

      if (insertError) {
        details.push({ productId: product.id, reference: ref, status: "db_failed" });
        skipped++;
        continue;
      }

      details.push({ productId: product.id, reference: ref, status: "added" });
      added++;
    }

    const nextOffset = offset + slice.length < total ? offset + limit : null;

    return NextResponse.json({
      processed: slice.length,
      total,
      offset,
      nextOffset,
      added,
      skipped,
      details,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
