import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { ArrowLeft, Undo2, Redo2, Crop, Eye } from 'lucide-react';
import type Konva from 'konva';
import { CanvasStage } from '@/features/canvas/components/CanvasStage';
import { CanvasDomPreview } from '@/features/canvas/components/CanvasDomPreview';
import { StickerPicker } from '@/features/canvas/components/StickerPicker';
import { StickerControls } from '@/features/canvas/components/StickerControls';
import { CropModal } from '@/features/canvas/components/CropModal';
import { ContextualToolbar } from '@/features/canvas/components/ContextualToolbar';
import { CanvasSizeSetup } from './CanvasSizeSetup';
import { useCanvasState } from '@/features/canvas/hooks/useCanvasState';
import type { CanvasState } from '@/features/canvas/types/canvas';
import type { LiveBounds } from '@/features/canvas/components/CanvasNode';
import { removeBackground } from '@/features/canvas/api/canvasApi';
import { useBackgroundPositioning } from '@/shared/hooks/useBackgroundPositioning';
import { savePanelCanvas, updatePanelMeta, uploadPanelPreview, uploadWorkspaceAsset } from '../api/workspaceApi';
import type { Panel } from '../types/workspace';
import type { Post } from '@/shared/types/Types';

interface Props {
  panel: Panel;
  posts: Post[];
  onClose: () => void;
  onSaved: (updated: Panel) => void;
  overrideInitialSize?: { w: number; h: number };
}

function dataURLtoBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function CanvasEditorOverlay({ panel, posts, onClose, onSaved, overrideInitialSize }: Props) {
  const effectiveInitialJson: CanvasState | null = panel.canvas_json
    ?? (overrideInitialSize
      ? { version: 1, width: overrideInitialSize.w, height: overrideInitialSize.h, background: { type: 'color', value: '#f5f0e8' }, nodes: [] }
      : null);

  const { nodes, background, width, height, isDirty, canUndo, canRedo, addNode, updateNode, removeNode, duplicateNode,
    moveNodeUp, moveNodeDown, changeBackground, setCanvasSize, undo, redo, markClean, getCanvasJson } =
    useCanvasState(effectiveInitialJson);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [keepRatio, setKeepRatio] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [removeBgError, setRemoveBgError] = useState<string | null>(null);
  const [cropTargetId, setCropTargetId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [liveBounds, setLiveBounds] = useState<LiveBounds | null>(null);
  const [title, setTitle] = useState(panel.title ?? '');
  const [isSizePreviewOpen, setIsSizePreviewOpen] = useState(false);
  const [isHoloPreview, setIsHoloPreview] = useState(false);
  const stageRef = useRef<Konva.Stage | null>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  const [bgEditUrl, setBgEditUrl] = useState<string | null>(null);

  const handleStartBackgroundEdit = (newImageUrl?: string) => {
    if (newImageUrl) {
      setBgEditUrl(newImageUrl);
      setSelectedId(null);
      return;
    }
    if (background.type === 'image' && background.imageUrl) {
      setBgEditUrl(background.imageUrl);
      setSelectedId(null);
    }
  };

  const isExistingImageBg = background.type === 'image' && background.imageUrl === bgEditUrl;
  const bgEditInitial = isExistingImageBg
    ? {
        offsetX: background.imageOffsetX ?? 0,
        offsetY: background.imageOffsetY ?? 0,
        scale: background.imageScale ?? 1,
      }
    : undefined;

  const {
    attachFrameRef: attachBgFrameRef,
    naturalSize: bgEditNaturalSize,
    position: bgEditPosition,
    isDragging: bgIsDragging,
  } = useBackgroundPositioning({
    imageUrl: bgEditUrl ?? '',
    frameWidth: width,
    frameHeight: height,
    enabled: bgEditUrl !== null,
    initial: bgEditInitial,
  });

  const handleBackgroundEditApply = () => {
    if (!bgEditUrl) return;
    changeBackground({
      type: 'image',
      value: '#f6f1e6',
      imageUrl: bgEditUrl,
      imageOffsetX: bgEditPosition.offsetX,
      imageOffsetY: bgEditPosition.offsetY,
      imageScale: bgEditPosition.scale,
    });
    setBgEditUrl(null);
  };

  const handleBackgroundEditCancel = () => {
    setBgEditUrl(null);
  };

  const trimmedTitle = title.trim();
  const initialTitle = (panel.title ?? '').trim();
  const titleDirty = trimmedTitle !== initialTitle;

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
      const { width: availW, height: availH } = entry.contentRect;
      setScale(Math.min(availW / width, availH / height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if ((isDirty || titleDirty) && !window.confirm('Discard unsaved changes?')) return;
      onClose();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [isDirty, titleDirty, onClose]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() !== 'z' && e.key.toLowerCase() !== 'y') return;
      // Don't hijack the browser's text-undo while the title field is focused.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      const isRedo = e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey);
      if (isRedo) redo();
      else undo();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [undo, redo]);

  const handleClose = () => {
    if ((isDirty || titleDirty) && !window.confirm('Discard unsaved changes?')) return;
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

      // Save canvas JSON first: if the preview upload fails after this, the stored
      // JSON still matches what was rendered, so re-saving will recover cleanly.
      // The reverse order (preview first) leaves JSON stale on any JSON-save failure,
      // causing the showcase to show more nodes than the editor loads next time.
      let updated = await savePanelCanvas(panel.id, getCanvasJson());
      if (titleDirty) {
        updated = await updatePanelMeta(panel.id, { title: trimmedTitle || null });
      }
      const previewPath = await uploadPanelPreview(panel.id, blob);

      // Explicitly patch preview_path: savePanelCanvas / updatePanelMeta return the
      // panel after their own write; the preview upload is a separate DB write and its
      // result may not be reflected in those responses.
      updated = { ...updated, preview_path: previewPath };

      // Sync panel frame AR to canvas AR so the preview fills the frame without
      // letterbox bars. Keep the larger dimension fixed and shrink the other.
      const canvasAR = width / height;
      const frameAR = updated.w / updated.h;
      if (Math.abs(canvasAR - frameAR) > 0.005) {
        let newW = updated.w;
        let newH = updated.h;
        if (canvasAR > frameAR) {
          newH = Math.max(220, Math.round(newW / canvasAR));
        } else {
          newW = Math.max(280, Math.round(newH * canvasAR));
        }
        const arSynced = await updatePanelMeta(panel.id, { w: newW, h: newH });
        updated = { ...arSynced, preview_path: previewPath };
      }

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

  const stickerCountLabel = `${nodes.length} ${nodes.length === 1 ? 'sticker' : 'stickers'}`;
  const savedLabel = isSaving
    ? 'saving…'
    : isDirty || titleDirty
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

        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, marginLeft: 4, minWidth: 0 }}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="untitled"
            maxLength={80}
            spellCheck={false}
            className="pw-display"
            style={{
              fontSize: 17,
              color: 'var(--pw-ink)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: '2px 4px',
              borderRadius: 4,
              width: 240,
              minWidth: 0,
            }}
            onFocus={(e) => { e.currentTarget.style.background = 'var(--pw-surface2)'; }}
            onBlur={(e) => { e.currentTarget.style.background = 'transparent'; }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
          />
          <span style={{ fontSize: 11, color: 'var(--pw-ink3)', paddingLeft: 4 }}>
            {stickerCountLabel} · {savedLabel}
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {saveError && (
          <span style={{ fontSize: 12, color: 'var(--pw-danger)' }}>{saveError}</span>
        )}

        <button
          type="button"
          onClick={() => setIsSizePreviewOpen(true)}
          title="Resize canvas"
          className="pw-mono"
          style={{
            height: 32,
            padding: '0 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--pw-ink2)',
            fontSize: 12,
            fontWeight: 500,
            borderRadius: 6,
            background: isSizePreviewOpen ? 'var(--pw-surface2)' : 'transparent',
          }}
        >
          <Crop size={14} strokeWidth={1.6} />
          {Math.round(width)} × {Math.round(height)}
        </button>

        <button
          type="button"
          onClick={() => { setSelectedId(null); setIsHoloPreview((v) => !v); }}
          title="Preview holo — hover a sticker to see the shine"
          style={{
            height: 32,
            padding: '0 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: isHoloPreview ? 'var(--pw-paper)' : 'var(--pw-ink2)',
            fontSize: 12,
            fontWeight: 500,
            borderRadius: 6,
            background: isHoloPreview ? 'var(--pw-ink)' : 'transparent',
          }}
        >
          <Eye size={14} strokeWidth={1.6} />
          Preview
        </button>

        <button
          type="button"
          title="Undo (Ctrl/Cmd+Z)"
          onClick={undo}
          disabled={!canUndo}
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--pw-ink2)',
            opacity: canUndo ? 1 : 0.4,
            cursor: canUndo ? 'pointer' : 'default',
          }}
        >
          <Undo2 size={16} strokeWidth={1.6} />
        </button>
        <button
          type="button"
          title="Redo (Ctrl/Cmd+Shift+Z)"
          onClick={redo}
          disabled={!canRedo}
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--pw-ink2)',
            opacity: canRedo ? 1 : 0.4,
            cursor: canRedo ? 'pointer' : 'default',
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
                width: width * scale,
                height: height * scale,
              }}
            >
              <CanvasStage
                ref={stageRef}
                nodes={nodes}
                background={background}
                backgroundOverride={
                  bgEditUrl
                    ? {
                        imageUrl: bgEditUrl,
                        offsetX: bgEditPosition.offsetX,
                        offsetY: bgEditPosition.offsetY,
                        scale: bgEditPosition.scale,
                      }
                    : null
                }
                selectedId={selectedId}
                keepRatio={keepRatio}
                onSelect={setSelectedId}
                onNodeUpdate={updateNode}
                onNodeDelete={removeNode}
                onLiveBoundsChange={setLiveBounds}
                scale={scale}
                width={width}
                height={height}
              />

              {bgEditUrl && (
                <div
                  ref={attachBgFrameRef}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    cursor: bgIsDragging ? 'grabbing' : 'grab',
                    touchAction: 'none',
                    userSelect: 'none',
                    background: bgEditNaturalSize ? 'rgba(0,0,0,0)' : 'rgba(28,26,22,0.04)',
                    zIndex: 5,
                  }}
                  title="Drag to reposition · scroll to zoom"
                />
              )}

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
              {!bgEditUrl && selectedNode && overlayBox && (
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
                    keepRatio={keepRatio}
                    isRemovingBg={isRemovingBg}
                    onLayerUp={() => moveNodeUp(selectedNode.id)}
                    onLayerDown={() => moveNodeDown(selectedNode.id)}
                    onDuplicate={handleDuplicate}
                    onCrop={() => { setSelectedId(null); setCropTargetId(selectedNode.id); }}
                    onToggleRemoveBg={handleToggleRemoveBg}
                    onToggleHolo={() => updateNode(selectedNode.id, { holo: !selectedNode.holo })}
                    onToggleKeepRatio={() => setKeepRatio((v) => !v)}
                    onDelete={() => { removeNode(selectedNode.id); setSelectedId(null); }}
                  />
                </>
              )}

              {/* C2: live holo preview — DOM render over the Konva stage so the owner can
                  hover a sticker and see the actual shine before saving. */}
              {isHoloPreview && !bgEditUrl && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 8 }}>
                  <CanvasDomPreview
                    width={width}
                    height={height}
                    background={background}
                    nodes={nodes}
                    scale={scale}
                  />
                </div>
              )}
            </div>
          </div>

          {bgEditUrl && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 16,
                display: 'flex',
                justifyContent: 'center',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            >
              <div
                style={{
                  pointerEvents: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 12px',
                  background: 'var(--pw-paper)',
                  border: '1px solid var(--pw-line)',
                  borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,.12)',
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--pw-ink3)' }}>
                  Drag to reposition · scroll to zoom
                </span>
                <button
                  type="button"
                  onClick={handleBackgroundEditCancel}
                  style={{
                    height: 30,
                    padding: '0 12px',
                    background: 'transparent',
                    color: 'var(--pw-ink2)',
                    fontSize: 12.5,
                    fontWeight: 500,
                    borderRadius: 7,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBackgroundEditApply}
                  disabled={!bgEditNaturalSize}
                  style={{
                    height: 30,
                    padding: '0 16px',
                    background: 'var(--pw-ink)',
                    color: 'var(--pw-paper)',
                    fontSize: 12.5,
                    fontWeight: 600,
                    borderRadius: 7,
                    opacity: bgEditNaturalSize ? 1 : 0.5,
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>

        <StickerControls
          background={background}
          onChangeBackground={changeBackground}
          onStartBackgroundEdit={handleStartBackgroundEdit}
          isEditingBackground={bgEditUrl !== null}
          selectedId={selectedId}
          nodes={nodes}
          isRemovingBg={isRemovingBg}
          removeBgError={removeBgError}
          onToggleRemoveBg={handleToggleRemoveBg}
          onToggleHolo={(id) => {
            const n = nodes.find((nn) => nn.id === id);
            updateNode(id, { holo: !n?.holo });
          }}
          onChangeHoloVariant={(id, variant) => updateNode(id, { holoVariant: variant })}
          onUploadAsset={uploadWorkspaceAsset}
          frameWidth={width}
          frameHeight={height}
        />
      </div>
    </div>
  );

  const cropNode = cropTargetId ? nodes.find((n) => n.id === cropTargetId) : null;

  return (
    <>
      {ReactDOM.createPortal(content, document.body)}
      {isSizePreviewOpen && (
        <CanvasSizeSetup
          initialW={width}
          initialH={height}
          confirmLabel="Apply Size"
          onClose={() => setIsSizePreviewOpen(false)}
          onConfirm={(w, h) => {
            setCanvasSize(w, h);
            setIsSizePreviewOpen(false);
          }}
        />
      )}
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
