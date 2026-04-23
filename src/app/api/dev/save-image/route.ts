import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// DEV ONLY: Saves base64 images from Chrome to /public/img/categorias
// Requires PROMARCA_API_KEY header — disabled entirely in production
export async function POST(req: NextRequest) {
  // Always block in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  // Require API key even in dev/staging
  const apiKey = process.env.PROMARCA_API_KEY;
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!apiKey || token !== apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename, base64 } = await req.json();
  if (!filename || !base64) {
    return NextResponse.json({ error: "filename and base64 required" }, { status: 400 });
  }

  const dir = join(process.cwd(), "public", "img", "categorias");
  mkdirSync(dir, { recursive: true });
  const data = base64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(data, "base64");
  writeFileSync(join(dir, filename), buffer);
  return NextResponse.json({ ok: true, filename, size: buffer.length });
}
