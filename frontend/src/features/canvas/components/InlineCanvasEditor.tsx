import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import { CanvasStage } from './CanvasStage';
import { StickerPicker } from './StickerPicker';
import { StickerControls } from './StickerControls';
import { useCanvasState, CANVAS_WIDTH, CANVAS_HEIGHT } from '../hooks/useCanvasState';
import { getMyCanvas, saveCanvas, uploadCanvasPreview, removeBackground } from '../api/canvasApi';
import type { CanvasState } from '../types/canvas';
import type { Post } from '../../../shared/types/Types';

function dataURLtoBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// ── Shell (async canvas load) ─────────────────────────────────────────────────

interface Props {
  posts: Post[];
  onClose: () => void;
  onSaveSuccess: (previewPath: string, canvasState: CanvasState) => void;
}

export function InlineCanvasEditor({ posts, onClose, onSaveSuccess }: Props) {
  const [initialState, setInitialState] = useState<CanvasState | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getMyCanvas()
      .then((res) => setInitialState(res?.canvas_json ?? null))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="flex w-full overflow-hidden" style={{ minHeight: 400 }}>
        <div className="w-64 shrink-0 bg-white border-r border-neutral-200" />
        <div className="flex-1 bg-neutral-100 flex items-center justify-center">
          <p className="text-neutral-400 text-sm">Loading canvas…</p>
        </div>
        <div className="w-64 shrink-0 bg-white border-l border-neutral-200" />
      </div>
    );
  }

  return (
    <InlineCanvasEditorInner
      posts={posts}
      initialState={initialState}
      onClose={onClose}
      onSaveSuccess={onSaveSuccess}
    />
  );
}

// ── Inner (renders once canvas state is loaded) ───────────────────────────────

interface InnerProps extends Props {
  initialState: CanvasState | null;
}

function InlineCanvasEditorInner({ posts, initialState, onClose, onSaveSuccess }: InnerProps) {
  const {
    nodes, background, isDirty,
    addNode, updateNode, removeNode, moveNodeUp, moveNodeDown,
    changeBackground, markClean, getCanvasJson,
  } = useCanvasState(initialState);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [keepRatio, setKeepRatio] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [removeBgError, setRemoveBgError] = useState<string | null>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const byWidth = entry.contentRect.width / CANVAS_WIDTH;
      // Reserve ~150px for the profile header + tab bar above the editor
      const byHeight = (window.innerHeight - 150) / CANVAS_HEIGHT;
      setScale(Math.min(byWidth, byHeight));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDirty && !window.confirm('Discard unsaved changes?')) return;
        onClose();
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [isDirty, onClose]);

  const handleToggleRemoveBg = async () => {
    if (!selectedId) return;
    const node = nodes.find((n) => n.id === selectedId);
    if (!node) return;
    setRemoveBgError(null);
    if (node.bgRemoved) {
      updateNode(selectedId, { image_url: node.originalUrl ?? node.image_url, bgRemoved: false });
      return;
    }
    if (node.removedBgUrl) {
      updateNode(selectedId, { image_url: node.removedBgUrl, bgRemoved: true });
      return;
    }
    setIsRemovingBg(true);
    try {
      const processedUrl = await removeBackground(node.image_url);
      updateNode(selectedId, {
        image_url: processedUrl,
        originalUrl: node.image_url,
        removedBgUrl: processedUrl,
        bgRemoved: true,
      });
    } catch {
      setRemoveBgError('Remove BG failed — try again');
    } finally {
      setIsRemovingBg(false);
    }
  };

  const handleSave = async () => {
    if (!stageRef.current) return;
    setSaveError(null);
    setIsSaving(true);
    try {
      const json = getCanvasJson();
      await saveCanvas(json);
      const stage = stageRef.current;
      const transformers = stage.find('Transformer');
      transformers.forEach((t) => t.visible(false));
      stage.batchDraw();
      const dataUrl = stage.toDataURL({ pixelRatio: 2 });
      transformers.forEach((t) => t.visible(true));
      stage.batchDraw();
      const blob = dataURLtoBlob(dataUrl);
      const previewPath = await uploadCanvasPreview(blob);
      markClean();
      onSaveSuccess(previewPath, json);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    if (isDirty && !window.confirm('Discard unsaved changes?')) return;
    onClose();
  };

  return (
    <div className="flex w-full overflow-hidden">
      <StickerPicker
        posts={posts}
        onNodeAdd={(url, source) => addNode(url, source)}
      />

      {/* Canvas — fills available space between the two panels */}
      <div
        ref={canvasAreaRef}
        className="flex-1 overflow-hidden"
        style={{ height: CANVAS_HEIGHT * scale }}
      >
        <CanvasStage
          ref={stageRef}
          nodes={nodes}
          background={background}
          selectedId={selectedId}
          keepRatio={keepRatio}
          onSelect={(id) => { setSelectedId(id); setRemoveBgError(null); }}
          onNodeUpdate={updateNode}
          onNodeDelete={removeNode}
          scale={scale}
        />
      </div>

      <StickerControls
        background={background}
        onChangeBackground={changeBackground}
        selectedId={selectedId}
        nodes={nodes}
        keepRatio={keepRatio}
        onSetKeepRatio={setKeepRatio}
        isRemovingBg={isRemovingBg}
        removeBgError={removeBgError}
        onToggleRemoveBg={handleToggleRemoveBg}
        onMoveNodeUp={moveNodeUp}
        onMoveNodeDown={moveNodeDown}
        onToggleHolo={(id) => updateNode(id, { holo: !nodes.find((n) => n.id === id)?.holo })}
        onDeleteNode={(id) => { removeNode(id); setSelectedId(null); }}
        isDirty={isDirty}
        isSaving={isSaving}
        saveError={saveError}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </div>
  );
}
