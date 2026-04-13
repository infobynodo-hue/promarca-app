// ── PDF Image Extractor ───────────────────────────────────────────────────────
// Uses PDF.js to render PDF pages and extract product images.
// Each page is rendered to a canvas, then we detect image regions
// (areas with non-white content) and crop them out.

export interface ExtractedImage {
  dataUrl: string;
  pageNumber: number;
  quality: "high" | "medium" | "low";
  widthPx: number;
  heightPx: number;
}

// Render a PDF page to a canvas at 2x scale for better quality
async function renderPageToCanvas(
  pdf: any,
  pageNum: number,
  scale = 2.0
): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

// Detect if a rectangular region is "interesting" (has enough non-white pixels)
function regionIsInteresting(
  imageData: ImageData,
  x: number,
  y: number,
  w: number,
  h: number,
  threshold = 0.15
): boolean {
  const data = imageData.data;
  let nonWhite = 0;
  const total = w * h;
  const stride = imageData.width;

  for (let row = y; row < y + h; row += 3) {
    for (let col = x; col < x + w; col += 3) {
      const idx = (row * stride + col) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      if (r < 240 || g < 240 || b < 240) nonWhite++;
    }
  }
  return nonWhite / (total / 9) > threshold;
}

// Crop a square region from canvas and return as data URL
function cropCanvas(
  source: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number
): string {
  const out = document.createElement("canvas");
  // Make it square — pad to largest dimension
  const size = Math.max(w, h);
  out.width = size;
  out.height = size;
  const ctx = out.getContext("2d")!;
  // White background
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);
  // Center the crop
  const offsetX = (size - w) / 2;
  const offsetY = (size - h) / 2;
  ctx.drawImage(source, x, y, w, h, offsetX, offsetY, w, h);
  return out.toDataURL("image/jpeg", 0.92);
}

// Assess quality based on pixel dimensions
function assessQuality(w: number, h: number): "high" | "medium" | "low" {
  const px = w * h;
  if (px > 200 * 200) return "high";
  if (px > 100 * 100) return "medium";
  return "low";
}

// ── Main extraction function ──────────────────────────────────────────────────
export async function extractImagesFromPDF(
  file: File,
  onProgress?: (page: number, total: number) => void
): Promise<ExtractedImage[]> {
  // Dynamically load PDF.js
  const pdfjsLib = await import("pdfjs-dist");
  // Set worker — use CDN to avoid bundle issues
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;

  const results: ExtractedImage[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(pageNum, numPages);

    const canvas = await renderPageToCanvas(pdf, pageNum, 2.0);
    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Divide page into a grid and find interesting regions
    // We look for product image "blocks" by scanning the page
    const cols = 3;
    const rows = 4;
    const cellW = Math.floor(canvas.width / cols);
    const cellH = Math.floor(canvas.height / rows);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * cellW;
        const y = row * cellH;
        const w = cellW;
        const h = cellH;

        if (!regionIsInteresting(imageData, x, y, w, h)) continue;

        // Try to find a tighter bounding box within this cell
        const cropped = cropCanvas(canvas, x, y, w, h);

        // Only include if large enough to be a useful product image
        if (w < 80 || h < 80) continue;

        results.push({
          dataUrl: cropped,
          pageNumber: pageNum,
          quality: assessQuality(w, h),
          widthPx: w,
          heightPx: h,
        });
      }
    }
  }

  // Deduplicate very similar regions (same page adjacent cells)
  return results;
}

// ── Upload PDF to Supabase Storage for large file support ─────────────────────
// This bypasses Vercel's 4.5MB body limit by uploading to Storage first
export async function uploadPDFToStorage(
  file: File,
  supabase: any
): Promise<string> {
  const path = `pdf-imports/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;

  const { error } = await supabase.storage
    .from("products")
    .upload(path, file, { contentType: "application/pdf", upsert: false });

  if (error) throw new Error("Error al subir PDF: " + error.message);

  const { data } = supabase.storage.from("products").getPublicUrl(path);
  return data.publicUrl;
}
