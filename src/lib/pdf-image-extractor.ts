// ── PDF Image Extractor ───────────────────────────────────────────────────────
// Strategy: render each PDF page to canvas at high scale, then use text
// positions to locate product reference codes (e.g. "FOSTER", "GEMINI-ROL").
// For each reference found, crop the canvas region ABOVE the text block —
// that rectangle is the product photo shown in the catalog layout.
// This approach is layout-aware and works regardless of how images are encoded
// inside the PDF binary.

export interface ExtractedImage {
  dataUrl: string;
  pageNumber: number;
  quality: "high" | "medium" | "low";
  widthPx: number;
  heightPx: number;
  /** The reference code detected for this image, if any */
  detectedRef?: string;
}

function assessQuality(w: number, h: number): "high" | "medium" | "low" {
  const px = w * h;
  if (px >= 150 * 150) return "high";
  if (px >= 70  * 70)  return "medium";
  return "low";
}

// ── Convert PDF user-space coords to canvas pixels ───────────────────────────
function pdfToCanvas(viewport: any, pdfX: number, pdfY: number): [number, number] {
  if (typeof viewport.convertToViewportPoint === "function") {
    return viewport.convertToViewportPoint(pdfX, pdfY) as [number, number];
  }
  // Fallback: use transform matrix directly
  const vt = viewport.transform as number[];
  return [
    vt[0] * pdfX + vt[2] * pdfY + vt[4],
    vt[1] * pdfX + vt[3] * pdfY + vt[5],
  ];
}

// ── Extract images from one page ──────────────────────────────────────────────
async function extractPageImages(
  page: any,
  pageNumber: number
): Promise<ExtractedImage[]> {
  const SCALE = 2.5;
  const viewport = page.getViewport({ scale: SCALE });
  const W = Math.round(viewport.width);
  const H = Math.round(viewport.height);

  // ── 1. Render full page ──────────────────────────────────────────────────
  const pageCanvas = document.createElement("canvas");
  pageCanvas.width  = W;
  pageCanvas.height = H;
  const ctx = pageCanvas.getContext("2d")!;
  try {
    await page.render({ canvasContext: ctx, viewport }).promise;
  } catch {
    return [];
  }

  // ── 2. Get text content with canvas-space positions ──────────────────────
  let tc: any;
  try {
    tc = await page.getTextContent();
  } catch {
    return [];
  }

  interface TI {
    str: string;
    x: number; // canvas pixels from left
    y: number; // canvas pixels from top
    w: number;
    h: number;
  }

  const textItems: TI[] = (tc.items as any[])
    .filter((it: any) => typeof it.str === "string" && it.str.trim().length > 0)
    .map((it: any) => {
      const tf = it.transform as number[];           // [a,b,c,d, pdfX, pdfY]
      const [cx, cy] = pdfToCanvas(viewport, tf[4], tf[5]);
      return {
        str: it.str.trim(),
        x:   cx,
        y:   cy,
        w:   (it.width  || 0) * SCALE,
        h:   (it.height || 10),            // height is already in px at scale
      };
    });

  if (textItems.length === 0) return [];

  // ── 3. Detect product reference codes ────────────────────────────────────
  // Typical format: "FOSTER", "GEMINI-ROL", "ZIWEI-BAM" — all uppercase,
  // 4+ chars, may contain digits and hyphens, no lowercase letters.
  const REF_RE = /^[A-Z][A-Z0-9][A-Z0-9\-]{2,}$/;
  const refs = textItems.filter(it => REF_RE.test(it.str));

  if (refs.length === 0) return [];

  // ── 4. Group refs into rows (similar canvas Y within 60 px) ──────────────
  const rows: TI[][] = [];
  for (const ref of [...refs].sort((a, b) => a.y - b.y)) {
    const existing = rows.find(r => Math.abs(r[0].y - ref.y) < 60);
    if (existing) existing.push(ref);
    else rows.push([ref]);
  }
  rows.sort((a, b) => a[0].y - b[0].y);

  // ── 5. For each row, find the bottom edge of the text block in that row ──
  function rowTextBottom(rowMidY: number): number {
    // Collect all text items within ~140 px below the reference
    const related = textItems.filter(
      it => it.y >= rowMidY - 20 && it.y <= rowMidY + 140
    );
    if (related.length === 0) return rowMidY + 60;
    return Math.max(...related.map(it => it.y)) + 4;
  }

  // ── 6. Crop image region for each product ────────────────────────────────
  const results: ExtractedImage[] = [];

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];

    // Card top = bottom edge of the previous row's text, or 5 px for first row
    let cardTop: number;
    if (ri === 0) {
      cardTop = 5;
    } else {
      const prevRowMidY = rows[ri - 1][0].y;
      const prevBottom  = rowTextBottom(prevRowMidY);
      const thisRefTop  = Math.min(...row.map(r => r.y - r.h));
      // Place separator midway between previous row text and this row's ref
      cardTop = Math.round((prevBottom + thisRefTop) / 2);
    }

    for (const ref of row) {
      // Gather all text for this product (within 180 px horizontally,
      // from ref Y down 180 px — covers name + price lines)
      const productText = textItems.filter(
        it =>
          Math.abs(it.x - ref.x) < 200 &&
          it.y >= ref.y - 25 &&
          it.y <= ref.y + 180
      );
      if (productText.length === 0) productText.push(ref);

      const minX = Math.max(0, Math.min(...productText.map(it => it.x)) - 20);
      const maxX = Math.min(W, Math.max(...productText.map(it => it.x + it.w)) + 20);

      // Image region is above the reference text
      const cardBottom = ref.y - ref.h - 6;

      const cropX = Math.round(minX);
      const cropY = Math.round(cardTop);
      const cropW = Math.round(maxX - minX);
      const cropH = Math.round(cardBottom - cardTop);

      if (cropW < 40 || cropH < 30) continue;

      // Clamp to canvas bounds
      const safeX = Math.max(0, Math.min(cropX, W - 1));
      const safeY = Math.max(0, Math.min(cropY, H - 1));
      const safeW = Math.min(cropW, W - safeX);
      const safeH = Math.min(cropH, H - safeY);
      if (safeW < 30 || safeH < 30) continue;

      const out = document.createElement("canvas");
      out.width  = safeW;
      out.height = safeH;
      out.getContext("2d")!.drawImage(
        pageCanvas,
        safeX, safeY, safeW, safeH,
        0,     0,     safeW, safeH
      );

      const dataUrl = out.toDataURL("image/jpeg", 0.93);
      if (dataUrl && dataUrl.length > 500) {
        results.push({
          dataUrl,
          pageNumber,
          quality:     assessQuality(safeW, safeH),
          widthPx:     safeW,
          heightPx:    safeH,
          detectedRef: ref.str,
        });
      }
    }
  }

  // Sort by page order (already in page/row/column order)
  return results;
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
