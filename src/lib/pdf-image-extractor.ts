// ── PDF Image Extractor ───────────────────────────────────────────────────────
// Strategy: render each page to canvas, then crop fixed 3-column grid cells.
// Each product card occupies roughly 1/3 of the page width and 1/3 of its height.
// We crop the TOP 60% of each cell = the product photo area.
// Simple, direct, guaranteed to return images if PDF.js can render the page.

export interface ExtractedImage {
  dataUrl: string;
  pageNumber: number;
  quality: "high" | "medium" | "low";
  widthPx: number;
  heightPx: number;
  detectedRef?: string;
}

function assessQuality(w: number, h: number): "high" | "medium" | "low" {
  const px = w * h;
  if (px >= 150 * 150) return "high";
  if (px >= 70  * 70)  return "medium";
  return "low";
}

// ── Extract images from one page ──────────────────────────────────────────────
async function extractPageImages(
  page: any,
  pageNumber: number
): Promise<ExtractedImage[]> {
  const SCALE = 2.0;
  const viewport = page.getViewport({ scale: SCALE });
  const W = Math.round(viewport.width);
  const H = Math.round(viewport.height);

  // Render the full page to a canvas
  const pageCanvas = document.createElement("canvas");
  pageCanvas.width  = W;
  pageCanvas.height = H;
  const ctx = pageCanvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;

  // ── Fixed 3-column × 3-row grid ──────────────────────────────────────────
  // Product catalogs typically have 3 columns. We assume 3 rows per page as
  // a safe default (works for most A4 supplier catalogs).
  const COLS = 3;
  const ROWS = 3;
  const cellW = Math.floor(W / COLS);
  const cellH = Math.floor(H / ROWS);
  // Image is the top 62% of each cell; text (ref/name/price) is bottom 38%
  const imgH  = Math.round(cellH * 0.62);

  const results: ExtractedImage[] = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cropX = c * cellW + 5;
      const cropY = r * cellH + 5;
      const cropW = cellW - 10;
      const cropH = imgH  - 5;

      if (cropW < 20 || cropH < 20) continue;

      const out = document.createElement("canvas");
      out.width  = cropW;
      out.height = cropH;
      out.getContext("2d")!.drawImage(
        pageCanvas,
        cropX, cropY, cropW, cropH,
        0,     0,     cropW, cropH
      );

      results.push({
        dataUrl:    out.toDataURL("image/jpeg", 0.92),
        pageNumber,
        quality:    assessQuality(cropW, cropH),
        widthPx:    cropW,
        heightPx:   cropH,
      });
    }
  }

  return results; // always returns 9 images per page
}

// ── Main entry point ──────────────────────────────────────────────────────────
export async function extractImagesFromPDF(
  file: File,
  onProgress?: (page: number, total: number) => void
): Promise<ExtractedImage[]> {
  const pdfjsLib = await import("pdfjs-dist");
  // Use local worker file (copied to /public) — avoids CDN version mismatch
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const buffer = await file.arrayBuffer();
  const pdf    = await pdfjsLib.getDocument({ data: buffer }).promise;
  const all: ExtractedImage[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress?.(p, pdf.numPages);
    const page = await pdf.getPage(p);
    const imgs = await extractPageImages(page, p);
    all.push(...imgs);
    page.cleanup();
  }

  return all;
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
