import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

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
      model: "claude-opus-4-5",
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
- reference: código de referencia (ej: "VA-1029", "MU-321", "BO-102", "LAP-001")
- name: nombre descriptivo del producto. Si el PDF no tiene nombre explícito, genera uno basado en el tipo de objeto y la referencia (ej: "Lapicero LAP-001", "Bolso VA-1029", "Termo MU-321")
- price: precio en COP como número entero. Los puntos son separadores de miles (ej: "$94.238" → 94238, "$31.311" → 31311, "94.238" → 94238)
- price_label: etiqueta del precio si existe (ej: "Sin marca", "sin marca"). Si no aparece usa "Sin marca"
- description: descripción breve del producto si está disponible, sino null

Responde ÚNICAMENTE con un JSON array válido, sin texto adicional, sin bloques de código markdown:
[{"reference":"LAP-001","name":"Lapicero LAP-001","price":5000,"price_label":"Sin marca","description":null}]

Si no encuentras productos responde: []`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Claude no pudo extraer productos. Intentá con otro PDF.", raw: text },
        { status: 500 }
      );
    }

    const products = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ products, model: "claude-3-5-haiku-20241022" });
  } catch (err: any) {
    console.error("import-pdf error:", err);
    return NextResponse.json(
      { error: err.message ?? "Error inesperado al procesar el PDF" },
      { status: 500 }
    );
  }
}
