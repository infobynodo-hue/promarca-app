import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "es-CO,es;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      cache: "no-store",
      signal: ctrl.signal,
      redirect: "follow",
    });
    clearTimeout(t);

    const html = await res.text();
    const hasProducts = html.includes("itemProducto-");
    const productCount = (html.match(/<div class="itemProducto-/g) ?? []).length;

    // Extract links matching /Catalogo/ or /promocionales/
    const links: string[] = [];
    const linkRe = /href=["']((?:\/Catalogo|\/promocionales)[^"']*?)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html)) !== null) {
      if (!links.includes(m[1])) links.push(m[1]);
      if (links.length >= 50) break;
    }

    // Find page title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";

    // Find h1
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, "").trim() : "";

    // Extract first few product names and references
    const productNames: string[] = [];
    const productRefs: string[] = [];
    if (hasProducts) {
      const nameRe = /<h3>([\s\S]*?)(?:<a|<\/h3>)/gi;
      let nm: RegExpExecArray | null;
      while ((nm = nameRe.exec(html)) !== null && productNames.length < 5) {
        const name = nm[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        if (name) productNames.push(name);
      }
      const refRe = /<p class="ref[^"]*">([\s\S]*?)<\/p>/gi;
      let rm: RegExpExecArray | null;
      while ((rm = refRe.exec(html)) !== null && productRefs.length < 5) {
        const ref = rm[1].replace(/<[^>]+>/g, "").trim();
        if (ref) productRefs.push(ref);
      }
    }

    // Find how many pages
    const pageLinks = links.filter(l => l.includes("&Page="));
    const maxPage = pageLinks.reduce((max, l) => {
      const m = l.match(/Page=(\d+)/);
      return m ? Math.max(max, parseInt(m[1])) : max;
    }, 1);

    return NextResponse.json({
      status: res.status,
      ok: res.ok,
      url: res.url,
      title,
      h1,
      hasProducts,
      productCount,
      totalPages: maxPage,
      productNames,
      productRefs,
      links: links.slice(0, 20),
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "fetch failed",
    }, { status: 502 });
  }
}
