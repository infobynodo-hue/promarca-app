import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY ?? "" });

// ── Prompt templates ──────────────────────────────────────────────────────────
const PROMPTS: Record<string, string> = {
  dark_studio: `Photograph of [PRODUCT] taken in a professional commercial photography studio. Shot on a Phase One medium format camera with a 120mm macro lens at f/8, ISO 100. The image must look like a real photograph, not a 3D render or CGI. The product sits on a dark matte surface with a very subtle barely visible reflection beneath it. Background is a deep dark charcoal, naturally lit with two large softbox lights, one from the upper left as key light and one from the right as a soft rim light. The product finish shows real physical micro-texture under studio light with natural imperfections that make it look tactile and real. Photojournalistic realism, tack sharp focus, neutral-cool color grading, no grain, no blur, 4K resolution, no text, no logos.`,

  exploded: `Professional commercial product photography exploded view of [PRODUCT], all individual components floating and separated in mid-air around the main body, arranged in a clean organized composition. Each component casts a very subtle soft shadow as if lit from above by a large softbox. Background is a neutral warm light gray gradient, clean and minimal. The floating pieces are sharp and in focus with breathing room between them. Lighting is soft, even, and diffused. Clean premium product catalog aesthetic, shot on a seamless white-to-light-gray paper backdrop in a professional studio. Phase One medium format camera, photorealistic, not a 3D render, tack sharp, 4K. No text, no logos.`,

  clean_white: `Ultra-realistic professional e-commerce product photography of [PRODUCT] on a pure white seamless background. Shot on a medium format camera at f/11, ISO 100. Even diffused lighting from both sides with no harsh shadows, only a very soft natural drop shadow beneath the product. The product is centered, tack sharp from top to bottom, true-to-color representation. Amazon-style product photography, commercial quality, 4K resolution. No text, no logos, no props.`,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      imageBase64,
      template,
      productDescription,
      productId,
      customPrompt,
    }: {
      imageBase64: string;
      template: "dark_studio" | "exploded" | "clean_white";
      productDescription: string;
      productId?: string;
      customPrompt?: string;
    } = body;

    if (!imageBase64 || !template || !productDescription) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createClient();

    // Build prompt
    const basePrompt = customPrompt ?? PROMPTS[template] ?? PROMPTS.clean_white;
    const finalPrompt = basePrompt.replace(/\[PRODUCT\]/g, productDescription);

    // Save record as processing
    const { data: record, error: insertError } = await supabase
      .from("photo_generations")
      .insert({
        product_id: productId ?? null,
        product_description: productDescription,
        template_used: template,
        prompt_used: finalPrompt,
        status: "processing",
      })
      .select("id")
      .single();

    if (insertError || !record) {
      return NextResponse.json({ error: "DB error: " + insertError?.message }, { status: 500 });
    }

    // Ensure base64 has data: prefix
    const imageUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    // Call fal.ai with retry logic
    let generatedUrl: string | null = null;
    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await fal.subscribe("fal-ai/flux-pro/kontext", {
          input: {
            prompt: finalPrompt,
            image_url: imageUrl,
            num_images: 1,
            output_format: "jpeg",
          } as any,
        });
        generatedUrl = result?.data?.images?.[0]?.url ?? null;
        if (generatedUrl) break;
      } catch (err: any) {
        lastError = err?.message ?? "Unknown error";
        if (attempt < 2) await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }

    if (!generatedUrl) {
      await supabase
        .from("photo_generations")
        .update({ status: "failed", error_message: lastError })
        .eq("id", record.id);
      return NextResponse.json({ error: "fal.ai failed: " + lastError }, { status: 502 });
    }

    // Download generated image and save to Supabase Storage
    let storedUrl = generatedUrl;
    try {
      const imgRes = await fetch(generatedUrl);
      if (imgRes.ok) {
        const buffer = await imgRes.arrayBuffer();
        const path = `generated/${record.id}.jpg`;
        await supabase.storage
          .from("product-photos")
          .upload(path, buffer, { contentType: "image/jpeg", upsert: true });

        const { data: pub } = supabase.storage.from("product-photos").getPublicUrl(path);
        if (pub.publicUrl) storedUrl = pub.publicUrl;
      }
    } catch {
      // Keep fal.ai URL if storage upload fails
    }

    // Update record as completed
    await supabase
      .from("photo_generations")
      .update({ generated_image_url: storedUrl, status: "completed" })
      .eq("id", record.id);

    return NextResponse.json({
      success: true,
      generationId: record.id,
      generatedImageUrl: storedUrl,
      promptUsed: finalPrompt,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
