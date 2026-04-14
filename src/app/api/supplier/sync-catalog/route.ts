export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SUPPLIER_BASE = "https://catalogospromocionales.com";
const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept-Language": "es-CO,es;q=0.9",
};
const REQUEST_DELAY_MS = 200;
const DEFAULT_CATEGORY_IDS = [9, 253, 255];

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

function parseProductDetail(html: string, slug: string): ProductDetail {
  let reference = "";
  let description = "";
  const specs: Record<string, string> = {};

  // ── Reference: appears in <h3> tag (e.g. <h3>CARTER-ECO</h3>)
  // Structure: <h2>Product Name</h2> <h3>REFERENCE-CODE</h3> <p>description...</p>
  const h3Match = html.match(/<h3[^>]*>([^<]+)<\/h3>/i);
  if (h3Match) {
    const candidate = h3Match[1].trim();
    if (/^[A-Z][A-Z0-9\-]{2,}$/.test(candidate)) {
      reference = candidate;
    }
  }

  // Fallback: derive reference from slug
  if (!reference && slug) {
    const slugUpper = slug.toUpperCase();
    if (/^[A-Z][A-Z0-9\-]{2,}$/.test(slugUpper)) {
      reference = slugUpper;
    }
  }

  // ── Description: first <p> that comes after the <h3> reference block
  // It contains the main description text with measurements etc.
  if (reference) {
    // Find the h3 position, then grab the first <p> after it
    const h3End = html.indexOf(`</h3>`);
    if (h3End !== -1) {
      const afterH3 = html.slice(h3End + 5);
      const pMatch = afterH3.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      if (pMatch) {
        const text = pMatch[1].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (text.length > 10) {
          description = text;
        }
      }
    }
  }

  // ── Specs: <h4>Label:</h4><p>Value</p> pairs
  const h4PPattern = /<h4[^>]*>([^<]+)<\/h4>\s*<p[^>]*>([^<]+)<\/p>/gi;
  let h4Match: RegExpExecArray | null;
  while ((h4Match = h4PPattern.exec(html)) !== null) {
    const key = h4Match[1].replace(/:$/, "").trim();
    const value = h4Match[2].trim();
    if (key && value && key.length < 60 && value.length < 200) {
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

    const supabase = await createClient();
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

        console.log(`[sync-catalog] Category ${catId} (${categoryName}): ${totalPages} pages`);

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
