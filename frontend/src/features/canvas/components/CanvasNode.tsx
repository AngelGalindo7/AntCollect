import { useEffect, useRef } from 'react';
import { Image as KonvaImage, Transformer, Rect } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import type { CanvasNode as CanvasNodeType } from '../types/canvas';

export interface LiveBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

interface Props {
  node: CanvasNodeType;
  isSelected: boolean;
  keepRatio: boolean;
  boundsW: number;
  boundsH: number;
  onSelect: () => void;
  onUpdate: (attrs: Partial<CanvasNodeType>) => void;
  onDelete: () => void;
  onLiveBoundsChange?: (bounds: LiveBounds | null) => void;
}

export function CanvasNode({ node, isSelected, keepRatio, boundsW, boundsH, onSelect, onUpdate, onDelete, onLiveBoundsChange }: Props) {
  const [image, status] = useImage(node.image_url, 'anonymous');
  const imageRef = useRef<Konva.Image>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && transformerRef.current && imageRef.current) {
      transformerRef.current.nodes([imageRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isSelected && (e.key === 'Delete' || e.key === 'Backspace')) {
        onDelete();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isSelected, onDelete]);

  const emitLive = () => {
    const n = imageRef.current;
    if (!n || !onLiveBoundsChange) return;
    onLiveBoundsChange({
      x: n.x(),
      y: n.y(),
      width: Math.max(1, n.width() * n.scaleX()),
      height: Math.max(1, n.height() * n.scaleY()),
      rotation: n.rotation(),
    });
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onLiveBoundsChange?.(null);
    onUpdate({ x: e.target.x(), y: e.target.y() });
  };

  const handleTransformEnd = () => {
    const n = imageRef.current;
    if (!n) return;
    onLiveBoundsChange?.(null);
    onUpdate({
      x: n.x(),
      y: n.y(),
      width: Math.max(30, n.width() * n.scaleX()),
      height: Math.max(30, n.height() * n.scaleY()),
      rotation: n.rotation(),
      scaleX: 1,
      scaleY: 1,
    });
    n.scaleX(1);
    n.scaleY(1);
  };

  return (
    <>
      {status === 'loading' ? (
        <Rect
          x={node.x}
          y={node.y}
          width={node.width}
          height={node.height}
          fill="#e5e5e5"
          cornerRadius={6}
          onClick={onSelect}
          onTap={onSelect}
        />
      ) : (
        <KonvaImage
          ref={imageRef}
          image={image}
          x={node.x}
          y={node.y}
          width={node.width}
          height={node.height}
          rotation={node.rotation}
          scaleX={node.scaleX}
          scaleY={node.scaleY}
          draggable
          onClick={onSelect}
          onTap={onSelect}
          onDragStart={emitLive}
          onDragMove={emitLive}
          onDragEnd={handleDragEnd}
          onTransformStart={emitLive}
          onTransform={emitLive}
          onTransformEnd={handleTransformEnd}
          shadowColor="black"
          shadowBlur={8}
          shadowOpacity={0.18}
          shadowOffsetX={0}
          shadowOffsetY={4}
          dragBoundFunc={(pos) => ({
            x: Math.max(0, Math.min(pos.x, boundsW - node.width)),
            y: Math.max(0, Math.min(pos.y, boundsH - node.height)),
          })}
        />
      )}
      {isSelected && (
        <Transformer
          ref={transformerRef}
          keepRatio={keepRatio}
          enabledAnchors={
            keepRatio
              ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
              : ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']
          }
          rotateEnabled
          rotateAnchorOffset={28}
          borderStroke="#1c1a16"
          borderStrokeWidth={1.5}
          borderDash={[6, 4]}
          anchorFill="#ffffff"
          anchorStroke="#1c1a16"
          anchorStrokeWidth={1.5}
          anchorSize={10}
          anchorCornerRadius={2}
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 30 || newBox.height < 30 ? oldBox : newBox
          }
        />
      )}
    </>
  );
}
