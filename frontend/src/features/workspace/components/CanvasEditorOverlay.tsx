import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { ArrowLeft } from 'lucide-react';
import type Konva from 'konva';
import { CanvasStage } from '@/features/canvas/components/CanvasStage';
import { StickerPicker } from '@/features/canvas/components/StickerPicker';
import { StickerControls } from '@/features/canvas/components/StickerControls';
import { CropModal } from '@/features/canvas/components/CropModal';
import { useCanvasState, CANVAS_WIDTH, CANVAS_HEIGHT } from '@/features/canvas/hooks/useCanvasState';
import type { CanvasState } from '@/features/canvas/types/canvas';
import { removeBackground } from '@/features/canvas/api/canvasApi';
import { savePanelCanvas, uploadPanelPreview, uploadWorkspaceAsset } from '../api/workspaceApi';
import type { Panel } from '../types/workspace';
import type { Post } from '@/shared/types/Types';

interface Props {
  panel: Panel;
  posts: Post[];
  onClose: () => void;
  onSaved: (updated: Panel) => void;
}

function dataURLtoBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function CanvasEditorOverlay({ panel, posts, onClose, onSaved }: Props) {
  const { nodes, background, isDirty, addNode, updateNode, removeNode,
    moveNodeUp, moveNodeDown, changeBackground, markClean, getCanvasJson } =
    useCanvasState(panel.canvas_json as CanvasState | null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [keepRatio, setKeepRatio] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [removeBgError, setRemoveBgError] = useState<string | null>(null);
  const [cropTargetId, setCropTargetId] = useState<string | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
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
    const handle = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isDirty && !window.confirm('Discard unsaved changes?')) return;
      onClose();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [isDirty, onClose]);

  const handleClose = () => {
    if (isDirty && !window.confirm('Discard unsaved changes?')) return;
    onClose();
  };

  const handleSave = async () => {
    if (!stageRef.current) return;
    setSaveError(null);
    setIsSaving(true);
    try {
      const stage = stageRef.current;
      const transformers = stage.find('Transformer');
      transformers.forEach((t) => t.visible(false));
      stage.batchDraw();
      const dataUrl = stage.toDataURL({ pixelRatio: 2 });
      transformers.forEach((t) => t.visible(true));
      stage.batchDraw();
      const blob = dataURLtoBlob(dataUrl);
      await uploadPanelPreview(panel.id, blob);
      const updated = await savePanelCanvas(panel.id, getCanvasJson());
      markClean();
      onSaved(updated);
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

  const content = (
    <div className="fixed inset-0 z-[9999] bg-[#0f0f0f] flex flex-col">
      {/* Top bar */}
      <div className="h-12 bg-[#111] border-b border-white/[0.06] flex items-center px-4 gap-3 shrink-0">
        <button
          onClick={handleClose}
          className="flex items-center gap-1.5 text-white/50 hover:text-white/80 text-sm transition-colors"
        >
          <ArrowLeft size={15} />
          Back
        </button>
        <div className="flex-1" />
        {saveError && <span className="text-red-400 text-xs">{saveError}</span>}
        <button
          onClick={handleClose}
          className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white/70 text-xs font-semibold transition-colors"
        >
          Discard
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-3.5 py-1.5 rounded-full bg-espresso hover:bg-espresso/90 text-white text-xs font-semibold disabled:opacity-50 transition-opacity"
        >
          {isSaving ? 'Saving…' : 'Save & Done'}
        </button>
      </div>

      {/* Editor body — three columns */}
      <div className="flex flex-1 overflow-hidden">
        <StickerPicker
          posts={posts}
          onNodeAdd={(url, source) => addNode(url, source)}
          onUploadAsset={uploadWorkspaceAsset}
        />
        <div ref={canvasAreaRef} className="flex-1 overflow-hidden bg-[#1a1a1a]">
          <CanvasStage
            ref={stageRef}
            nodes={nodes}
            background={background}
            selectedId={selectedId}
            keepRatio={keepRatio}
            onSelect={setSelectedId}
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
          onToggleHolo={(id) => {
            const node = nodes.find((n) => n.id === id);
            updateNode(id, { holo: !node?.holo });
          }}
          onCropNode={(id) => { setSelectedId(null); setCropTargetId(id); }}
          onDeleteNode={(id) => { removeNode(id); setSelectedId(null); }}
          isDirty={isDirty}
          isSaving={isSaving}
          saveError={saveError}
          onSave={handleSave}
          onDiscard={handleDiscard}
        />
      </div>
    </div>
  );

  const cropNode = cropTargetId ? nodes.find((n) => n.id === cropTargetId) : null;

  return (
    <>
      {ReactDOM.createPortal(content, document.body)}
      {cropTargetId && cropNode && (
        <CropModal
          imageUrl={cropNode.image_url}
          onUpload={uploadWorkspaceAsset}
          onConfirm={(newUrl) => {
            updateNode(cropTargetId, {
              image_url: newUrl,
              originalUrl: cropNode.originalUrl ?? cropNode.image_url,
              bgRemoved: false,
              removedBgUrl: undefined,
            });
            setCropTargetId(null);
          }}
          onCancel={() => setCropTargetId(null)}
        />
      )}
    </>
  );
}
