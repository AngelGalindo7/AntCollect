import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import { CanvasStage } from '@/features/canvas/components/CanvasStage';
import { useCanvasState, CANVAS_WIDTH, CANVAS_HEIGHT } from '@/features/canvas/hooks/useCanvasState';
import type { CanvasState, CanvasNode, BackgroundConfig } from '@/features/canvas/types/canvas';
import type { NodeSource } from '@/features/canvas/types/canvas';
import type { Panel } from '../types/workspace';

export interface CanvasApiHandle {
  nodes: CanvasNode[];
  background: BackgroundConfig;
  isDirty: boolean;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  getCanvasJson: () => CanvasState;
  addNode: (url: string, source: NodeSource) => void;
  updateNode: (id: string, attrs: Partial<CanvasNode>) => void;
  removeNode: (id: string) => void;
  moveNodeUp: (id: string) => void;
  moveNodeDown: (id: string) => void;
  changeBackground: (bg: BackgroundConfig) => void;
  markClean: () => void;
}

interface Props {
  panel: Panel;
  isEditing: boolean;
  isOwner: boolean;
  stageRef?: React.RefObject<Konva.Stage | null>;
  onCanvasState?: (api: CanvasApiHandle) => void;
}

export function PanelEditor({ panel, isEditing, isOwner, stageRef, onCanvasState }: Props) {
  const canvasState = useCanvasState(panel.canvas_json as CanvasState | null);
  const {
    nodes, background, isDirty,
    addNode, updateNode, removeNode, moveNodeUp, moveNodeDown,
    changeBackground, markClean, getCanvasJson,
  } = canvasState;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setScale(Math.min(width / CANVAS_WIDTH, height / CANVAS_HEIGHT));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!isEditing || !onCanvasState) return;
    onCanvasState({
      nodes,
      background,
      isDirty,
      selectedId,
      setSelectedId,
      getCanvasJson,
      addNode,
      updateNode,
      removeNode,
      moveNodeUp,
      moveNodeDown,
      changeBackground,
      markClean,
    });
  }, [
    isEditing, onCanvasState,
    nodes, background, isDirty, selectedId, setSelectedId,
    getCanvasJson, addNode, updateNode, removeNode,
    moveNodeUp, moveNodeDown, changeBackground, markClean,
  ]);

  if (!isEditing || !isOwner) {
    if (panel.preview_path) {
      return (
        <img
          src={panel.preview_path}
          className="w-full h-full object-cover"
          alt=""
          draggable={false}
        />
      );
    }
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-50">
        <p className="text-neutral-300 text-xs select-none">Double-click to edit</p>
      </div>
    );
  }

  return (
    <div ref={canvasAreaRef} className="w-full h-full overflow-hidden bg-neutral-800">
      <CanvasStage
        ref={stageRef}
        nodes={nodes}
        background={background}
        selectedId={selectedId}
        keepRatio={true}
        onSelect={setSelectedId}
        onNodeUpdate={updateNode}
        onNodeDelete={removeNode}
        scale={scale}
      />
    </div>
  );
}
