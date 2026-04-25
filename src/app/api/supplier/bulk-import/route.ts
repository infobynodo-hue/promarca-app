export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const SUPPLIER_BASE = "https://catalogospromocionales.com";
const GALLERY_BASE  = "https://catalogospromocionales.com/images/galeria";
const PRODUCTS_BASE = "https://catalogospromocionales.com/images/productos";
const MAX_GALLERY   = 12;
const FETCH_TIMEOUT = 10000;

const HEADERS = {
  "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept-Language": "es-CO,es;q=0.9",
};

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
    const res = await fetch(url, { headers: HEADERS, cache: "no-store", signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

async function headExists(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
    const res = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    clearTimeout(t);
    return res.status === 200;
  } catch { return false; }
}

async function fetchBuffer(url: string): Promise<Buffer | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; }
}

// ─── Supplier page parser ─────────────────────────────────────────────────────

interface Card { supplierId: number; reference: string; name: string; catId: number; slug: string; }

function parseCards(html: string): Card[] {
  const cards: Card[] = [];
  const seen = new Set<number>();
  const starts: { slug: string; start: number }[] = [];

  const sp = /<div class="itemProducto-[^"]*"[^>]*rel=['"]([^'"]+)['"]>/gi;
  let m: RegExpExecArray | null;
  while ((m = sp.exec(html)) !== null) starts.push({ slug: m[1], start: m.index });

  for (let i = 0; i < starts.length; i++) {
    const cardStart = starts[i].start;
    const cardEnd = i + 1 < starts.length
      ? starts[i + 1].start
      : (html.indexOf("PagingWrap", cardStart) > 0 ? html.indexOf("PagingWrap", cardStart) : html.length);
    const chunk = html.slice(cardStart, cardEnd);

    const urlM = chunk.match(/href=["']\/p\/[^\/]+\/(\d+)\/(\d+)["']/);
    const refM = chunk.match(/<p class="ref[^"]*">([\s\S]*?)<\/p>/);
    const nameM = chunk.match(/<h3>([\s\S]*?)(?:<a|<\/h3>)/);
    if (!urlM || !refM) continue;

    const supplierId = parseInt(urlM[1], 10);
    if (seen.has(supplierId)) continue;
    seen.add(supplierId);

    cards.push({
      supplierId,
      catId: parseInt(urlM[2], 10),
      reference: refM[1].replace(/<[^>]+>/g, "").trim(),
      name: decodeHtml(nameM ? nameM[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : starts[i].slug.replace(/-/g, " ")),
      slug: starts[i].slug,
    });
  }
  return cards;
}

function parseTotalPages(html: string): number {
  const ms = html.match(/[?&]Page=(\d+)/g);
  if (!ms) return 1;
  const ns = ms.map(s => parseInt(s.replace(/\D/g, ""), 10)).filter(Boolean);
  return ns.length ? Math.max(...ns) : 1;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&aacute;/g,"á").replace(/&eacute;/g,"é").replace(/&iacute;/g,"í")
    .replace(/&oacute;/g,"ó").replace(/&uacute;/g,"ú").replace(/&ntilde;/g,"ñ")
    .replace(/&Aacute;/g,"Á").replace(/&Eacute;/g,"É").replace(/&Iacute;/g,"Í")
    .replace(/&Oacute;/g,"Ó").replace(/&Uacute;/g,"Ú").replace(/&Ntilde;/g,"Ñ")
    .replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/&#39;/g,"'").replace(/&quot;/g,'"');
}

// ─── Image downloader ─────────────────────────────────────────────────────────

async function downloadImages(
  productId: string, reference: string, name: string, supplierId: number,
  supabase: ReturnType<typeof createAdminClient>
): Promise<number> {
  const ref = reference.toUpperCase();
  const gUrl = (v: string, s: string) =>
    `${GALLERY_BASE}/${encodeURIComponent(v)}/${encodeURIComponent(v)}${s}`;

  const portadaUrl = `${PRODUCTS_BASE}/${supplierId}.jpg`;
  const hasPortada = await headExists(portadaUrl);

  const galleryUrls: string[] = [];
  const variants = [...new Set([
    ref, reference.toLowerCase(),
    ref.replace(/\s+/g, "-"), reference.toLowerCase().replace(/\s+/g, "-"),
  ])];

  for (const v of variants) {
    if (galleryUrls.length) break;
    let start: number | null = null;
    for (const n of [2, 1]) {
      if (await headExists(gUrl(v, `-${n}.jpg`))) { start = n; break; }
    }
    if (start !== null) {
      for (let n = start; n <= start + MAX_GALLERY; n++) {
        const u = gUrl(v, `-${n}.jpg`);
        if (!(await headExists(u))) break;
        galleryUrls.push(u);
      }
    }
    const plain = gUrl(v, ".jpg");
    if (await headExists(plain)) galleryUrls.push(plain);
  }

  const ordered: { url: string; primary: boolean; label: string }[] = [];
  if (hasPortada) ordered.push({ url: portadaUrl, primary: true, label: "principal" });
  galleryUrls.forEach((u, i) =>
    ordered.push({ url: u, primary: !hasPortada && i === 0, label: `galeria-${i + 1}` })
  );
  if (!ordered.length) return 0;

  const toInsert: { storage_path: string; is_primary: boolean; display_order: number; alt_text: string }[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const buf = await fetchBuffer(ordered[i].url);
    if (!buf) continue;
    const path = `${productId}/${ref}-${ordered[i].label}.jpg`;
    const { error } = await supabase.storage.from("products").upload(path, buf, { contentType: "image/jpeg", upsert: true });
    if (error) continue;
    toInsert.push({ storage_path: path, is_primary: ordered[i].primary, display_order: i, alt_text: `${name}${ordered[i].label === "principal" ? "" : ` - imagen ${i}`}` });
  }
  if (!toInsert.length) return 0;

  let primarySet = false;
  await supabase.from("product_images").insert(
    toInsert.map(img => {
      const p = img.is_primary && !primarySet;
      if (p) primarySet = true;
      return { product_id: productId, ...img, is_primary: p };
    })
  );
  return toInsert.length;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      supplierCatId,      // number — supplier category ID
      promarcaCategoryId, // string — ProMarca category UUID
      fetchImages = true,
      page = 1,
    }: { supplierCatId: number; promarcaCategoryId: string; fetchImages?: boolean; page?: number } = body;

    if (!supplierCatId || !promarcaCategoryId)
      return NextResponse.json({ error: "Faltan supplierCatId o promarcaCategoryId" }, { status: 400 });

    const supabase = createAdminClient();

    // Verify ProMarca category exists
    const { data: cat } = await supabase.from("categories").select("id, name").eq("id", promarcaCategoryId).maybeSingle();
    if (!cat) return NextResponse.json({ error: "Categoría ProMarca no encontrada" }, { status: 404 });

    // Fetch supplier page
    const url = `${SUPPLIER_BASE}/Catalogo/Default.aspx?id=${supplierCatId}${page > 1 ? `&Page=${page}` : ""}`;
    const html = await fetchHtml(url);
    if (!html) return NextResponse.json({ error: `No se pudo cargar ${url}` }, { status: 502 });

    const totalPages = parseTotalPages(html);
    const cards = parseCards(html);

    if (!cards.length) {
      return NextResponse.json({ page, totalPages, processed: 0, created: 0, skipped: 0, images: 0, category: cat.name });
    }

    // Load existing references to avoid duplicates
    const refs = cards.map(c => c.reference);
    const { data: existing } = await supabase.from("products").select("id, reference").in("reference", refs);
    const existingSet = new Set((existing ?? []).map(p => p.reference));

    let created = 0, skipped = 0, totalImages = 0;
    const details: { ref: string; status: string }[] = [];

    for (const card of cards) {
      if (existingSet.has(card.reference)) {
        skipped++;
        details.push({ ref: card.reference, status: "exists" });
        continue;
      }

      // Upsert into supplier cache
      await supabase.from("supplier_product_cache").upsert({
        reference: card.reference, supplier_id: card.supplierId, supplier_name: card.name,
        category_id: card.catId,
        page_url: `${SUPPLIER_BASE}/p/${card.slug}/${card.supplierId}/${card.catId}`,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "reference" });

      // Insert product
      const { data: prod, error: insertErr } = await supabase.from("products").insert({
        reference: card.reference, name: card.name, category_id: promarcaCategoryId,
        price: 0, price_label: "A cotizar", is_active: true,
      }).select("id").single();

      if (insertErr || !prod) {
        details.push({ ref: card.reference, status: "failed" });
        continue;
      }

      let imgs = 0;
      if (fetchImages) {
        imgs = await downloadImages(prod.id, card.reference, card.name, card.supplierId, supabase);
        totalImages += imgs;
      }

      created++;
      details.push({ ref: card.reference, status: "created", ...(fetchImages ? { imgs } : {}) } as { ref: string; status: string });
    }

    return NextResponse.json({
      page, totalPages, nextPage: page < totalPages ? page + 1 : null,
      processed: cards.length, created, skipped,
      images: totalImages, category: cat.name,
      details,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error inesperado" }, { status: 500 });
  }
}
