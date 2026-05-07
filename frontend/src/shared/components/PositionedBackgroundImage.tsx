import { useEffect, useState, type CSSProperties } from "react";
import { HEADER_FRAME_WIDTH, HEADER_FRAME_HEIGHT } from "@/shared/utils/profileBackground";

interface Props {
  src: string;
  offsetX: number;
  offsetY: number;
  scale: number;
  className?: string;
}

export function PositionedBackgroundImage({ src, offsetX, offsetY, scale, className }: Props) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!size) return null;

  const cover = Math.max(HEADER_FRAME_WIDTH / size.w, HEADER_FRAME_HEIGHT / size.h);
  const drawW = size.w * cover * scale;
  const drawH = size.h * cover * scale;
  const frameX = (HEADER_FRAME_WIDTH - drawW) / 2 + offsetX;
  const frameY = (HEADER_FRAME_HEIGHT - drawH) / 2 + offsetY;

  const style: CSSProperties = {
    position: "absolute",
    left: `${(frameX / HEADER_FRAME_WIDTH) * 100}%`,
    top: `${(frameY / HEADER_FRAME_HEIGHT) * 100}%`,
    width: `${(drawW / HEADER_FRAME_WIDTH) * 100}%`,
    height: `${(drawH / HEADER_FRAME_HEIGHT) * 100}%`,
    pointerEvents: "none",
    userSelect: "none",
  };

  return <img src={src} alt="" draggable={false} style={style} className={className} />;
}
