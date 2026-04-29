import { useEffect, useRef } from 'react';
import { Image as KonvaImage, Transformer, Rect } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import type { CanvasNode as CanvasNodeType } from '../types/canvas';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../hooks/useCanvasState';

interface Props {
  node: CanvasNodeType;
  isSelected: boolean;
  keepRatio: boolean;
  onSelect: () => void;
  onUpdate: (attrs: Partial<CanvasNodeType>) => void;
  onDelete: () => void;
}

export function CanvasNode({ node, isSelected, keepRatio, onSelect, onUpdate, onDelete }: Props) {
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

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onUpdate({ x: e.target.x(), y: e.target.y() });
  };

  const handleTransformEnd = () => {
    const node = imageRef.current;
    if (!node) return;
    onUpdate({
      x: node.x(),
      y: node.y(),
      width: Math.max(30, node.width() * node.scaleX()),
      height: Math.max(30, node.height() * node.scaleY()),
      rotation: node.rotation(),
      scaleX: 1,
      scaleY: 1,
    });
    node.scaleX(1);
    node.scaleY(1);
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
          onDragEnd={handleDragEnd}
          onTransformEnd={handleTransformEnd}
          dragBoundFunc={(pos) => ({
            x: Math.max(0, Math.min(pos.x, CANVAS_WIDTH - node.width)),
            y: Math.max(0, Math.min(pos.y, CANVAS_HEIGHT - node.height)),
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
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 30 || newBox.height < 30 ? oldBox : newBox
          }
        />
      )}
    </>
  );
}
