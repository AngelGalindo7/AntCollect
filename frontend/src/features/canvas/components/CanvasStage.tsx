import { forwardRef, useRef } from 'react';
import { Stage, Layer, Rect, Group, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import { CanvasNode as CanvasNodeComponent, type LiveBounds } from './CanvasNode';
import type { CanvasNode, BackgroundConfig } from '../types/canvas';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../hooks/useCanvasState';

interface Props {
  nodes: CanvasNode[];
  background: BackgroundConfig;
  selectedId: string | null;
  keepRatio: boolean;
  onSelect: (id: string | null) => void;
  onNodeUpdate: (id: string, attrs: Partial<CanvasNode>) => void;
  onNodeDelete: (id: string) => void;
  onLiveBoundsChange?: (bounds: LiveBounds | null) => void;
  scale: number;
}

function BackgroundImageLayer({ config }: { config: BackgroundConfig }) {
  const [image] = useImage(config.imageUrl ?? '', 'anonymous');
  if (!image) return null;
  const userScale = config.imageScale ?? 1;
  const cover = Math.max(CANVAS_WIDTH / image.width, CANVAS_HEIGHT / image.height);
  const drawW = image.width * cover * userScale;
  const drawH = image.height * cover * userScale;
  const offX = (CANVAS_WIDTH - drawW) / 2 + (config.imageOffsetX ?? 0);
  const offY = (CANVAS_HEIGHT - drawH) / 2 + (config.imageOffsetY ?? 0);
  return (
    <Group clipX={0} clipY={0} clipWidth={CANVAS_WIDTH} clipHeight={CANVAS_HEIGHT} listening={false}>
      <KonvaImage image={image} x={offX} y={offY} width={drawW} height={drawH} listening={false} />
    </Group>
  );
}

export const CanvasStage = forwardRef<Konva.Stage, Props>(
  ({ nodes, background, selectedId, keepRatio, onSelect, onNodeUpdate, onNodeDelete, onLiveBoundsChange, scale }, ref) => {
    const stageContainerRef = useRef<HTMLDivElement>(null);

    const isImageBg = background.type === 'image' && !!background.imageUrl;

    const bgFill =
      background.type === 'gradient'
        ? {
            fillLinearGradientStartPoint: { x: 0, y: 0 },
            fillLinearGradientEndPoint: { x: CANVAS_WIDTH, y: CANVAS_HEIGHT },
            fillLinearGradientColorStops: [0, background.value, 1, background.gradientEnd ?? '#ffffff'],
          }
        : { fill: isImageBg ? '#f6f1e6' : background.value };

    return (
      <div
        ref={stageContainerRef}
        className="pw-artboard-shadow"
        style={{
          borderRadius: 4,
          overflow: 'hidden',
          background: isImageBg ? '#f6f1e6' : background.type === 'color' ? background.value : '#f6f1e6',
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
            {isImageBg && <BackgroundImageLayer config={background} />}
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
