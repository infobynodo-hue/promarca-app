import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

const SUPPLIER_BASE = "https://www.catalogospromocionales.com";
const FETCH_HEADERS = {
  "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "es-CO,es;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection":      "keep-alive",
  "Upgrade-Insecure-Requests": "1",
};

async function probeCategory(id: number): Promise<{ id: number; name: string; productCount: number } | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(`${SUPPLIER_BASE}/Catalogo/Default.aspx?id=${id}`, {
      headers: FETCH_HEADERS,
      cache: "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const html = await res.text();

    // Check for product cards
    if (!html.includes("itemProducto-")) return null;

    // Count product cards
    const cardMatches = html.match(/<div class="itemProducto-/g);
    const productCount = cardMatches ? cardMatches.length : 0;

    // Extract category name from breadcrumb or h1
    let name = `Categoría ${id}`;
    const bcMatch = html.match(/<span[^>]*class="[^"]*BreadcrumbLast[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    if (bcMatch) {
      name = bcMatch[1].replace(/<[^>]+>/g, "").trim();
    } else {
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (h1Match) name = h1Match[1].replace(/<[^>]+>/g, "").trim();
    }

    return { id, name, productCount };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startStr = searchParams.get("start") ?? "1";
  const endStr = searchParams.get("end") ?? "50";
  const start = Math.max(1, parseInt(startStr, 10) || 1);
  const end = Math.min(500, parseInt(endStr, 10) || 50);

  const results: { id: number; name: string; productCount: number }[] = [];

  for (let id = start; id <= end; id++) {
    const cat = await probeCategory(id);
    if (cat) results.push(cat);
    // Small delay to be polite
    await new Promise((r) => setTimeout(r, 150));
  }

  return NextResponse.json({ start, end, found: results.length, categories: results });
}
