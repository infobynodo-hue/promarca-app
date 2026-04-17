import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// DEV ONLY: temporary endpoint to save base64 images from Chrome
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }
  const { filename, base64 } = await req.json();
  const dir = join(process.cwd(), "public", "img", "categorias");
  mkdirSync(dir, { recursive: true });
  const data = base64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(data, "base64");
  writeFileSync(join(dir, filename), buffer);
  return NextResponse.json({ ok: true, filename, size: buffer.length });
}
