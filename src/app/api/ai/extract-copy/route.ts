import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ExtractedCopy {
  headline: string;
  subheadline: string;
  benefits: { emoji: string; text: string }[];
  fomo_text: string;
  compare_price_suggestion: number;
  template: "hero" | "problema-solucion" | "prueba-social" | "hispano";
  template_reason: string;
  campaign_angle: string;
  session_title: string;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY no configurada" }, { status: 500 });
  }

  try {
    const { messages, productContext } = await req.json() as {
      messages: { role: "user" | "assistant"; content: string }[];
      productContext?: {
        name: string;
        reference: string;
        price: number;
        description?: string;
        category?: string;
      };
    };

    if (!messages?.length) {
      return NextResponse.json({ error: "No hay mensajes para analizar" }, { status: 400 });
    }

    const conversationText = messages
      .map((m) => `${m.role === "user" ? "Usuario" : "Pro"}: ${m.content}`)
      .join("\n\n");

    const productInfo = productContext
      ? `Producto: ${productContext.name} (${productContext.reference}) — $${productContext.price.toLocaleString("es-CO")} COP — Categoría: ${productContext.category ?? "N/A"}`
      : "Sin producto específico seleccionado";

    const systemPrompt = `Eres un extractor de copy de marketing. Tu tarea es analizar una conversación entre un usuario y un Sales Coach (Pro) y extraer elementos estructurados para una landing page de venta directa en Colombia.

Debes devolver ÚNICAMENTE un JSON válido con esta estructura exacta:
{
  "headline": "string — título principal de la landing (máx 80 chars, orientado a beneficio, en español colombiano)",
  "subheadline": "string — subtítulo que amplía el headline (máx 120 chars)",
  "benefits": [
    { "emoji": "string — 1 emoji relevante", "text": "string — beneficio conciso (máx 60 chars)" }
  ],
  "fomo_text": "string — texto de urgencia/escasez (máx 60 chars, ej: '🔥 Solo 12 unidades disponibles')",
  "compare_price_suggestion": number — precio sugerido de comparación en COP (0 si no aplica),
  "template": "hero" | "problema-solucion" | "prueba-social" | "hispano",
  "template_reason": "string — 1 oración explicando por qué esta plantilla",
  "campaign_angle": "string — el ángulo principal del copy en 1 oración",
  "session_title": "string — título corto para esta sesión (máx 50 chars)"
}

Reglas:
- benefits: entre 3 y 5 items. Si Pro mencionó beneficios específicos, úsalos.
- template: elige basado en la estrategia que Pro recomendó en la conversación:
  * "hero" = beneficio directo claro, audiencia ya consciente del producto
  * "problema-solucion" = audiencia fría, Pro recomendó empezar con el dolor
  * "prueba-social" = Pro mencionó testimonios/reviews como elemento clave
  * "hispano" = Pro recomendó WhatsApp prominente, cuotas, confianza local
- Si Pro no mencionó template explícitamente, infiere del contexto.
- session_title: resume la sesión, ej: "Gorras — ángulo profesionalismo"
- NO incluyas markdown, solo el JSON puro.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 800,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `${productInfo}\n\nConversación:\n${conversationText}\n\nExtrae el copy estructurado para la landing page.`,
        },
      ],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // Strip markdown code fences if present
    const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const extracted: ExtractedCopy = JSON.parse(jsonStr);

    return NextResponse.json(extracted);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado";
    console.error("[extract-copy]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
