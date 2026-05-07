import { forwardRef, useRef } from 'react';
import { Stage, Layer, Rect, Group, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import { CanvasNode as CanvasNodeComponent, type LiveBounds } from './CanvasNode';
import type { CanvasNode, BackgroundConfig } from '../types/canvas';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../hooks/useCanvasState';

export interface BackgroundOverride {
  imageUrl: string;
  offsetX: number;
  offsetY: number;
  scale: number;
}

interface Props {
  nodes: CanvasNode[];
  background: BackgroundConfig;
  backgroundOverride?: BackgroundOverride | null;
  selectedId: string | null;
  keepRatio: boolean;
  onSelect: (id: string | null) => void;
  onNodeUpdate: (id: string, attrs: Partial<CanvasNode>) => void;
  onNodeDelete: (id: string) => void;
  onLiveBoundsChange?: (bounds: LiveBounds | null) => void;
  scale: number;
}

function BackgroundImageLayer({ imageUrl, offsetX, offsetY, scale }: { imageUrl: string; offsetX: number; offsetY: number; scale: number }) {
  const [image] = useImage(imageUrl, 'anonymous');
  if (!image) return null;
  const cover = Math.max(CANVAS_WIDTH / image.width, CANVAS_HEIGHT / image.height);
  const drawW = image.width * cover * scale;
  const drawH = image.height * cover * scale;
  const offX = (CANVAS_WIDTH - drawW) / 2 + offsetX;
  const offY = (CANVAS_HEIGHT - drawH) / 2 + offsetY;
  return (
    <Group clipX={0} clipY={0} clipWidth={CANVAS_WIDTH} clipHeight={CANVAS_HEIGHT} listening={false}>
      <KonvaImage image={image} x={offX} y={offY} width={drawW} height={drawH} listening={false} />
    </Group>
  );
}

export const CanvasStage = forwardRef<Konva.Stage, Props>(
  ({ nodes, background, backgroundOverride, selectedId, keepRatio, onSelect, onNodeUpdate, onNodeDelete, onLiveBoundsChange, scale }, ref) => {
    const stageContainerRef = useRef<HTMLDivElement>(null);

    const isImageBg = background.type === 'image' && !!background.imageUrl;
    const bgImageUrl = backgroundOverride?.imageUrl ?? (isImageBg ? background.imageUrl! : null);
    const bgImageOffsetX = backgroundOverride?.offsetX ?? background.imageOffsetX ?? 0;
    const bgImageOffsetY = backgroundOverride?.offsetY ?? background.imageOffsetY ?? 0;
    const bgImageScale = backgroundOverride?.scale ?? background.imageScale ?? 1;
    const isImageBgRendered = !!bgImageUrl;

    const bgFill =
      background.type === 'gradient'
        ? {
            fillLinearGradientStartPoint: { x: 0, y: 0 },
            fillLinearGradientEndPoint: { x: CANVAS_WIDTH, y: CANVAS_HEIGHT },
            fillLinearGradientColorStops: [0, background.value, 1, background.gradientEnd ?? '#ffffff'],
          }
        : { fill: isImageBgRendered ? '#f6f1e6' : background.value };

    return (
      <div
        ref={stageContainerRef}
        className="pw-artboard-shadow"
        style={{
          borderRadius: 4,
          overflow: 'hidden',
          background: isImageBgRendered ? '#f6f1e6' : background.type === 'color' ? background.value : '#f6f1e6',
        }}
      >
        <Stage
          ref={ref}
          width={CANVAS_WIDTH * scale}
          height={CANVAS_HEIGHT * scale}
          scaleX={scale}
          scaleY={scale}
          onMouseDown={(e) => { if (e.target === e.target.getStage()) onSelect(null); }}
          onTouchStart={(e) => { if (e.target === e.target.getStage()) onSelect(null); }}
        >
          <Layer>
            <Rect
              x={0}
              y={0}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              {...bgFill}
              listening={false}
            />
            {bgImageUrl && (
              <BackgroundImageLayer
                imageUrl={bgImageUrl}
                offsetX={bgImageOffsetX}
                offsetY={bgImageOffsetY}
                scale={bgImageScale}
              />
            )}
            {nodes.map((node) => (
              <CanvasNodeComponent
                key={node.id}
                node={node}
                isSelected={selectedId === node.id}
                keepRatio={keepRatio}
                onSelect={() => onSelect(node.id)}
                onUpdate={(attrs) => onNodeUpdate(node.id, attrs)}
                onDelete={() => onNodeDelete(node.id)}
                onLiveBoundsChange={selectedId === node.id ? onLiveBoundsChange : undefined}
              />
            ))}
          </Layer>
        </Stage>
      </div>
    );
  },
);
CanvasStage.displayName = 'CanvasStage';
