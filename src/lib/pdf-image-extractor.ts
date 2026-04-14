// ── PDF Image Extractor v7 ────────────────────────────────────────────────────
// Strategy: render each page to canvas, then detect the product grid visually
// by scanning for horizontal/vertical whitespace bands that separate cards.
// No text-extraction required — works regardless of PDF encoding.
//
// Approach hierarchy:
//   1. Text-based crop (uses getTextContent + ref detection) — most accurate
//   2. Visual separator scan (brightness profile analysis) — robust fallback
//   3. Fixed 3-column grid — absolute last resort

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

// ── PDF user-space → canvas pixels ───────────────────────────────────────────
function pdfToCanvas(viewport: any, pdfX: number, pdfY: number): [number, number] {
  if (typeof viewport.convertToViewportPoint === "function") {
    return viewport.convertToViewportPoint(pdfX, pdfY) as [number, number];
  }
  const vt = viewport.transform as number[];
  return [
    vt[0] * pdfX + vt[2] * pdfY + vt[4],
    vt[1] * pdfX + vt[3] * pdfY + vt[5],
  ];
}

// ── Brightness profile along rows or columns ──────────────────────────────────
function brightnessProfile(
  data: Uint8ClampedArray,
  W: number,
  H: number,
  horizontal: boolean  // true = scan rows, false = scan columns
): Float32Array {
  const SIZE = horizontal ? H : W;
  const PERP = horizontal ? W : H;
  const STEP = Math.max(1, Math.floor(PERP / 80));
  const out  = new Float32Array(SIZE);

  for (let i = 0; i < SIZE; i++) {
    let sum = 0, count = 0;
    for (let j = 0; j < PERP; j += STEP) {
      const x = horizontal ? j : i;
      const y = horizontal ? i : j;
      const idx = (y * W + x) * 4;
      sum += (data[idx] * 299 + data[idx + 1] * 587 + data[idx + 2] * 114) / 1000;
      count++;
    }
    out[i] = count > 0 ? sum / count : 255;
  }
  return out;
}

// ── Find midpoints of high-brightness separator bands ─────────────────────────
function findSeparators(
  profile: Float32Array,
  threshold: number,
  minBand: number,
  total: number,
  minCell: number   // minimum distance between consecutive bounds
): number[] {
  const bounds = [0];
  let inSep = false, sepStart = 0;

  for (let i = 0; i < profile.length; i++) {
    if (profile[i] >= threshold) {
      if (!inSep) { inSep = true; sepStart = i; }
    } else {
      if (inSep) {
        const bandW = i - sepStart;
        if (bandW >= minBand) {
          const mid = Math.round((sepStart + i) / 2);
          if (mid - bounds[bounds.length - 1] >= minCell) {
            bounds.push(mid);
          }
        }
        inSep = false;
      }
    }
  }
  bounds.push(total);
  return bounds;
}

// ── Crop helper ───────────────────────────────────────────────────────────────
function cropCanvas(
  src: HTMLCanvasElement,
  x: number, y: number, w: number, h: number,
  pageNumber: number,
  detectedRef?: string
): ExtractedImage | null {
  if (w < 40 || h < 30) return null;
  const out = document.createElement("canvas");
  out.width  = w;
  out.height = h;
  out.getContext("2d")!.drawImage(src, x, y, w, h, 0, 0, w, h);
  const dataUrl = out.toDataURL("image/jpeg", 0.92);
  if (!dataUrl || dataUrl.length < 500) return null;
  return { dataUrl, pageNumber, quality: assessQuality(w, h), widthPx: w, heightPx: h, detectedRef };
}

// ── Approach 1: Text-based crop ───────────────────────────────────────────────
async function textBasedExtract(
  page: any,
  pageCanvas: HTMLCanvasElement,
  viewport: any,
  W: number,
  H: number,
  pageNumber: number
): Promise<ExtractedImage[]> {
  let tc: any;
  try { tc = await page.getTextContent(); } catch { return []; }
  if (!tc?.items?.length) return [];

  interface TI { str: string; norm: string; x: number; y: number; h: number; w: number }

  const SCALE = viewport.scale as number;

  const items: TI[] = (tc.items as any[])
    .filter((it: any) => typeof it.str === "string" && it.str.trim().length > 0)
    .map((it: any) => {
      const tf = it.transform as number[];
      const [cx, cy] = pdfToCanvas(viewport, tf[4], tf[5]);
      const fontH = Math.max(Math.abs(tf[3]) * SCALE, 10);
      return {
        str:  it.str.trim(),
        norm: it.str.trim().toUpperCase().replace(/\s/g, ""),
        x: cx,
        y: cy,
        h: fontH,
        w: Math.max((it.width || 0) * SCALE, 10),
      };
    });

  // Reference codes: all uppercase letters/digits/hyphens, 3–18 chars, no space
  const REF_RE = /^[A-Z][A-Z0-9\-]{2,17}$/;
  const refs = items.filter(it => REF_RE.test(it.norm) && !it.str.includes(" "));

  // Need at least 3 refs to be confident this approach is working
  if (refs.length < 3) return [];

  // Group into rows (refs within 60px vertically)
  const rows: TI[][] = [];
  for (const ref of [...refs].sort((a, b) => a.y - b.y)) {
    const row = rows.find(r => Math.abs(r[0].y - ref.y) < 60);
    if (row) row.push(ref);
    else rows.push([ref]);
  }
  rows.sort((a, b) => a[0].y - b[0].y);

  function rowBottom(midY: number): number {
    const rel = items.filter(it => it.y >= midY && it.y <= midY + 160);
    return rel.length ? Math.max(...rel.map(it => it.y)) + 6 : midY + 70;
  }

  const results: ExtractedImage[] = [];

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const cardTop = ri === 0
      ? 5
      : Math.round((rowBottom(rows[ri - 1][0].y) + Math.min(...row.map(r => r.y - r.h))) / 2);

    for (const ref of row) {
      const productItems = items.filter(
        it => Math.abs(it.x - ref.x) < 220 && it.y >= ref.y - 30 && it.y <= ref.y + 200
      );
      if (!productItems.length) productItems.push(ref);

      const minX    = Math.max(0, Math.min(...productItems.map(it => it.x)) - 20);
      const maxX    = Math.min(W, Math.max(...productItems.map(it => it.x + it.w)) + 20);
      const cardBot = ref.y - ref.h - 8;

      const cx = Math.round(minX);
      const cy = Math.round(cardTop);
      const cw = Math.min(Math.round(maxX - minX), W - cx);
      const ch = Math.min(Math.round(cardBot - cardTop), H - cy);

      const img = cropCanvas(pageCanvas, cx, cy, cw, ch, pageNumber, ref.str);
      if (img) results.push(img);
    }
  }

  return results;
}

// ── Approach 2: Visual separator scan ────────────────────────────────────────
function visualGridExtract(
  pageCanvas: HTMLCanvasElement,
  W: number,
  H: number,
  pageNumber: number
): ExtractedImage[] {
  const ctx     = pageCanvas.getContext("2d")!;
  const imgData = ctx.getImageData(0, 0, W, H);
  const data    = imgData.data;

  const rowProf = brightnessProfile(data, W, H, true);
  const colProf = brightnessProfile(data, W, H, false);

  // Threshold: 238 catches light gray separators too
  const hBounds = findSeparators(rowProf, 238, 4, H, 80);
  const vBounds = findSeparators(colProf, 238, 6, W, 60);

  // If grid detection yielded no useful cells, fall back to fixed grid
  if (hBounds.length < 3 || vBounds.length < 3) {
    return fixedGridExtract(pageCanvas, data, W, H, pageNumber);
  }

  const results: ExtractedImage[] = [];

  for (let ri = 0; ri < hBounds.length - 1; ri++) {
    for (let ci = 0; ci < vBounds.length - 1; ci++) {
      const cellX = vBounds[ci];
      const cellY = hBounds[ri];
      const cellW = vBounds[ci + 1] - cellX;
      const cellH = hBounds[ri + 1] - cellY;

      if (cellW < 50 || cellH < 60) continue;

      // Image: top 62% of cell, with small inset
      const padX  = Math.max(4, Math.round(cellW * 0.02));
      const padY  = Math.max(3, Math.round(cellH * 0.01));
      const imgH  = Math.round(cellH * 0.62);

      const cx = cellX + padX;
      const cy = cellY + padY;
      const cw = Math.min(cellW - 2 * padX, W - cx);
      const ch = Math.min(imgH - padY,       H - cy);

      // Skip empty cells (center pixel is nearly pure white)
      const midIdx = (Math.round(cy + ch / 2) * W + Math.round(cx + cw / 2)) * 4;
      const lum    = (data[midIdx] * 299 + data[midIdx+1] * 587 + data[midIdx+2] * 114) / 1000;
      if (lum > 252) continue;

      const img = cropCanvas(pageCanvas, cx, cy, cw, ch, pageNumber);
      if (img) results.push(img);
    }
  }

  return results;
}

// ── Approach 3: Fixed 3-column grid (last resort) ─────────────────────────────
function fixedGridExtract(
  pageCanvas: HTMLCanvasElement,
  data: Uint8ClampedArray,
  W: number,
  H: number,
  pageNumber: number,
  cols = 3
): ExtractedImage[] {
  // Estimate row count: scan middle column for dark→light→dark transitions
  const midX  = Math.round(W / 2);
  let rowCount = 3; // default

  // Heuristic: count light bands in center column
  let prevDark = false, bands = 0;
  const STEP  = Math.max(1, Math.floor(H / 300));
  for (let y = 0; y < H; y += STEP) {
    const idx = (y * W + midX) * 4;
    const lum = (data[idx] * 299 + data[idx+1] * 587 + data[idx+2] * 114) / 1000;
    const dark = lum < 200;
    if (!prevDark && dark) bands++;
    prevDark = dark;
  }
  if (bands >= 2) rowCount = bands;

  const cellW = Math.floor(W / cols);
  const cellH = Math.floor(H / rowCount);
  const results: ExtractedImage[] = [];

  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < cols; c++) {
      const x  = c * cellW + 6;
      const y  = r * cellH + 4;
      const cw = cellW - 12;
      const ch = Math.round(cellH * 0.58);

      const img = cropCanvas(pageCanvas, x, y, cw, ch, pageNumber);
      if (img) results.push(img);
    }
  }
  return results;
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

  const pageCanvas = document.createElement("canvas");
  pageCanvas.width  = W;
  pageCanvas.height = H;
  const ctx = pageCanvas.getContext("2d")!;

  try {
    await page.render({ canvasContext: ctx, viewport }).promise;
  } catch {
    return [];
  }

  // ── Try approach 1: text-based ──────────────────────────────────────────
  const textResults = await textBasedExtract(page, pageCanvas, viewport, W, H, pageNumber);
  if (textResults.length >= 2) return textResults;

  // ── Fallback: visual grid detection ─────────────────────────────────────
  return visualGridExtract(pageCanvas, W, H, pageNumber);
}

// ── Main entry point ──────────────────────────────────────────────────────────
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
