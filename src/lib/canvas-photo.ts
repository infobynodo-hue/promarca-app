// ── Canvas Photo Generator ────────────────────────────────────────────────────
// Generates 3 professional 1200×1200 product photos using only the browser Canvas API.
// No external API needed. Background matches the reference images provided.
//
// Style 1 — Hero:     product centered, soft reflection, gradient bg
// Style 2 — Detail:   zoom crop on upper/interesting area, same bg, slightly darker
// Style 3 — Dynamic:  product larger, slight rotation (-8°), more dramatic crop

const SIZE = 1200;

// ── Background: radial gradient matching the reference photos ─────────────────
// Dark blue-grey center top-left, lightening to near-white at bottom-right
function drawBackground(ctx: CanvasRenderingContext2D) {
  // Base gradient — light bottom
  const base = ctx.createLinearGradient(0, 0, 0, SIZE);
  base.addColorStop(0, "#c8c9cc");
  base.addColorStop(0.6, "#d8d9db");
  base.addColorStop(1, "#e8e9ea");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Radial dark blob — upper left (matches reference)
  const radial = ctx.createRadialGradient(SIZE * 0.25, SIZE * 0.2, 0, SIZE * 0.25, SIZE * 0.2, SIZE * 0.7);
  radial.addColorStop(0, "rgba(90,95,105,0.72)");
  radial.addColorStop(0.5, "rgba(120,125,135,0.35)");
  radial.addColorStop(1, "rgba(200,202,205,0)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Lighter patch — right side
  const light = ctx.createRadialGradient(SIZE * 0.85, SIZE * 0.3, 0, SIZE * 0.85, SIZE * 0.3, SIZE * 0.5);
  light.addColorStop(0, "rgba(230,232,235,0.5)");
  light.addColorStop(1, "rgba(200,202,205,0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Floor highlight — bottom strip
  const floor = ctx.createLinearGradient(0, SIZE * 0.78, 0, SIZE);
  floor.addColorStop(0, "rgba(240,241,243,0)");
  floor.addColorStop(0.4, "rgba(248,249,250,0.7)");
  floor.addColorStop(1, "rgba(252,253,254,0.9)");
  ctx.fillStyle = floor;
  ctx.fillRect(0, SIZE * 0.78, SIZE, SIZE * 0.22);
}

// ── Soft floor reflection ─────────────────────────────────────────────────────
function drawReflection(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  destX: number,
  destY: number,
  destW: number,
  destH: number
) {
  ctx.save();
  ctx.translate(destX + destW / 2, destY + destH);
  ctx.scale(1, -1);

  // Clip to a fading rectangle below the product
  const reflH = destH * 0.28;
  const grad = ctx.createLinearGradient(0, 0, 0, reflH);
  grad.addColorStop(0, "rgba(0,0,0,0.18)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "multiply";

  // Draw flipped image clipped to fade region
  const clipH = reflH;
  ctx.beginPath();
  ctx.rect(-destW / 2, 0, destW, clipH);
  ctx.clip();

  ctx.globalAlpha = 0.22;
  ctx.drawImage(img, -destW / 2, 0, destW, destH);
  ctx.restore();
}

// ── Load image from base64 or URL ─────────────────────────────────────────────
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ── Remove background using @imgly/background-removal ────────────────────────
async function removeBg(imageDataUrl: string): Promise<string> {
  try {
    const { removeBackground } = await import("@imgly/background-removal");
    const blob = await removeBackground(imageDataUrl, {
      output: { format: "image/png", quality: 1 },
    });
    return URL.createObjectURL(blob);
  } catch {
    // If bg removal fails, return original
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
// Product centered, occupies ~76% of frame, soft reflection below
async function generateHero(noBgUrl: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const img = await loadImage(noBgUrl);

  drawBackground(ctx);

  // Fit product into 80% of canvas, centered
  const maxDim = SIZE * 0.76;
  const scale = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  const x = (SIZE - w) / 2;
  const y = (SIZE - h) / 2 - SIZE * 0.03; // slightly above center

  drawReflection(ctx, img, x, y, w, h);
  ctx.drawImage(img, x, y, w, h);

  return canvasToBlob(canvas);
}

// ── STYLE 2: Detail ──────────────────────────────────────────────────────────
// Zoom into top 55% of the product (lid, top, handle, interesting part)
// Same background but with slightly deeper radial shadow
async function generateDetail(noBgUrl: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const img = await loadImage(noBgUrl);

  drawBackground(ctx);

  // Slightly darker overlay for depth feel
  const dark = ctx.createRadialGradient(SIZE * 0.3, SIZE * 0.15, 0, SIZE * 0.3, SIZE * 0.15, SIZE * 0.85);
  dark.addColorStop(0, "rgba(60,65,75,0.18)");
  dark.addColorStop(1, "rgba(60,65,75,0)");
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Zoom to top 55% of the product image (crop source)
  const cropH = img.naturalHeight * 0.55;
  const cropW = img.naturalWidth;
  const maxDim = SIZE * 0.88;
  const scale = Math.min(maxDim / cropW, maxDim / cropH);
  const w = cropW * scale;
  const h = cropH * scale;
  const x = (SIZE - w) / 2;
  const y = (SIZE - h) / 2;

  ctx.drawImage(img, 0, 0, cropW, cropH, x, y, w, h);

  return canvasToBlob(canvas);
}

// ── STYLE 3: Dynamic ─────────────────────────────────────────────────────────
// Product bigger (88%), rotated -8°, offset slightly to left — editorial feel
async function generateDynamic(noBgUrl: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const img = await loadImage(noBgUrl);

  drawBackground(ctx);

  const maxDim = SIZE * 0.88;
  const scale = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;

  ctx.save();
  // Rotate around canvas center, offset product slightly left
  ctx.translate(SIZE / 2 - SIZE * 0.04, SIZE / 2);
  ctx.rotate((-8 * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();

  return canvasToBlob(canvas);
}

// ── PUBLIC: Generate all 3 photos ────────────────────────────────────────────
export interface GeneratedPhotos {
  hero: Blob;
  detail: Blob;
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

  // Cleanup object URL if we created one
  if (noBgUrl.startsWith("blob:")) URL.revokeObjectURL(noBgUrl);

  return { hero, detail, dynamic };
}

// ── Blob to data URL helper ───────────────────────────────────────────────────
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsDataURL(blob);
  });
}
