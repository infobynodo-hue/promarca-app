import { NextRequest, NextResponse } from "next/server";

// ─── Meta Ad Library API Integration ─────────────────────────────────────────
//
// Para obtener tu token:
// 1. Ve a https://developers.facebook.com/
// 2. Crea una app (tipo Business) o usa una existente
// 3. Ve a Tools > Graph API Explorer
// 4. Genera un User Token con el permiso: ads_read
// 5. Para producción, usa un Long-Lived Token (~60 días):
//    GET https://graph.facebook.com/v21.0/oauth/access_token
//      ?grant_type=fb_exchange_token
//      &client_id={app_id}
//      &client_secret={app_secret}
//      &fb_exchange_token={short_lived_token}
// 6. Pega el token en .env.local como META_AD_LIBRARY_TOKEN=...
//
// Documentación oficial: https://developers.facebook.com/docs/marketing-api/reference/ads_archive
// ─────────────────────────────────────────────────────────────────────────────

const META_GRAPH_URL = "https://graph.facebook.com/v21.0/ads_archive";

// Fields available in the Meta Ad Library API
const AD_FIELDS = [
  "id",
  "page_name",
  "page_id",
  "ad_creative_bodies",
  "ad_creative_link_captions",
  "ad_creative_link_titles",
  "ad_creative_link_descriptions",
  "ad_snapshot_url",
  "ad_delivery_start_time",
  "impressions",
  "spend",
  "currency",
  "languages",
  "publisher_platforms",
].join(",");

export interface AdResult {
  id: string;
  page_name: string;
  page_id?: string;
  body?: string;
  title?: string;
  caption?: string;
  snapshot_url: string;
  start_date?: string;
  impressions?: { lower_bound: string; upper_bound: string };
  spend?: { lower_bound: string; upper_bound: string };
  platforms?: string[];
}

export interface SearchResponse {
  ads: AdResult[];
  total: number;
  query: string;
  countries: string[];
  configured: boolean;
}

export async function POST(request: NextRequest) {
  const token = process.env.META_AD_LIBRARY_TOKEN;

  // ── Token not configured → return setup instructions ──────────────────────
  if (!token) {
    return NextResponse.json(
      { configured: false, ads: [], message: "META_AD_LIBRARY_TOKEN not configured" },
      { status: 200 } // 200 so the client handles it gracefully
    );
  }

  try {
    const body = await request.json();
    const {
      query,
      countries = ["CO", "MX", "BR"],
      limit = 6,
    }: { query: string; countries?: string[]; limit?: number } = body;

    if (!query?.trim()) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    // Build Meta API URL
    const params = new URLSearchParams({
      access_token: token,
      search_terms: query,
      ad_reached_countries: JSON.stringify(countries),
      ad_type: "ALL",
      ad_active_status: "ALL", // ALL = active + inactive
      fields: AD_FIELDS,
      limit: String(Math.min(limit, 10)), // Meta max per call
    });

    const url = `${META_GRAPH_URL}?${params.toString()}`;
    const res = await fetch(url, { next: { revalidate: 3600 } }); // cache 1h

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[ad-library] Meta API error:", err);

      // Common error: token expired or invalid
      const errCode = err?.error?.code;
      const errMsg = err?.error?.message ?? "Meta API error";

      if (errCode === 190) {
        // OAuthException — token invalid/expired
        return NextResponse.json(
          { configured: true, token_expired: true, ads: [], message: errMsg },
          { status: 200 }
        );
      }

      return NextResponse.json({ error: errMsg }, { status: 502 });
    }

    const data = await res.json();
    const rawAds: any[] = data?.data ?? [];

    // Normalize response
    const ads: AdResult[] = rawAds.map((ad) => ({
      id: ad.id,
      page_name: ad.page_name ?? "—",
      page_id: ad.page_id,
      body: ad.ad_creative_bodies?.[0] ?? undefined,
      title: ad.ad_creative_link_titles?.[0] ?? undefined,
      caption: ad.ad_creative_link_captions?.[0] ?? undefined,
      snapshot_url: ad.ad_snapshot_url,
      start_date: ad.ad_delivery_start_time,
      impressions: ad.impressions,
      spend: ad.spend,
      platforms: ad.publisher_platforms,
    }));

    const response: SearchResponse = {
      ads,
      total: ads.length,
      query,
      countries,
      configured: true,
    };

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
