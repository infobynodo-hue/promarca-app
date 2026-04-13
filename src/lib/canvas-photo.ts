// ── Canvas Photo Generator ────────────────────────────────────────────────────
// Generates 3 professional 1200×1200 product photos using only the browser Canvas API.
// Background matches the grey radial gradient from the reference images provided.
//
// Style 1 — Hero:    product centered, reflection anchored to actual product base
// Style 2 — Detail:  zoom on top 50% of ACTUAL product pixels (not image bounding box)
// Style 3 — Dynamic: product larger, slight rotation, editorial composition

const SIZE = 1200;

// ── Find actual non-transparent pixel bounds ──────────────────────────────────
// After background removal the PNG has lots of transparent space around the product.
// We need to know where the PRODUCT actually is to anchor the reflection and zoom.
interface Bounds {
  top: number;    // first row with alpha > 20
  bottom: number; // last row with alpha > 20
  left: number;
  right: number;
  width: number;
  height: number;
}

function getProductBounds(img: HTMLImageElement): Bounds {
  const tmp = document.createElement("canvas");
  tmp.width = img.naturalWidth;
  tmp.height = img.naturalHeight;
  const ctx = tmp.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, tmp.width, tmp.height);

  let top = tmp.height, bottom = 0, left = tmp.width, right = 0;

  for (let y = 0; y < tmp.height; y++) {
    for (let x = 0; x < tmp.width; x++) {
      const a = data[(y * tmp.width + x) * 4 + 3];
      if (a > 20) {
        if (y < top)    top    = y;
        if (y > bottom) bottom = y;
        if (x < left)   left   = x;
        if (x > right)  right  = x;
      }
    }
  }

  // Fallback: if nothing found use full image
  if (top > bottom) {
    top = 0; bottom = tmp.height - 1;
    left = 0; right = tmp.width - 1;
  }

  return {
    top, bottom, left, right,
    width:  right  - left   + 1,
    height: bottom - top    + 1,
  };
}

// ── Background ────────────────────────────────────────────────────────────────
function drawBackground(ctx: CanvasRenderingContext2D) {
  // Warm grey base — lightens toward bottom (matches reference)
  const base = ctx.createLinearGradient(0, 0, 0, SIZE);
  base.addColorStop(0,   "#c5c6c9");
  base.addColorStop(0.6, "#d5d6d8");
  base.addColorStop(1,   "#e6e7e8");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Dark radial blob — upper-left (matches reference)
  const blob = ctx.createRadialGradient(
    SIZE * 0.22, SIZE * 0.18, 0,
    SIZE * 0.22, SIZE * 0.18, SIZE * 0.68
  );
  blob.addColorStop(0,   "rgba(78,83,95,0.70)");
  blob.addColorStop(0.5, "rgba(110,115,125,0.32)");
  blob.addColorStop(1,   "rgba(195,197,200,0)");
  ctx.fillStyle = blob;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Soft light patch — right side
  const right = ctx.createRadialGradient(
    SIZE * 0.82, SIZE * 0.28, 0,
    SIZE * 0.82, SIZE * 0.28, SIZE * 0.46
  );
  right.addColorStop(0, "rgba(228,230,233,0.48)");
  right.addColorStop(1, "rgba(195,197,200,0)");
  ctx.fillStyle = right;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Floor highlight — bright bottom strip
  const floor = ctx.createLinearGradient(0, SIZE * 0.76, 0, SIZE);
  floor.addColorStop(0,   "rgba(242,243,244,0)");
  floor.addColorStop(0.4, "rgba(250,251,252,0.72)");
  floor.addColorStop(1,   "rgba(254,255,255,0.92)");
  ctx.fillStyle = floor;
  ctx.fillRect(0, SIZE * 0.76, SIZE, SIZE * 0.24);
}

// ── Floor reflection anchored to actual product bottom ────────────────────────
// productBottomY  = exact Y pixel on the canvas where the product ends
// destX, destW    = horizontal placement of the full image on canvas
// destY, destH    = vertical placement of the full image on canvas
// img             = the no-bg image element
function drawReflection(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  destX: number,
  destY: number,
  destW: number,
  destH: number,
  productBottomY: number  // actual product base in canvas coords
) {
  const reflH = destH * 0.22; // height of the reflection band

  ctx.save();
  // Translate to the exact product base, then flip vertically
  ctx.translate(destX + destW / 2, productBottomY);
  ctx.scale(1, -1);

  // Clip to reflection band
  ctx.beginPath();
  ctx.rect(-destW / 2, 0, destW, reflH);
  ctx.clip();

  // Fade gradient for the reflection (source → transparent)
  const fade = ctx.createLinearGradient(0, 0, 0, reflH);
  fade.addColorStop(0,   "rgba(255,255,255,0)");  // will use globalAlpha
  fade.addColorStop(1,   "rgba(255,255,255,1)");

  // Draw flipped product clipped to reflH
  // We offset vertically so we're drawing the BOTTOM of the product
  const srcOffsetY = destY - productBottomY; // negative — product is above
  ctx.globalAlpha = 0.28;
  ctx.drawImage(img, -destW / 2, srcOffsetY, destW, destH);

  // Fade overlay — erase the reflection progressively
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = fade;
  ctx.fillRect(-destW / 2, 0, destW, reflH);

  ctx.restore();
}

// ── Load image ────────────────────────────────────────────────────────────────
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ── Remove background ─────────────────────────────────────────────────────────
async function removeBg(imageDataUrl: string): Promise<string> {
  try {
    const { removeBackground } = await import("@imgly/background-removal");
    const blob = await removeBackground(imageDataUrl, {
      output: { format: "image/png", quality: 1 },
    });
    return URL.createObjectURL(blob);
  } catch {
    return imageDataUrl;
  }
}

// ── Export canvas to blob ─────────────────────────────────────────────────────
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
      "image/jpeg",
      0.93
    );
  });
}

// ── STYLE 1: Hero ─────────────────────────────────────────────────────────────
// Product fills 74% of canvas, vertically centered on its actual pixel content.
// Reflection starts exactly at the product's lowest pixel.
async function generateHero(noBgUrl: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width  = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const img = await loadImage(noBgUrl);

  drawBackground(ctx);

  const bounds = getProductBounds(img);

  // Scale so the PRODUCT (not the whole image) fits in 74% of canvas
  const maxDim = SIZE * 0.74;
  const scale  = Math.min(maxDim / bounds.width, maxDim / bounds.height);

  // Full image dimensions on canvas
  const w = img.naturalWidth  * scale;
  const h = img.naturalHeight * scale;

  // Center based on actual product center (not image center)
  const productCenterXImg = (bounds.left + bounds.right)  / 2;
  const productCenterYImg = (bounds.top  + bounds.bottom) / 2;

  const x = SIZE / 2 - productCenterXImg * scale;
  const y = SIZE / 2 - productCenterYImg * scale - SIZE * 0.02; // slightly above center

  // Calculate exact product bottom on canvas
  const productBottomY = y + bounds.bottom * scale;

  drawReflection(ctx, img, x, y, w, h, productBottomY);
  ctx.drawImage(img, x, y, w, h);

  return canvasToBlob(canvas);
}

// ── STYLE 2: Detail ──────────────────────────────────────────────────────────
// Zooms into the top 48% of the ACTUAL PRODUCT pixels (not the image bounding box).
// Shows lid, handle, logo area, texture — the interesting top part.
async function generateDetail(noBgUrl: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width  = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const img = await loadImage(noBgUrl);

  drawBackground(ctx);

  // Slightly richer shadow for depth feel
  const shadow = ctx.createRadialGradient(SIZE * 0.28, SIZE * 0.12, 0, SIZE * 0.28, SIZE * 0.12, SIZE * 0.82);
  shadow.addColorStop(0,   "rgba(55,60,70,0.20)");
  shadow.addColorStop(1,   "rgba(55,60,70,0)");
  ctx.fillStyle = shadow;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const bounds = getProductBounds(img);

  // Crop region in SOURCE image: top 48% of the product's pixel extent
  const srcX = bounds.left;
  const srcY = bounds.top;
  const srcW = bounds.width;
  const srcH = Math.round(bounds.height * 0.48);  // top 48% of actual product

  // Scale this crop to fill 90% of canvas
  const maxDim = SIZE * 0.90;
  const scale  = Math.min(maxDim / srcW, maxDim / srcH);
  const dstW   = srcW * scale;
  const dstH   = srcH * scale;

  // Center on canvas, slightly toward top
  const dstX = (SIZE - dstW) / 2;
  const dstY = (SIZE - dstH) / 2 - SIZE * 0.04;

  ctx.drawImage(img, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);

  return canvasToBlob(canvas);
}

// ── STYLE 3: Dynamic ─────────────────────────────────────────────────────────
// Product at 86%, rotated -8°, shifted left — editorial / catalog cover feel.
// Uses actual product center for rotation pivot.
async function generateDynamic(noBgUrl: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width  = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const img = await loadImage(noBgUrl);

  drawBackground(ctx);

  const bounds = getProductBounds(img);

  const maxDim = SIZE * 0.86;
  const scale  = Math.min(maxDim / bounds.width, maxDim / bounds.height);
  const w = img.naturalWidth  * scale;
  const h = img.naturalHeight * scale;

  const productCenterXImg = (bounds.left + bounds.right)  / 2;
  const productCenterYImg = (bounds.top  + bounds.bottom) / 2;

  ctx.save();
  // Pivot around canvas center with slight left offset
  ctx.translate(SIZE / 2 - SIZE * 0.03, SIZE / 2 + SIZE * 0.01);
  ctx.rotate((-8 * Math.PI) / 180);
  // Draw image so product center lands on pivot
  ctx.drawImage(
    img,
    -productCenterXImg * scale,
    -productCenterYImg * scale,
    w,
    h
  );
  ctx.restore();

  return canvasToBlob(canvas);
}

// ── PUBLIC ────────────────────────────────────────────────────────────────────
export interface GeneratedPhotos {
  hero:    Blob;
  detail:  Blob;
  dynamic: Blob;
}

export async function generateProductPhotos(
  imageDataUrl: string,
  onProgress?: (step: string) => void
): Promise<GeneratedPhotos> {
  onProgress?.("Eliminando fondo…");
  const noBgUrl = await removeBg(imageDataUrl);

  onProgress?.("Generando foto hero…");
  const hero = await generateHero(noBgUrl);

  onProgress?.("Generando detalle…");
  const detail = await generateDetail(noBgUrl);

  onProgress?.("Generando vista dinámica…");
  const dynamic = await generateDynamic(noBgUrl);

  if (noBgUrl.startsWith("blob:")) URL.revokeObjectURL(noBgUrl);

  return { hero, detail, dynamic };
}

// ── Helper ────────────────────────────────────────────────────────────────────
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsDataURL(blob);
  });
}
