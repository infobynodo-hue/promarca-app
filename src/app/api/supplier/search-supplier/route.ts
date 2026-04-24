import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const SUPPLIER_BASE = "https://www.catalogospromocionales.com";
const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept-Language": "es-CO,es;q=0.9",
};

export interface SupplierSearchResult {
  supplier_id: number;
  reference: string;
  name: string;
  thumbnail_url: string;
  category_id: number;
  slug: string;
  page_url: string;
  already_imported: boolean;
  existing_product_id?: string;
}

// Strip accents, replace spaces, lowercase. Matches supplier URL slug conventions.
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Parses product cards from a supplier listing page.
 * Each card looks like:
 *   <div class="itemProducto-..." rel='product-slug'>
 *     <a class="img-producto" href="/p/{slug}/{id}/{catId}">
 *       <img src="//catalogospromocionales.com/images/productos/{id}.jpg">
 *     </a>
 *     <h3>Product Name</h3>
 *     <p class="ref textoColor">REF-123</p>
 *   </div>
 */
function parseProductCards(html: string): Omit<SupplierSearchResult, "already_imported" | "existing_product_id">[] {
  const products: Omit<SupplierSearchResult, "already_imported" | "existing_product_id">[] = [];
  const seen = new Set<number>();

  // Find each card's start, then grab until next card or until paging wrap
  const cardStarts: { slug: string; start: number }[] = [];
  const startPattern = /<div class="itemProducto-[^"]*"[^>]*rel=['"]([^'"]+)['"]>/gi;
  let startMatch: RegExpExecArray | null;
  while ((startMatch = startPattern.exec(html)) !== null) {
    cardStarts.push({ slug: startMatch[1], start: startMatch.index });
  }

  for (let i = 0; i < cardStarts.length; i++) {
    const slug = cardStarts[i].slug;
    const cardStart = cardStarts[i].start;
    const cardEnd = i + 1 < cardStarts.length
      ? cardStarts[i + 1].start
      : (html.indexOf("PagingWrap", cardStart) > 0 ? html.indexOf("PagingWrap", cardStart) : html.length);
    const cardHtml = html.slice(cardStart, cardEnd);

    // Extract product URL /p/{slug}/{id}/{catId}
    const urlMatch = cardHtml.match(/href=["']\/p\/[^\/]+\/(\d+)\/(\d+)["']/);
    if (!urlMatch) continue;
    const supplier_id = parseInt(urlMatch[1], 10);
    const category_id = parseInt(urlMatch[2], 10);
    if (seen.has(supplier_id)) continue;
    seen.add(supplier_id);

    // Image
    const imgMatch = cardHtml.match(/<img[^>]+src=["']([^"']+\/productos\/\d+\.jpg)["']/);
    const thumbnail_url = imgMatch
      ? imgMatch[1].startsWith("//")
        ? "https:" + imgMatch[1]
        : imgMatch[1]
      : `${SUPPLIER_BASE}/images/productos/${supplier_id}.jpg`;

    // Name
    const nameMatch = cardHtml.match(/<h3>([\s\S]*?)(?:<a|<\/h3>)/);
    const name = nameMatch
      ? nameMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
      : slug.replace(/-/g, " ");

    // Reference
    const refMatch = cardHtml.match(/<p class="ref[^"]*">([\s\S]*?)<\/p>/);
    const reference = refMatch ? refMatch[1].replace(/<[^>]+>/g, "").trim() : "";

    if (!reference) continue;

    products.push({
      supplier_id,
      reference,
      name: decodeHtmlEntities(name),
      thumbnail_url,
      category_id,
      slug,
      page_url: `${SUPPLIER_BASE}/p/${slug}/${supplier_id}/${category_id}`,
    });
  }

  return products;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&aacute;/g, "á").replace(/&eacute;/g, "é").replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó").replace(/&uacute;/g, "ú").replace(/&ntilde;/g, "ñ")
    .replace(/&Aacute;/g, "Á").replace(/&Eacute;/g, "É").replace(/&Iacute;/g, "Í")
    .replace(/&Oacute;/g, "Ó").replace(/&Uacute;/g, "Ú").replace(/&Ntilde;/g, "Ñ")
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#39;/g, "'");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Falta parámetro 'q'" }, { status: 400 });
  }

  const slug = slugify(query);
  if (!slug) {
    return NextResponse.json({ error: "Búsqueda inválida" }, { status: 400 });
  }

  // Try multiple URL patterns the supplier uses for category listings
  const candidateUrls = [
    `${SUPPLIER_BASE}/promocionales/variedades-${slug}.html`,
    `${SUPPLIER_BASE}/promocionales/${slug}.html`,
  ];

  let html: string | null = null;
  let matchedUrl = "";

  for (const url of candidateUrls) {
    html = await fetchHtml(url);
    if (html && html.includes("itemProducto-")) {
      matchedUrl = url;
      break;
    }
    html = null;
  }

  if (!html) {
    return NextResponse.json({
      query,
      slug,
      tried: candidateUrls,
      results: [],
      message: `No se encontró una categoría del proveedor con "${query}". Prueba otro término o sé más específico.`,
    });
  }

  const rawProducts = parseProductCards(html);

  // Check which already exist in our catalog
  const supabase = createAdminClient();
  const references = rawProducts.map((p) => p.reference);
  const { data: existing } = await supabase
    .from("products")
    .select("id, reference")
    .in("reference", references);

  const existingMap = new Map((existing ?? []).map((p) => [p.reference, p.id]));

  const results: SupplierSearchResult[] = rawProducts.map((p) => ({
    ...p,
    already_imported: existingMap.has(p.reference),
    existing_product_id: existingMap.get(p.reference),
  }));

  return NextResponse.json({
    query,
    slug,
    matched_url: matchedUrl,
    total: results.length,
    new_count: results.filter((r) => !r.already_imported).length,
    existing_count: results.filter((r) => r.already_imported).length,
    results,
  });
}
