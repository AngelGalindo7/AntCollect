import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { ArrowLeft, Undo2, Redo2 } from 'lucide-react';
import type Konva from 'konva';
import { CanvasStage } from '@/features/canvas/components/CanvasStage';
import { StickerPicker } from '@/features/canvas/components/StickerPicker';
import { StickerControls } from '@/features/canvas/components/StickerControls';
import { CropModal } from '@/features/canvas/components/CropModal';
import { ContextualToolbar } from '@/features/canvas/components/ContextualToolbar';
import { useCanvasState, CANVAS_WIDTH, CANVAS_HEIGHT } from '@/features/canvas/hooks/useCanvasState';
import type { CanvasState } from '@/features/canvas/types/canvas';
import type { LiveBounds } from '@/features/canvas/components/CanvasNode';
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
  const { nodes, background, isDirty, addNode, updateNode, removeNode, duplicateNode,
    moveNodeUp, moveNodeDown, changeBackground, markClean, getCanvasJson } =
    useCanvasState(panel.canvas_json as CanvasState | null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [keepRatio] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [removeBgError, setRemoveBgError] = useState<string | null>(null);
  const [cropTargetId, setCropTargetId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [liveBounds, setLiveBounds] = useState<LiveBounds | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );
  const nodeIdx = selectedId ? nodes.findIndex((n) => n.id === selectedId) : -1;
  const isTop = nodeIdx === nodes.length - 1;
  const isBottom = nodeIdx === 0;

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
      setLastSavedAt(Date.now());
      onSaved(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed. Try again.');
    } finally {
      setIsSaving(false);
    }
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

  const handleDuplicate = () => {
    if (!selectedId) return;
    const newId = duplicateNode(selectedId);
    if (newId) setSelectedId(newId);
  };

  const titleText = panel.title?.trim() || 'untitled scene';
  const stickerCountLabel = `${nodes.length} ${nodes.length === 1 ? 'sticker' : 'stickers'}`;
  const savedLabel = isSaving
    ? 'saving…'
    : isDirty
      ? 'unsaved changes'
      : lastSavedAt
        ? 'saved a moment ago'
        : 'draft';

  // Bounding box of selected node, in artboard pixels (not yet scaled).
  // Use live bounds during drag/transform, otherwise fall back to committed state.
  const overlayBox = (() => {
    if (selectedNode) {
      const b = liveBounds ?? {
        x: selectedNode.x,
        y: selectedNode.y,
        width: selectedNode.width,
        height: selectedNode.height,
        rotation: selectedNode.rotation,
      };
      return b;
    }
    return null;
  })();

  const content = (
    <div
      className="paper-workshop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--pw-bg)',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          height: 56,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--pw-paper)',
          borderBottom: '1px solid var(--pw-line)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={handleClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 32,
            color: 'var(--pw-ink2)',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={16} strokeWidth={1.6} />
          Back
        </button>

        <span style={{ width: 1, height: 18, background: 'var(--pw-line)', margin: '0 4px' }} />

        <span
          className="pw-display"
          style={{
            width: 26,
            height: 26,
            background: 'var(--pw-ink)',
            color: 'var(--pw-gold)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          P
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, marginLeft: 4 }}>
          <span
            className="pw-display"
            style={{ fontSize: 17, color: 'var(--pw-ink)' }}
          >
            {titleText}
          </span>
          <span style={{ fontSize: 11, color: 'var(--pw-ink3)' }}>
            {stickerCountLabel} · {savedLabel}
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {saveError && (
          <span style={{ fontSize: 12, color: 'var(--pw-danger)' }}>{saveError}</span>
        )}

        <button
          type="button"
          title="Undo"
          disabled
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--pw-ink2)',
            opacity: 0.4,
          }}
        >
          <Undo2 size={16} strokeWidth={1.6} />
        </button>
        <button
          type="button"
          title="Redo"
          disabled
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--pw-ink2)',
            opacity: 0.4,
          }}
        >
          <Redo2 size={16} strokeWidth={1.6} />
        </button>

        <button
          type="button"
          onClick={handleClose}
          style={{
            height: 34,
            padding: '0 14px',
            background: 'transparent',
            color: 'var(--pw-ink2)',
            fontSize: 13,
            fontWeight: 500,
            borderRadius: 8,
          }}
        >
          Discard
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          style={{
            height: 34,
            padding: '0 18px',
            background: 'var(--pw-ink)',
            color: 'var(--pw-paper)',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            opacity: isSaving ? 0.6 : 1,
            transition: 'opacity 120ms ease',
          }}
        >
          {isSaving ? 'Saving…' : 'Save & Done'}
        </button>
      </div>

      {/* Body — three columns */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <StickerPicker
          posts={posts}
          onNodeAdd={(url, source) => addNode(url, source)}
          onUploadAsset={uploadWorkspaceAsset}
        />

        <div
          ref={canvasAreaRef}
          className="pw-canvas-dots"
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            background: 'var(--pw-bg)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: CANVAS_WIDTH * scale,
                height: CANVAS_HEIGHT * scale,
              }}
            >
              <CanvasStage
                ref={stageRef}
                nodes={nodes}
                background={background}
                selectedId={selectedId}
                keepRatio={keepRatio}
                onSelect={setSelectedId}
                onNodeUpdate={updateNode}
                onNodeDelete={removeNode}
                onLiveBoundsChange={setLiveBounds}
                scale={scale}
              />

              {/* watermark — HTML overlay, not part of saved PNG */}
              <span
                className="pw-display"
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 16,
                  fontSize: 12,
                  color: 'rgba(0,0,0,.18)',
                  pointerEvents: 'none',
                }}
              >
                Petr Stickers · UCI
              </span>

              {/* Selection overlays — dimension chip + contextual toolbar */}
              {selectedNode && overlayBox && (
                <>
                  <div
                    className="pw-mono"
                    style={{
                      position: 'absolute',
                      left: (overlayBox.x + overlayBox.width / 2) * scale,
                      top: (overlayBox.y + overlayBox.height) * scale + 22,
                      transform: 'translate(-50%, 0)',
                      background: 'var(--pw-ink)',
                      color: '#fff',
                      fontSize: 10,
                      padding: '1px 6px',
                      borderRadius: 3,
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {Math.round(overlayBox.width)} × {Math.round(overlayBox.height)}
                  </div>

                  <ContextualToolbar
                    style={{
                      left: (overlayBox.x + overlayBox.width / 2) * scale,
                      top: Math.max(8, overlayBox.y * scale - 56),
                      transform: 'translate(-50%, 0)',
                    }}
                    isTop={isTop}
                    isBottom={isBottom}
                    bgRemoved={!!selectedNode.bgRemoved}
                    holoOn={!!selectedNode.holo}
                    isRemovingBg={isRemovingBg}
                    onLayerUp={() => moveNodeUp(selectedNode.id)}
                    onLayerDown={() => moveNodeDown(selectedNode.id)}
                    onDuplicate={handleDuplicate}
                    onCrop={() => { setSelectedId(null); setCropTargetId(selectedNode.id); }}
                    onToggleRemoveBg={handleToggleRemoveBg}
                    onToggleHolo={() => updateNode(selectedNode.id, { holo: !selectedNode.holo })}
                    onDelete={() => { removeNode(selectedNode.id); setSelectedId(null); }}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        <StickerControls
          background={background}
          onChangeBackground={changeBackground}
          selectedId={selectedId}
          nodes={nodes}
          isRemovingBg={isRemovingBg}
          removeBgError={removeBgError}
          onToggleRemoveBg={handleToggleRemoveBg}
          onToggleHolo={(id) => {
            const n = nodes.find((nn) => nn.id === id);
            updateNode(id, { holo: !n?.holo });
          }}
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
