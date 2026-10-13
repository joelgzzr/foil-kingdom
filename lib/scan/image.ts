import type { ScanImage } from "./types.ts";

export const MAX_PAGE_BYTES = 4 * 1024 * 1024;

// Sniffs the real format from the magic bytes; the declared content type is never trusted.
export function sniffImageType(bytes: Uint8Array): ScanImage["mimeType"] | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (
    bytes.length > 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export async function readScanImage(file: File, maxBytes: number): Promise<ScanImage | null> {
  if (file.size === 0 || file.size > maxBytes) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = sniffImageType(bytes);
  return mimeType ? { bytes, mimeType } : null;
}

export const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
