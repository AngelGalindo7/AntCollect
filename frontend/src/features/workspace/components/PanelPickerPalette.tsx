import { useState } from 'react';
import type Konva from 'konva';
import { StickerPicker } from '@/features/canvas/components/StickerPicker';
import { StickerControls } from '@/features/canvas/components/StickerControls';
import { removeBackground } from '@/features/canvas/api/canvasApi';
import { savePanelCanvas, uploadPanelPreview } from '../api/workspaceApi';
import type { WorkspaceBounds, Panel } from '../types/workspace';
import type { Post } from '@/shared/types/Types';
import type { CanvasApiHandle } from './PanelEditor';

const PALETTE_W = 256 + 256 + 4;

interface Props {
  panel: Panel;
  bounds: WorkspaceBounds;
  canvasApi: CanvasApiHandle | null;
  stageRef: React.RefObject<Konva.Stage | null>;
  posts: Post[];
  onSaveSuccess: (panelId: number) => void;
  onDiscard: () => void;
}

function dataURLtoBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function PanelPickerPalette({
  panel, bounds, canvasApi, stageRef, posts, onSaveSuccess, onDiscard,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [keepRatio, setKeepRatio] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [removeBgError, setRemoveBgError] = useState<string | null>(null);

  // Position the palette: prefer right of panel, else left, clamped to bounds.
  const paletteH = 480;
  let left = panel.x + panel.w + 8;
  if (left + PALETTE_W > bounds.w) left = panel.x - PALETTE_W - 8;
  if (left < 0) left = 4;
  const top = Math.max(0, Math.min(panel.y, bounds.h - paletteH));

  const handleSave = async () => {
    if (!stageRef.current || !canvasApi) return;
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
      await savePanelCanvas(panel.id, canvasApi.getCanvasJson());
      canvasApi.markClean();
      onSaveSuccess(panel.id);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleRemoveBg = async () => {
    if (!selectedId || !canvasApi) return;
    const node = canvasApi.nodes.find((n) => n.id === selectedId);
    if (!node) return;
    setRemoveBgError(null);
    if (node.bgRemoved) {
      canvasApi.updateNode(selectedId, { image_url: node.originalUrl ?? node.image_url, bgRemoved: false });
      return;
    }
    if (node.removedBgUrl) {
      canvasApi.updateNode(selectedId, { image_url: node.removedBgUrl, bgRemoved: true });
      return;
    }
    setIsRemovingBg(true);
    try {
      const processedUrl = await removeBackground(node.image_url);
      canvasApi.updateNode(selectedId, {
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

  const handleDiscard = () => {
    const dirty = canvasApi?.isDirty ?? false;
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    onDiscard();
  };

  const nodes = canvasApi?.nodes ?? [];
  const background = canvasApi?.background ?? { type: 'color' as const, value: '#f5f0e8' };

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        zIndex: 1000,
        display: 'flex',
        height: paletteH,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <StickerPicker
        posts={posts}
        onNodeAdd={(url, source) => canvasApi?.addNode(url, source)}
      />
      <StickerControls
        background={background}
        onChangeBackground={(bg) => canvasApi?.changeBackground(bg)}
        selectedId={selectedId}
        nodes={nodes}
        keepRatio={keepRatio}
        onSetKeepRatio={setKeepRatio}
        isRemovingBg={isRemovingBg}
        removeBgError={removeBgError}
        onToggleRemoveBg={handleToggleRemoveBg}
        onMoveNodeUp={(id) => canvasApi?.moveNodeUp(id)}
        onMoveNodeDown={(id) => canvasApi?.moveNodeDown(id)}
        onToggleHolo={(id) => {
          const node = nodes.find((n) => n.id === id);
          canvasApi?.updateNode(id, { holo: !node?.holo });
        }}
        onDeleteNode={(id) => { canvasApi?.removeNode(id); setSelectedId(null); }}
        isDirty={canvasApi?.isDirty ?? false}
        isSaving={isSaving}
        saveError={saveError}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </div>
  );
}
