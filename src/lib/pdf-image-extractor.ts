// ── PDF Image Extractor ───────────────────────────────────────────────────────
// Strategy: render each page to canvas, then use the operator list to find
// the exact position of every paintImageXObject operation, and crop that
// region from the rendered canvas. This is reliable because:
//  1. page.render() forces all image resources to decode.
//  2. The operator list gives us the exact CTM (transform matrix) for each image.
//  3. viewport.convertToViewportPoint() handles PDF→canvas coordinate mapping.

export interface ExtractedImage {
  dataUrl: string;
  pageNumber: number;
  quality: "high" | "medium" | "low";
  widthPx: number;
  heightPx: number;
}

// ── Matrix helpers ────────────────────────────────────────────────────────────
function multiplyMatrix(m1: number[], m2: number[]): number[] {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + b1 * c2,
    a1 * b2 + b1 * d2,
    c1 * a2 + d1 * c2,
    c1 * b2 + d1 * d2,
    e1 * a2 + f1 * c2 + e2,
    e1 * b2 + f1 * d2 + f2,
  ];
}

function assessQuality(w: number, h: number): "high" | "medium" | "low" {
  const px = w * h;
  if (px >= 120 * 120) return "high";
  if (px >= 60  * 60)  return "medium";
  return "low";
}

// ── Extract images from one page ──────────────────────────────────────────────
async function extractPageImages(
  page: any,
  pdfjsLib: any,
  pageNumber: number,
  scale = 2.0
): Promise<ExtractedImage[]> {

  const viewport = page.getViewport({ scale });

  // 1. Render to canvas — this forces all image XObjects to decode into memory
  const canvas = document.createElement("canvas");
  canvas.width  = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d")!;

  try {
    await page.render({ canvasContext: ctx, viewport }).promise;
  } catch {
    return [];
  }

  // 2. Get operator list to find image paint operations and their transforms
  let opList: any;
  try {
    opList = await page.getOperatorList();
  } catch {
    return [];
  }

  const OPS         = pdfjsLib.OPS ?? {};
  const OP_SAVE     = OPS.save      ?? 40;
  const OP_RESTORE  = OPS.restore   ?? 41;
  const OP_TRANSFORM= OPS.transform ?? 12;
  const OP_IMG      = OPS.paintImageXObject     ?? 85;
  const OP_MASK     = OPS.paintImageMaskXObject  ?? 84;

  // 3. Walk operator list tracking the Current Transformation Matrix (CTM)
  let ctm: number[] = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  const results: ExtractedImage[] = [];
  const seen  = new Set<string>();

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn   = opList.fnArray[i];
    const args = opList.argsArray[i] ?? [];

    if      (fn === OP_SAVE)      { stack.push([...ctm]); }
    else if (fn === OP_RESTORE)   { ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0]; }
    else if (fn === OP_TRANSFORM) { ctm = multiplyMatrix(ctm, args as number[]); }
    else if (fn === OP_IMG || fn === OP_MASK) {

      // Image is painted into a unit square [0,1]×[0,1] under CTM.
      // Transform all 4 corners to PDF user space then to canvas pixels.
      const [a, b, c, d, e, f] = ctm;

      const corners = ([
        [0, 0], [1, 0], [1, 1], [0, 1],
      ] as [number, number][]).map(([px, py]) => {
        const ux = a * px + c * py + e;
        const uy = b * px + d * py + f;
        return viewport.convertToViewportPoint(ux, uy) as [number, number];
      });

      const cxs = corners.map(p => p[0]);
      const cys = corners.map(p => p[1]);
      const x = Math.round(Math.min(...cxs));
      const y = Math.round(Math.min(...cys));
      const w = Math.round(Math.max(...cxs) - Math.min(...cxs));
      const h = Math.round(Math.max(...cys) - Math.min(...cys));

      // Skip tiny images (icons, dividers, tiny logos)
      if (w < 55 || h < 55) continue;
      // Skip if outside canvas bounds
      if (x < 0 || y < 0 || x + w > canvas.width || y + h > canvas.height) continue;

      // Deduplicate by position+size (same XObject painted multiple times)
      const key = `${x}|${y}|${w}|${h}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // 4. Crop this exact region from the rendered canvas
      const out = document.createElement("canvas");
      out.width  = w;
      out.height = h;
      out.getContext("2d")!.drawImage(canvas, x, y, w, h, 0, 0, w, h);

      const dataUrl = out.toDataURL("image/jpeg", 0.92);
      if (!dataUrl || dataUrl === "data:,") continue;

      results.push({
        dataUrl,
        pageNumber,
        quality: assessQuality(w, h),
        widthPx: w,
        heightPx: h,
      });
    }
  }

  // Sort largest first (most likely to be the real product photos)
  results.sort((a, b) => (b.widthPx * b.heightPx) - (a.widthPx * a.heightPx));

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

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;

  const all: ExtractedImage[] = [];

  for (let p = 1; p <= numPages; p++) {
    onProgress?.(p, numPages);
    const page = await pdf.getPage(p);
    const imgs = await extractPageImages(page, pdfjsLib, p);
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
