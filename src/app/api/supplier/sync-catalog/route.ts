export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const SUPPLIER_BASE = "https://catalogospromocionales.com";
const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept-Language": "es-CO,es;q=0.9",
};
const REQUEST_DELAY_MS = 200;
const DEFAULT_CATEGORY_IDS = [
  9, 253, 255,  // Lapiceros / Artículos de escritura
  292,          // Gorras
  23,           // Mugs, Botilitos, Vasos y Termos
  31,           // Memorias USB
  112,          // Tecnología
  107,          // Maletines & Bolsos / Tulas & Mochilas
  12,           // Confecciones / Textiles
  25,           // Paraguas e Impermeables / Sombrillas
  24,           // Cuadernos / Oficina
];

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url: string, timeoutMs = 15000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
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

interface ProductCard {
  name: string;
  reference: string;
  productId: number;
  catId: number;
  url: string;
  slug: string;
}

function parseTotalPages(html: string): number {
  // Look for pager patterns like ?Page=N
  const pageMatches = html.match(/[?&]Page=(\d+)/g);
  if (!pageMatches) return 1;
  const nums = pageMatches.map((m) => parseInt(m.replace(/[^0-9]/g, ""), 10)).filter(Boolean);
  return nums.length > 0 ? Math.max(...nums) : 1;
}

function parseCategoryName(html: string): string {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    const name = h1[1].replace(/<[^>]+>/g, "").trim();
    if (name) return name;
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) {
    return title[1].replace(/<[^>]+>/g, "").trim().split("|")[0].trim();
  }
  return "";
}

function parseProductCards(html: string, catId: number): ProductCard[] {
  const products: ProductCard[] = [];
  const seen = new Set<number>();

  // Match product links: /p/[slug]/[id]/[catId]
  const productLinkPattern =
    /href=["']([^"']*\/p\/([^/"']+)\/(\d+)\/(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = productLinkPattern.exec(html)) !== null) {
    try {
      const relUrl = match[1];
      const slug = match[2];
      const productId = parseInt(match[3], 10);
      const linkCatId = parseInt(match[4], 10);
      const innerHtml = match[5];

      if (!productId || seen.has(productId)) continue;
      seen.add(productId);

      // Extract name from inner HTML
      let name = innerHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (!name) name = slug.replace(/-/g, " ");

      const fullUrl = relUrl.startsWith("http")
        ? relUrl
        : `${SUPPLIER_BASE}${relUrl.startsWith("/") ? "" : "/"}${relUrl}`;

      // Try to find a reference code near this product in the surrounding HTML
      // We'll do reference extraction from the product detail page instead
      products.push({
        name,
        reference: "",
        productId,
        catId: linkCatId || catId,
        url: fullUrl,
        slug,
      });
    } catch {
      // Skip malformed entries
    }
  }

  return products;
}

interface ProductDetail {
  reference: string;
  description: string;
  specs: Record<string, string>;
}

const REF_CODE_RE = /^[A-Z][A-Z0-9\-]{2,}$/;

const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'",
  "&aacute;": "á", "&eacute;": "é", "&iacute;": "í", "&oacute;": "ó", "&uacute;": "ú",
  "&Aacute;": "Á", "&Eacute;": "É", "&Iacute;": "Í", "&Oacute;": "Ó", "&Uacute;": "Ú",
  "&ntilde;": "ñ", "&Ntilde;": "Ñ", "&uuml;": "ü", "&Uuml;": "Ü",
  "&iexcl;": "¡", "&iquest;": "¿", "&copy;": "©", "&reg;": "®",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&[a-zA-Z0-9#]+;/g, (entity) => {
      if (HTML_ENTITIES[entity]) return HTML_ENTITIES[entity];
      // Numeric entities: &#123; or &#x1F;
      const numMatch = entity.match(/^&#x?([0-9a-fA-F]+);$/);
      if (numMatch) {
        const code = entity.startsWith("&#x")
          ? parseInt(numMatch[1], 16)
          : parseInt(numMatch[1], 10);
        return String.fromCharCode(code);
      }
      return entity;
    });
}

function extractTextContent(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function parseProductDetail(html: string, slug: string): ProductDetail {
  let reference = "";
  let description = "";
  const specs: Record<string, string> = {};

  // ── Strategy: find the product content area starting after the main <h2> title.
  // This avoids picking up references/descriptions from the NOVEDADES navigation
  // at the top of every page (e.g. <h4>VA-1203</h4><p>Alcancia piggy max</p>).
  //
  // Within the product area, try multiple patterns for the reference code since
  // the site uses different markup: <h4>, <h3>, <p>, or <span class="textoColor">
  //
  // The description is always the <p> immediately after the reference element.

  const h2Idx = html.search(/<h2[^>]*>/i);
  const h2EndIdx = html.indexOf("</h2>", h2Idx > -1 ? h2Idx : 0);
  const searchStart = h2EndIdx > -1 ? h2EndIdx + 5 : 0;
  const productArea = html.slice(searchStart, searchStart + 5000);

  // Patterns to find standalone reference codes (entire tag content = just the code)
  // Ordered by likelihood based on observed site structure
  const refTagPatterns: RegExp[] = [
    /<h4[^>]*>\s*([A-Z][A-Z0-9\-]{2,})\s*<\/h4>/gi,
    /<h3[^>]*>\s*([A-Z][A-Z0-9\-]{2,})\s*<\/h3>/gi,
    /<p[^>]*>\s*([A-Z][A-Z0-9\-]{2,})\s*<\/p>/gi,
    /<span[^>]*>\s*([A-Z][A-Z0-9\-]{2,})\s*<\/span>/gi,
  ];

  for (const pattern of refTagPatterns) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(productArea)) !== null) {
      const candidate = m[1].trim();
      if (!REF_CODE_RE.test(candidate)) continue;

      // Skip common HTML/nav words
      const skip = new Set(["DIV", "SPAN", "TABLE", "HEAD", "BODY", "FORM", "META", "LINK", "HTTP", "HTTPS", "COLOR"]);
      if (skip.has(candidate)) continue;

      reference = candidate;

      // Description = the <p> immediately after this element
      const after = productArea.slice(m.index + m[0].length);
      const descM = after.match(/^[\s\S]{0,200}<p[^>]*>([\s\S]*?)<\/p>/);
      if (descM) {
        const text = extractTextContent(descM[1]);
        if (text.length > 15) {
          description = text;
        }
      }
      break;
    }
    if (reference) break;
  }

  // Fallback: derive reference from slug
  if (!reference && slug) {
    const slugUpper = slug.toUpperCase();
    if (REF_CODE_RE.test(slugUpper)) {
      reference = slugUpper;
    }
  }

  // ── Specs: <h4>Label:</h4> followed by <p>Value</p>, within product area
  // Skip keys that look like product reference codes (those are nav items, not specs)
  const h4PPattern = /<h4[^>]*>([^<]+)<\/h4>[\s\S]{0,100}<p[^>]*>([^<]{1,200})<\/p>/gi;
  let h4Match: RegExpExecArray | null;
  while ((h4Match = h4PPattern.exec(productArea)) !== null) {
    const key = h4Match[1].replace(/:$/, "").trim();
    const value = h4Match[2].trim();
    if (REF_CODE_RE.test(key)) continue; // skip nav reference codes
    if (key && value && key.length < 60) {
      specs[key] = value;
    }
  }

  return { reference, description, specs };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as {
      categoryIds?: number[];
      maxPages?: number;
    };

    const supabase = createAdminClient();
    const categoryIds = body.categoryIds ?? DEFAULT_CATEGORY_IDS;
    const maxPages = body.maxPages ?? 999;

    let totalIndexed = 0;
    let totalCategories = 0;
    const errors: string[] = [];

    for (const catId of categoryIds) {
      try {
        // Fetch page 1 to get total pages + category name
        const page1Url = `${SUPPLIER_BASE}/Catalogo/Default.aspx?id=${catId}&Page=1`;
        const page1Html = await fetchHtml(page1Url);

        if (!page1Html) {
          errors.push(`Category ${catId}: failed to fetch page 1`);
          continue;
        }

        const categoryName = parseCategoryName(page1Html);
        const totalPages = Math.min(parseTotalPages(page1Html), maxPages);
        totalCategories++;

        // Progress tracked in returned stats — no console.log in production

        for (let page = 1; page <= totalPages; page++) {
          try {
            const pageUrl = `${SUPPLIER_BASE}/Catalogo/Default.aspx?id=${catId}&Page=${page}`;
            const pageHtml = page === 1 ? page1Html : await fetchHtml(pageUrl);

            if (!pageHtml) {
              errors.push(`Category ${catId} page ${page}: failed to fetch`);
              continue;
            }

            const cards = parseProductCards(pageHtml, catId);

            for (const card of cards) {
              try {
                await delay(REQUEST_DELAY_MS);

                const detailHtml = await fetchHtml(card.url);
                let detail: ProductDetail = { reference: "", description: "", specs: {} };

                if (detailHtml) {
                  detail = parseProductDetail(detailHtml, card.slug);
                }

                // Use reference from detail or fall back to slug-based
                const reference =
                  detail.reference ||
                  card.reference ||
                  card.slug.toUpperCase().slice(0, 30);

                if (!reference) continue;

                const { error: upsertError } = await supabase
                  .from("supplier_product_cache")
                  .upsert(
                    {
                      reference,
                      supplier_id: card.productId,
                      supplier_name: card.name,
                      description: detail.description || null,
                      specs: Object.keys(detail.specs).length > 0 ? detail.specs : null,
                      category_id: card.catId,
                      category_name: categoryName || null,
                      page_url: card.url,
                      last_synced_at: new Date().toISOString(),
                    },
                    { onConflict: "reference" }
                  );

                if (upsertError) {
                  errors.push(`Product ${reference}: ${upsertError.message}`);
                } else {
                  totalIndexed++;
                }
              } catch (productErr) {
                errors.push(
                  `Product ${card.productId}: ${productErr instanceof Error ? productErr.message : "unknown error"}`
                );
              }
            }

            // Delay between pages
            await delay(REQUEST_DELAY_MS);
          } catch (pageErr) {
            errors.push(
              `Category ${catId} page ${page}: ${pageErr instanceof Error ? pageErr.message : "unknown error"}`
            );
          }
        }
      } catch (catErr) {
        errors.push(
          `Category ${catId}: ${catErr instanceof Error ? catErr.message : "unknown error"}`
        );
      }
    }

    return NextResponse.json({
      indexed: totalIndexed,
      categories: totalCategories,
      errors: errors.slice(0, 50), // Cap error list
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
