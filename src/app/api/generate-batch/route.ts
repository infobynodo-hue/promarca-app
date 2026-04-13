import { NextRequest, NextResponse } from "next/server";

const MAX_CONCURRENT = 3;

interface BatchItem {
  imageBase64: string;
  productDescription: string;
  productId?: string;
  index: number;
}

async function processItem(
  item: BatchItem,
  template: string,
  baseUrl: string
): Promise<{ index: number; success: boolean; generatedImageUrl?: string; generationId?: string; error?: string }> {
  try {
    const res = await fetch(`${baseUrl}/api/generate-photo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: item.imageBase64,
        template,
        productDescription: item.productDescription,
        productId: item.productId,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { index: item.index, success: false, error: data.error ?? "Failed" };
    }
    return {
      index: item.index,
      success: true,
      generatedImageUrl: data.generatedImageUrl,
      generationId: data.generationId,
    };
  } catch (err: any) {
    return { index: item.index, success: false, error: err.message };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      items,
      template,
    }: {
      items: Array<{ imageBase64: string; productDescription: string; productId?: string }>;
      template: "dark_studio" | "exploded" | "clean_white";
    } = body;

    if (!items?.length || !template) {
      return NextResponse.json({ error: "Missing items or template" }, { status: 400 });
    }

    const baseUrl = request.nextUrl.origin;
    const indexedItems: BatchItem[] = items.map((item, i) => ({ ...item, index: i }));
    const results: any[] = [];

    // Process in chunks of MAX_CONCURRENT
    for (let i = 0; i < indexedItems.length; i += MAX_CONCURRENT) {
      const chunk = indexedItems.slice(i, i + MAX_CONCURRENT);
      const chunkResults = await Promise.all(
        chunk.map((item) => processItem(item, template, baseUrl))
      );
      results.push(...chunkResults);
    }

    return NextResponse.json({
      success: true,
      total: items.length,
      completed: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
