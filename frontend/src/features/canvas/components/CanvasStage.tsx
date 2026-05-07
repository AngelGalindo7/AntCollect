import { forwardRef, useRef } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
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

export const CanvasStage = forwardRef<Konva.Stage, Props>(
  ({ nodes, background, selectedId, keepRatio, onSelect, onNodeUpdate, onNodeDelete, onLiveBoundsChange, scale }, ref) => {
    const stageContainerRef = useRef<HTMLDivElement>(null);

    const bgFill =
      background.type === 'color'
        ? { fill: background.value }
        : {
            fillLinearGradientStartPoint: { x: 0, y: 0 },
            fillLinearGradientEndPoint: { x: CANVAS_WIDTH, y: CANVAS_HEIGHT },
            fillLinearGradientColorStops: [0, background.value, 1, background.gradientEnd ?? '#ffffff'],
          };

    return (
      <div
        ref={stageContainerRef}
        className="pw-artboard-shadow"
        style={{
          borderRadius: 4,
          overflow: 'hidden',
          background: background.type === 'color' ? background.value : '#f6f1e6',
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
