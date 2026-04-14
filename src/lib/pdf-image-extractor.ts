// ── PDF Image Extractor ───────────────────────────────────────────────────────
// Strategy: render each PDF page to a canvas and intercept every drawImage()
// call that PDF.js makes internally. Each product photo is drawn as a discrete
// drawImage() — we capture it at full resolution before it gets composited
// onto the page. No byte-scanning, no operator list parsing needed.

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

// ── Intercept drawImage on a canvas context ───────────────────────────────────
function wrapContext(ctx: CanvasRenderingContext2D, onImage: (src: CanvasImageSource, w: number, h: number) => void) {
  const orig = ctx.drawImage.bind(ctx);

  // Override drawImage — PDF.js calls this for every image XObject
  (ctx as any).drawImage = function (source: CanvasImageSource, ...rest: any[]) {
    try {
      const w: number =
        (source as HTMLImageElement).naturalWidth  ||
        (source as HTMLCanvasElement).width        ||
        (source as ImageBitmap).width              || 0;
      const h: number =
        (source as HTMLImageElement).naturalHeight ||
        (source as HTMLCanvasElement).height       ||
        (source as ImageBitmap).height             || 0;

      if (w >= 55 && h >= 55) {
        onImage(source, w, h);
      }
    } catch { /* ignore */ }

    return (orig as any)(source, ...rest);
  };
}

// ── Extract images from one page ──────────────────────────────────────────────
async function extractPageImages(
  page: any,
  pageNumber: number
): Promise<ExtractedImage[]> {
  const viewport = page.getViewport({ scale: 2.0 });

  const canvas = document.createElement("canvas");
  canvas.width  = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d")!;

  const captured: ExtractedImage[] = [];

  // Install the interceptor BEFORE rendering
  wrapContext(ctx, (source, w, h) => {
    try {
      const out = document.createElement("canvas");
      out.width  = w;
      out.height = h;
      out.getContext("2d")!.drawImage(source as any, 0, 0, w, h);
      const dataUrl = out.toDataURL("image/jpeg", 0.92);
      if (dataUrl && dataUrl.length > 100) {
        captured.push({
          dataUrl,
          pageNumber,
          quality: assessQuality(w, h),
          widthPx: w,
          heightPx: h,
        });
      }
    } catch { /* ignore failures */ }
  });

  // Render — this triggers all drawImage calls
  try {
    await page.render({ canvasContext: ctx, viewport }).promise;
  } catch { /* ignore render errors */ }

  return captured;
}

// ── Main extraction function ──────────────────────────────────────────────────
export async function extractImagesFromPDF(
  file: File,
  onProgress?: (page: number, total: number) => void
): Promise<ExtractedImage[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

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

  // Sort: largest (product photos) first, small icons last
  all.sort((a, b) => (b.widthPx * b.heightPx) - (a.widthPx * a.heightPx));

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
