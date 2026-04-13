// ── PDF Image Extractor ───────────────────────────────────────────────────────
// Extracts embedded image XObjects (JPEG/PNG) directly from the PDF structure.
// Much more reliable than rendering pages to canvas and cropping a grid.

export interface ExtractedImage {
  dataUrl: string;
  pageNumber: number;
  quality: "high" | "medium" | "low";
  widthPx: number;
  heightPx: number;
}

// ── Convert raw image data (RGBA or RGB) to JPEG data URL via canvas ──────────
function imageDataToDataUrl(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const imgData = ctx.createImageData(width, height);

  const pixels = width * height;

  if (data.length >= pixels * 4) {
    // Already RGBA
    imgData.data.set(data.subarray(0, pixels * 4));
  } else if (data.length >= pixels * 3) {
    // RGB → RGBA
    for (let i = 0; i < pixels; i++) {
      imgData.data[i * 4]     = data[i * 3];
      imgData.data[i * 4 + 1] = data[i * 3 + 1];
      imgData.data[i * 4 + 2] = data[i * 3 + 2];
      imgData.data[i * 4 + 3] = 255;
    }
  } else if (data.length >= pixels) {
    // Grayscale → RGBA
    for (let i = 0; i < pixels; i++) {
      imgData.data[i * 4]     = data[i];
      imgData.data[i * 4 + 1] = data[i];
      imgData.data[i * 4 + 2] = data[i];
      imgData.data[i * 4 + 3] = 255;
    }
  } else {
    return "";
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.92);
}

// ── Assess quality based on pixel dimensions ──────────────────────────────────
function assessQuality(w: number, h: number): "high" | "medium" | "low" {
  const px = w * h;
  if (px >= 150 * 150) return "high";
  if (px >= 80  * 80)  return "medium";
  return "low";
}

// ── Get image object from page objs (handles callback & promise APIs) ─────────
function getImageObj(page: any, name: string): Promise<any> {
  return new Promise((resolve) => {
    try {
      const result = page.objs.get(name, (img: any) => resolve(img));
      // Some PDF.js versions return the value directly if already resolved
      if (result !== undefined && result !== null) resolve(result);
    } catch {
      resolve(null);
    }
  });
}

// ── Extract images from one page via operator list ────────────────────────────
async function extractPageImages(
  page: any,
  pdfjsLib: any,
  pageNumber: number
): Promise<ExtractedImage[]> {
  const results: ExtractedImage[] = [];

  let opList: any;
  try {
    opList = await page.getOperatorList();
  } catch {
    return results;
  }

  // Collect unique image XObject names from the operator list
  const PAINT_IMAGE    = pdfjsLib.OPS?.paintImageXObject     ?? 85;
  const PAINT_MASK     = pdfjsLib.OPS?.paintImageMaskXObject  ?? 84;
  const PAINT_INLINE   = pdfjsLib.OPS?.paintInlineImageXObject ?? 83;

  const imageNames = new Set<string>();

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    if (fn === PAINT_IMAGE || fn === PAINT_MASK) {
      const name = opList.argsArray[i]?.[0];
      if (name) imageNames.add(name);
    }
    // Inline images are already decoded in the args
    if (fn === PAINT_INLINE) {
      const imgObj = opList.argsArray[i]?.[0];
      if (imgObj?.data && imgObj.width && imgObj.height) {
        const q = assessQuality(imgObj.width, imgObj.height);
        const dataUrl = imageDataToDataUrl(imgObj.data, imgObj.width, imgObj.height);
        if (dataUrl) {
          results.push({ dataUrl, pageNumber, quality: q, widthPx: imgObj.width, heightPx: imgObj.height });
        }
      }
    }
  }

  // Fetch each XObject image
  for (const name of imageNames) {
    try {
      const img = await getImageObj(page, name);
      if (!img) continue;

      const w = img.width  ?? img.bitmap?.width;
      const h = img.height ?? img.bitmap?.height;
      if (!w || !h) continue;

      // Skip tiny images (icons, decorations, logos pequeños)
      if (w < 60 || h < 60) continue;

      let dataUrl = "";

      // Case 1: img.bitmap is an ImageBitmap (newer PDF.js)
      if (img.bitmap) {
        const canvas = document.createElement("canvas");
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img.bitmap, 0, 0);
        dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      }
      // Case 2: img.data is raw pixel data
      else if (img.data) {
        dataUrl = imageDataToDataUrl(img.data, w, h);
      }

      if (!dataUrl) continue;

      const q = assessQuality(w, h);
      results.push({ dataUrl, pageNumber, quality: q, widthPx: w, heightPx: h });
    } catch {
      // Skip images that fail
    }
  }

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

  const allImages: ExtractedImage[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(pageNum, numPages);
    const page = await pdf.getPage(pageNum);
    const pageImages = await extractPageImages(page, pdfjsLib, pageNum);
    allImages.push(...pageImages);
    page.cleanup();
  }

  // Sort by quality desc, then size desc
  allImages.sort((a, b) => {
    const qOrder = { high: 0, medium: 1, low: 2 };
    if (qOrder[a.quality] !== qOrder[b.quality]) return qOrder[a.quality] - qOrder[b.quality];
    return (b.widthPx * b.heightPx) - (a.widthPx * a.heightPx);
  });

  // Deduplicate: skip images that are nearly identical in size from same page
  // (same XObject referenced multiple times)
  const seen = new Set<string>();
  const deduped = allImages.filter((img) => {
    const key = `${img.pageNumber}-${img.widthPx}-${img.heightPx}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped;
}

// ── Upload PDF to Supabase Storage for large file support ─────────────────────
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
