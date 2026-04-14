import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY no configurada" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { productName, reference, description, price } = body as {
      productName: string;
      reference: string;
      description?: string;
      price?: number;
    };

    const priceFormatted = price
      ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price)
      : null;

    const prompt = `Eres un experto en copywriting de landing pages B2C para productos promocionales/corporativos en Colombia. Tu objetivo es generar textos que conviertan visitantes en compradores, con un tono moderno, directo y persuasivo en español colombiano.

Producto:
- Nombre: ${productName}
- Referencia: ${reference}
${description ? `- Descripción: ${description}` : ""}
${priceFormatted ? `- Precio base: ${priceFormatted}` : ""}

Genera el siguiente contenido para una landing page de venta directa al consumidor:

1. **headline**: Un título principal impactante (máx 10 palabras). Debe generar deseo inmediato. No menciones el precio.
2. **subheadline**: Una frase complementaria que refuerza el headline (máx 20 palabras). Puede mencionar beneficio principal o propuesta de valor.
3. **benefits**: Exactamente 4 beneficios del producto. Cada uno con:
   - emoji: Un emoji relevante (solo el emoji, sin texto)
   - text: Frase corta del beneficio (máx 8 palabras)
4. **fomo_text**: Texto de urgencia/escasez para el banner inferior (máx 12 palabras). Ej: "🔥 Solo 12 unidades disponibles · Despacho hoy"
5. **compare_price_suggestion**: Un precio sugerido de comparación (número solo, en COP), como si fuera el precio de lista antes del descuento. Debe ser entre 20% y 40% mayor al precio base.

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "headline": "...",
  "subheadline": "...",
  "benefits": [
    { "emoji": "⚡", "text": "..." },
    { "emoji": "🎯", "text": "..." },
    { "emoji": "✅", "text": "..." },
    { "emoji": "💎", "text": "..." }
  ],
  "fomo_text": "...",
  "compare_price_suggestion": 0
}`;

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";

    // Extract JSON from response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "No se pudo parsear la respuesta de IA" }, { status: 500 });
    }

    const suggestions = JSON.parse(jsonMatch[0]);
    return NextResponse.json(suggestions);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
