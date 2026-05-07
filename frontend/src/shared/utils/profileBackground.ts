import type { BackgroundImagePosition } from "@/features/canvas/components/BackgroundImagePositioner";

export const HEADER_FRAME_WIDTH = 1800;
export const HEADER_FRAME_HEIGHT = 300;

function loadHTMLImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function bakePositionedImage(
  src: string,
  frameWidth: number,
  frameHeight: number,
  position: BackgroundImagePosition,
): Promise<Blob> {
  const img = await loadHTMLImage(src);
  const cover = Math.max(frameWidth / img.naturalWidth, frameHeight / img.naturalHeight);
  const drawW = img.naturalWidth * cover * position.scale;
  const drawH = img.naturalHeight * cover * position.scale;
  const offX = (frameWidth - drawW) / 2 + position.offsetX;
  const offY = (frameHeight - drawH) / 2 + position.offsetY;

  const canvas = document.createElement("canvas");
  canvas.width = frameWidth;
  canvas.height = frameHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");
  ctx.fillStyle = "#f6f1e6";
  ctx.fillRect(0, 0, frameWidth, frameHeight);
  ctx.drawImage(img, offX, offY, drawW, drawH);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Blob conversion failed"))),
      "image/jpeg",
      0.92,
    );
  });
}
