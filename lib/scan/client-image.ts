import type { CardBox } from "./types.ts";

const PAGE_MAX_EDGE = 2048;
const PAGE_MAX_BYTES = 3.5 * 1024 * 1024;
const CROP_MAX_EDGE = 320;

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode_failed"))), "image/jpeg", quality),
  );

// Honors EXIF orientation, which phones rely on for portrait photos.
export const decodePhoto = (file: Blob) => createImageBitmap(file, { imageOrientation: "from-image" });

function drawScaled(source: ImageBitmap, sx: number, sy: number, sw: number, sh: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  canvas.getContext("2d")!.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// Downscales a camera photo to a JPEG the API accepts (phone photos are often 5-10 MB).
export async function compressPage(bitmap: ImageBitmap): Promise<Blob> {
  const canvas = drawScaled(bitmap, 0, 0, bitmap.width, bitmap.height, PAGE_MAX_EDGE);
  for (const quality of [0.85, 0.75, 0.65, 0.5]) {
    const blob = await toBlob(canvas, quality);
    if (blob.size <= PAGE_MAX_BYTES) return blob;
  }
  return toBlob(canvas, 0.4);
}

// Cuts one card out of the page using the detector's normalized box, with a little margin for imprecise boxes.
export async function cropCard(bitmap: ImageBitmap, box: CardBox): Promise<Blob> {
  const padX = box.width * 0.02;
  const padY = box.height * 0.02;
  const x = Math.max(0, box.x - padX) * bitmap.width;
  const y = Math.max(0, box.y - padY) * bitmap.height;
  const width = Math.min(bitmap.width - x, (box.width + padX * 2) * bitmap.width);
  const height = Math.min(bitmap.height - y, (box.height + padY * 2) * bitmap.height);
  return toBlob(drawScaled(bitmap, x, y, width, height, CROP_MAX_EDGE), 0.85);
}
