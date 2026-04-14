import { NextResponse } from "next/server";

const SUPPLIER_BASE = "https://catalogospromocionales.com";
const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept-Language": "es-CO,es;q=0.9",
};

const FALLBACK_CATEGORIES = [
  { id: 9, name: "Artículos de Escritura", url: `${SUPPLIER_BASE}/Catalogo/Default.aspx?id=9` },
  { id: 253, name: "Escritura (Complementos)", url: `${SUPPLIER_BASE}/Catalogo/Default.aspx?id=253` },
  { id: 255, name: "Productos Ecológicos", url: `${SUPPLIER_BASE}/Catalogo/Default.aspx?id=255` },
];

interface Category {
  id: number;
  name: string;
  url: string;
}

function extractCategories(html: string): Category[] {
  const categories: Category[] = [];
  const seen = new Set<number>();

  // Match links like /Catalogo/Default.aspx?id=N or ?id=N&...
  const linkPattern = /href=["']([^"']*Catalogo\/Default\.aspx\?id=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) !== null) {
    const id = parseInt(match[2], 10);
    if (!id || seen.has(id)) continue;

    // Clean up name — strip HTML tags and extra whitespace
    const rawName = match[3].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!rawName) continue;

    seen.add(id);
    categories.push({
      id,
      name: rawName,
      url: `${SUPPLIER_BASE}/Catalogo/Default.aspx?id=${id}`,
    });
  }

  return categories;
}

export async function GET() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(SUPPLIER_BASE + "/", {
      headers: FETCH_HEADERS,
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Homepage returned ${res.status}`);
    }

    const html = await res.text();
    const categories = extractCategories(html);

    if (categories.length > 0) {
      return NextResponse.json({ categories });
    }

    // If we couldn't parse categories, probe known IDs 1-30 as a fallback
    const probed: Category[] = [];
    for (let id = 1; id <= 30; id++) {
      try {
        const probeController = new AbortController();
        const probeTimer = setTimeout(() => probeController.abort(), 8000);
        const probeRes = await fetch(
          `${SUPPLIER_BASE}/Catalogo/Default.aspx?id=${id}&Page=1`,
          { headers: FETCH_HEADERS, cache: "no-store", signal: probeController.signal }
        );
        clearTimeout(probeTimer);

        if (probeRes.ok) {
          const probeHtml = await probeRes.text();
          // Check if it has product cards
          if (
            probeHtml.includes("/p/") &&
            (probeHtml.includes("referencia") ||
              probeHtml.includes("product-item") ||
              probeHtml.includes("articulo"))
          ) {
            // Try to find the category name
            const titleMatch = probeHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            const name = titleMatch
              ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
              : `Categoría ${id}`;
            probed.push({
              id,
              name,
              url: `${SUPPLIER_BASE}/Catalogo/Default.aspx?id=${id}`,
            });
          }
        }
        // Small delay between probes
        await new Promise((r) => setTimeout(r, 200));
      } catch {
        // Ignore probe errors
      }
    }

    if (probed.length > 0) {
      return NextResponse.json({ categories: probed, source: "probed" });
    }

    // Last resort: return hardcoded fallback
    return NextResponse.json({ categories: FALLBACK_CATEGORIES, source: "fallback" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado";
    console.error("[discover-categories]", message);
    // Return fallback even on error
    return NextResponse.json(
      { categories: FALLBACK_CATEGORIES, source: "fallback", warning: message },
      { status: 200 }
    );
  }
}
