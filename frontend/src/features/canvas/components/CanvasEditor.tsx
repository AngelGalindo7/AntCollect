import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type Konva from 'konva';
import { CanvasStage } from './CanvasStage';
import { CanvasPicker } from './CanvasPicker';
import { CanvasToolbar } from './CanvasToolbar';
import { useCanvasState, CANVAS_WIDTH, CANVAS_HEIGHT } from '../hooks/useCanvasState';
import { saveCanvas, uploadCanvasPreview } from '../api/canvasApi';
import type { CanvasState } from '../types/canvas';
import type { Post } from '../../../shared/types/Types';

interface Props {
  initialState: CanvasState | null;
  posts: Post[];
  onClose: () => void;
  onSaveSuccess: (previewPath: string) => void;
}

function dataURLtoBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function CanvasEditor({ initialState, posts, onClose, onSaveSuccess }: Props) {
  const { nodes, background, isDirty, addNode, updateNode, removeNode, changeBackground, markClean, getCanvasJson } =
    useCanvasState(initialState);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const stageRef = useRef<Konva.Stage>(null);

  // Compute scale so the stage fits within the available viewport
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => {
      // 256 = picker sidebar, 20 = horizontal padding, 48 = toolbar height, 20 = bottom padding
      const availW = window.innerWidth - 256 - 20;
      const availH = window.innerHeight - 48 - 20;
      setScale(Math.min(1, availW / CANVAS_WIDTH, availH / CANVAS_HEIGHT));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Escape key
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDirty && !window.confirm('You have unsaved changes. Close anyway?')) return;
        onClose();
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [isDirty, onClose]);

  const handleSave = async () => {
    if (!stageRef.current) return;
    setSaveError(null);
    setIsSaving(true);
    try {
      await saveCanvas(getCanvasJson());

      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
      const blob = dataURLtoBlob(dataUrl);
      const previewPath = await uploadCanvasPreview(blob);

      markClean();
      onSaveSuccess(previewPath);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const content = (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950">
      <CanvasToolbar
        background={background}
        onBackgroundChange={changeBackground}
        onSave={handleSave}
        onClose={() => {
          if (isDirty && !window.confirm('You have unsaved changes. Close anyway?')) return;
          onClose();
        }}
        isSaving={isSaving}
        isDirty={isDirty}
      />

      <div className="flex flex-1 overflow-hidden">
        <CanvasPicker
          posts={posts}
          onNodeAdd={(url, source) => addNode(url, source)}
        />

        <div className="flex-1 flex flex-col items-center justify-center p-2 overflow-hidden">
          <CanvasStage
            ref={stageRef}
            nodes={nodes}
            background={background}
            selectedId={selectedId}
            keepRatio
            onSelect={setSelectedId}
            onNodeUpdate={updateNode}
            onNodeDelete={removeNode}
            scale={scale}
          />
          {saveError && (
            <p className="mt-2 text-red-400 text-xs">{saveError}</p>
          )}
          <p className="mt-2 text-neutral-500 text-xs">
            Click a sticker in the picker to add it · Drag to move · Handles to resize · Delete key to remove
          </p>
        </div>
      </div>
    </div>
  );

  const target = document.getElementById('modal-root');
  return target ? createPortal(content, target) : content;
}
