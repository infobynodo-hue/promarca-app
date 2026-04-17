import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const { base64 } = await req.json();
  const buffer = Buffer.from(base64, "base64");

  // Parse ZIP and extract files
  const dir = join(process.cwd(), "public", "img", "categorias");
  mkdirSync(dir, { recursive: true });

  const files = parseZip(buffer);
  const saved: string[] = [];
  for (const { name, data } of files) {
    writeFileSync(join(dir, name), data);
    saved.push(name);
  }

  return NextResponse.json({ ok: true, saved });
}

function parseZip(buf: Buffer): { name: string; data: Buffer }[] {
  const files: { name: string; data: Buffer }[] = [];
  let pos = 0;
  while (pos < buf.length - 4) {
    const sig = buf.readUInt32LE(pos);
    if (sig !== 0x04034b50) break; // local file header signature
    const compression = buf.readUInt16LE(pos + 8);
    const compressedSize = buf.readUInt32LE(pos + 18);
    const nameLen = buf.readUInt16LE(pos + 26);
    const extraLen = buf.readUInt16LE(pos + 28);
    const name = buf.subarray(pos + 30, pos + 30 + nameLen).toString();
    const dataStart = pos + 30 + nameLen + extraLen;
    const data = buf.subarray(dataStart, dataStart + compressedSize);
    if (compression === 0) files.push({ name, data: Buffer.from(data) });
    pos = dataStart + compressedSize;
  }
  return files;
}
