import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import { CanvasStage } from './CanvasStage';
import { CanvasBottomTray } from './CanvasBottomTray';
import { useCanvasState, CANVAS_WIDTH, CANVAS_HEIGHT } from '../hooks/useCanvasState';
import { getMyCanvas, saveCanvas, uploadCanvasPreview, removeBackground } from '../api/canvasApi';
import type { BackgroundConfig, CanvasState } from '../types/canvas';
import type { Post } from '../../../shared/types/Types';

const PRESETS: { label: string; bg: BackgroundConfig }[] = [
  { label: 'Cream',    bg: { type: 'color', value: '#f5f0e8' } },
  { label: 'White',    bg: { type: 'color', value: '#ffffff' } },
  { label: 'Black',    bg: { type: 'color', value: '#111111' } },
  { label: 'Navy',     bg: { type: 'color', value: '#003366' } },
  { label: 'UCI Gold', bg: { type: 'color', value: '#ffd200' } },
  { label: 'UCI Blue', bg: { type: 'color', value: '#0064a4' } },
  { label: 'Sunset',   bg: { type: 'gradient', value: '#ff6b35', gradientEnd: '#ffd200', angle: 135 } },
  { label: 'Ocean',    bg: { type: 'gradient', value: '#0064a4', gradientEnd: '#00b4d8', angle: 135 } },
  { label: 'Dusk',     bg: { type: 'gradient', value: '#4a1942', gradientEnd: '#ff6b35', angle: 135 } },
  { label: 'Forest',   bg: { type: 'gradient', value: '#1b4332', gradientEnd: '#40916c', angle: 135 } },
];

const HEADER_H = 52;
const TRAY_H = 152;

function dataURLtoBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

interface Props {
  username: string;
  avatarPath: string | null;
  posts: Post[];
  onClose: () => void;
  onSaveSuccess: (previewPath: string) => void;
}

export function InlineCanvasEditor({ username, avatarPath, posts, onClose, onSaveSuccess }: Props) {
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
      <div
        className="flex items-center justify-center w-full bg-neutral-950"
        style={{ height: `calc(100vh - ${HEADER_H}px - ${TRAY_H}px)` }}
      >
        <p className="text-neutral-400 text-sm">Loading canvas…</p>
      </div>
    );
  }

  return (
    <InlineCanvasEditorInner
      username={username}
      avatarPath={avatarPath}
      posts={posts}
      initialState={initialState}
      onClose={onClose}
      onSaveSuccess={onSaveSuccess}
    />
  );
}

interface InnerProps extends Props {
  initialState: CanvasState | null;
}

function InlineCanvasEditorInner({
  username,
  avatarPath,
  posts,
  initialState,
  onClose,
  onSaveSuccess,
}: InnerProps) {
  const { nodes, background, isDirty, addNode, updateNode, removeNode, changeBackground, markClean, getCanvasJson } =
    useCanvasState(initialState);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [removeBgError, setRemoveBgError] = useState<string | null>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(() =>
    Math.min(
      1,
      (window.innerWidth - 80) / CANVAS_WIDTH,
      (window.innerHeight - HEADER_H - TRAY_H - 32) / CANVAS_HEIGHT,
    ),
  );

  // Lock body scroll while editor is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Fit canvas to container using ResizeObserver
  useLayoutEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setScale(Math.min(1, (width - 32) / CANVAS_WIDTH, (height - 32) / CANVAS_HEIGHT));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Escape to discard
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
      await saveCanvas(getCanvasJson());
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
      const blob = dataURLtoBlob(dataUrl);
      const previewPath = await uploadCanvasPreview(blob);
      markClean();
      onSaveSuccess(previewPath);
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
    <div className="flex flex-col w-full" style={{ height: '100vh' }}>
      {/* ── Collapsed header ── */}
      <div
        className="flex items-center gap-3 px-4 bg-neutral-900 border-b border-neutral-700 shrink-0"
        style={{ height: `${HEADER_H}px` }}
      >
        {/* Avatar + username */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-full overflow-hidden bg-neutral-700 flex items-center justify-center shrink-0">
            {avatarPath ? (
              <img src={avatarPath} alt={username} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[11px] font-bold text-neutral-300 select-none">
                {username.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <span className="text-neutral-200 text-sm font-semibold leading-none">{username}</span>
        </div>

        <div className="w-px h-5 bg-neutral-700 shrink-0 mx-1" />

        {/* Background presets */}
        <div className="flex items-center gap-1.5 flex-1 overflow-x-auto py-1 min-w-0" style={{ scrollbarWidth: 'none' }}>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              title={p.label}
              onClick={() => changeBackground(p.bg)}
              className={`w-5 h-5 rounded-full border-2 shrink-0 transition-all ${
                background.value === p.bg.value
                  ? 'border-white scale-110 shadow-sm'
                  : 'border-neutral-600 hover:border-neutral-400 hover:scale-105'
              }`}
              style={
                p.bg.type === 'color'
                  ? { background: p.bg.value }
                  : { background: `linear-gradient(135deg, ${p.bg.value}, ${p.bg.gradientEnd})` }
              }
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {saveError && (
            <span className="text-red-400 text-xs max-w-[160px] truncate" title={saveError}>
              {saveError}
            </span>
          )}
          {isDirty && (
            <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" title="Unsaved changes" />
          )}
          <button
            onClick={handleDiscard}
            className="px-3 py-1.5 text-neutral-400 hover:text-neutral-200 text-xs rounded-lg transition-colors"
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="px-4 py-1.5 bg-uci-gold text-espresso text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Node toolbar (appears when an image is selected) ── */}
      {selectedId && (() => {
        const selectedNode = nodes.find((n) => n.id === selectedId);
        return (
          <div className="flex items-center gap-3 px-4 bg-neutral-850 border-b border-neutral-700 shrink-0" style={{ height: '40px', backgroundColor: '#1a1a1a' }}>
            <span className="text-xs text-neutral-500 select-none">Image</span>
            <div className="w-px h-4 bg-neutral-700" />
            <button
              onClick={handleToggleRemoveBg}
              disabled={isRemovingBg}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${
                selectedNode?.bgRemoved
                  ? 'bg-uci-gold text-espresso'
                  : 'bg-neutral-700 text-neutral-200 hover:bg-neutral-600'
              }`}
            >
              {isRemovingBg ? (
                <>
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Removing…
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3l18 18M9 9a3 3 0 004.243 4.243M6.343 6.343A8 8 0 0019.657 19.657M6.343 6.343A8 8 0 0019.657 6.343" />
                  </svg>
                  {selectedNode?.bgRemoved ? 'BG Removed' : 'Remove BG'}
                </>
              )}
            </button>
            {removeBgError && (
              <span className="text-red-400 text-xs">{removeBgError}</span>
            )}
            <div className="flex-1" />
            <button
              onClick={() => { removeNode(selectedId); setSelectedId(null); }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-neutral-700 text-red-400 hover:bg-red-900/40 hover:text-red-300 transition-colors"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
              </svg>
              Delete
            </button>
          </div>
        );
      })()}

      {/* ── Canvas area ── */}
      <div
        ref={canvasAreaRef}
        className="flex-1 flex items-center justify-center bg-neutral-950 overflow-hidden min-h-0"
      >
        <CanvasStage
          ref={stageRef}
          nodes={nodes}
          background={background}
          selectedId={selectedId}
          onSelect={(id) => { setSelectedId(id); setRemoveBgError(null); }}
          onNodeUpdate={updateNode}
          onNodeDelete={removeNode}
          scale={scale}
        />
      </div>

      {/* ── Image picker tray ── */}
      <CanvasBottomTray posts={posts} onNodeAdd={(url, source) => addNode(url, source)} />
    </div>
  );
}
