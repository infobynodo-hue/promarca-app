import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY no configurada. Agrégala en Vercel → Settings → Environment Variables." },
      { status: 500 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("pdf") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No se recibió ningún PDF" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: `Analiza este catálogo de productos promocionales y extrae TODOS los productos que encuentres.

Para cada producto extrae:
- reference: código de referencia (ej: "VA-1029", "MU-321", "BO-102")
- name: nombre descriptivo del producto. Si el PDF no tiene nombre explícito, genera uno descriptivo basado en el tipo de producto y la referencia (ej: "Bolso VA-1029", "Termo MU-321")
- price: precio en COP como número entero (los puntos son separadores de miles, ej: "$94.238" → 94238, "$31.311" → 31311)
- price_label: etiqueta del precio (ej: "Sin marca", "sin marca", o lo que aparezca junto al precio)
- description: descripción breve si está disponible, sino null

Responde ÚNICAMENTE con un JSON array válido sin texto adicional ni bloques de código:
[
  {
    "reference": "VA-1029",
    "name": "Bolso VA-1029",
    "price": 94238,
    "price_label": "Sin marca",
    "description": null
  }
]

Si no encuentras ningún producto, responde con un array vacío: []`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    // Extract JSON from response (handle cases where model adds extra text)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "No se pudo parsear la respuesta de Claude", raw: text }, { status: 500 });
    }

    const products = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ products });
  } catch (err: any) {
    console.error("import-pdf error:", err);
    return NextResponse.json({ error: err.message ?? "Error inesperado" }, { status: 500 });
  }
}
