// Client-side image resize for restaurant + Suggestion photo uploads.
// Caps the longest edge at 1200px and re-encodes JPEG q=0.8 — the resulting
// blob is typically <200KB, well inside the soft cap docs/dining-guide-spec.md
// and ADR-0003 name. Browser-only (uses canvas + FileReader + Image).

const MAX_WIDTH = 1200;
const QUALITY = 0.8;

export async function resizeImage(file: File): Promise<Blob> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result as string);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new window.Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });

  const scale = Math.min(1, MAX_WIDTH / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((res, rej) => {
    canvas.toBlob(
      (blob) => (blob ? res(blob) : rej(new Error("toBlob returned null"))),
      "image/jpeg",
      QUALITY,
    );
  });
}
