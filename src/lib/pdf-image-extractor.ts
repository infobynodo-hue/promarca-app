// ── PDF Image Extractor ───────────────────────────────────────────────────────
// Strategy: scan raw PDF bytes for embedded JPEG data (DCTDecode).
// Most product catalog PDFs embed product photos as JPEG XObjects.
// JPEG files always start with FF D8 FF and end with FF D9 — we find all
// of those in the binary and extract them directly, no PDF.js rendering needed.

export interface ExtractedImage {
  dataUrl: string;
  pageNumber: number;
  quality: "high" | "medium" | "low";
  widthPx: number;
  heightPx: number;
}

function assessQuality(w: number, h: number): "high" | "medium" | "low" {
  const px = w * h;
  if (px >= 120 * 120) return "high";
  if (px >= 60  * 60)  return "medium";
  return "low";
}

// Load a JPEG blob → get actual dimensions + data URL
function loadJpeg(blob: Blob): Promise<{ w: number; h: number; dataUrl: string } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const cleanup = () => URL.revokeObjectURL(url);

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        cleanup();
        resolve({ w: img.naturalWidth, h: img.naturalHeight, dataUrl });
      } catch {
        cleanup();
        resolve(null);
      }
    };
    img.onerror = () => { cleanup(); resolve(null); };
    img.src = url;
  });
}

// ── Scan raw bytes for JPEG markers ──────────────────────────────────────────
// JPEG SOI  = FF D8 FF (start of image)
// JPEG EOI  = FF D9    (end of image)
function findJpegs(bytes: Uint8Array): Uint8Array[] {
  const jpegs: Uint8Array[] = [];
  let i = 0;

  while (i < bytes.length - 3) {
    // Look for SOI: FF D8 FF
    if (bytes[i] !== 0xFF || bytes[i + 1] !== 0xD8 || bytes[i + 2] !== 0xFF) {
      i++;
      continue;
    }

    const start = i;
    // Scan forward for EOI: FF D9
    let j = start + 2;
    let found = false;

    while (j < bytes.length - 1) {
      if (bytes[j] === 0xFF && bytes[j + 1] === 0xD9) {
        found = true;
        j += 2; // include EOI
        break;
      }
      j++;
    }

    if (!found) { i++; continue; }

    const chunk = bytes.slice(start, j);
    // Skip suspiciously small blobs — likely JPEG thumbnails / icons (<3KB)
    if (chunk.length >= 3_000) {
      jpegs.push(chunk);
    }

    i = j; // continue after this JPEG
  }

  return jpegs;
}

// ── Main extraction function ──────────────────────────────────────────────────
export async function extractImagesFromPDF(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<ExtractedImage[]> {

  const buffer = await file.arrayBuffer();
  const bytes  = new Uint8Array(buffer);

  // Find all JPEG blobs in the PDF binary
  const jpegs = findJpegs(bytes);
  if (jpegs.length === 0) return [];

  const results: ExtractedImage[] = [];

  for (let idx = 0; idx < jpegs.length; idx++) {
    onProgress?.(idx + 1, jpegs.length);

    const blob = new Blob([jpegs[idx]], { type: "image/jpeg" });
    const info = await loadJpeg(blob);
    if (!info) continue;

    const { w, h, dataUrl } = info;
    if (w < 60 || h < 60) continue; // skip tiny icons

    const q = assessQuality(w, h);
    results.push({ dataUrl, pageNumber: 1, quality: q, widthPx: w, heightPx: h });
  }

  // Sort: largest / best quality first (most likely to be product photos)
  results.sort((a, b) => {
    const qa = a.quality === "high" ? 0 : a.quality === "medium" ? 1 : 2;
    const qb = b.quality === "high" ? 0 : b.quality === "medium" ? 1 : 2;
    if (qa !== qb) return qa - qb;
    return (b.widthPx * b.heightPx) - (a.widthPx * a.heightPx);
  });

  return results;
}

// ── Upload PDF to Supabase Storage ────────────────────────────────────────────
export async function uploadPDFToStorage(file: File, supabase: any): Promise<string> {
  const path = `pdf-imports/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
  const { error } = await supabase.storage
    .from("products")
    .upload(path, file, { contentType: "application/pdf", upsert: false });
  if (error) throw new Error("Error al subir PDF: " + error.message);
  return supabase.storage.from("products").getPublicUrl(path).data.publicUrl;
}
