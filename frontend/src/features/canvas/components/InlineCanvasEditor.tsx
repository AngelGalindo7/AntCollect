import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import type Konva from 'konva';
import { CanvasStage } from './CanvasStage';
import { useCanvasState, CANVAS_WIDTH, CANVAS_HEIGHT } from '../hooks/useCanvasState';
import { getMyCanvas, saveCanvas, uploadCanvasPreview, removeBackground, uploadCanvasAsset } from '../api/canvasApi';
import { fetchWithAuth, API_BASE } from '../../../shared/api/api';
import type { BackgroundConfig, CanvasNode, CanvasState, NodeSource } from '../types/canvas';
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

function dataURLtoBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

interface LibrarySticker {
  id: number;
  title: string;
  thumbnail: string | null;
}

// ── Left panel: image picker ──────────────────────────────────────────────────

function LeftPanel({ posts, onNodeAdd }: { posts: Post[]; onNodeAdd: (url: string, source: NodeSource) => void }) {
  const [tab, setTab] = useState<'library' | 'posts' | 'upload'>('library');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: stickers = [], isLoading } = useQuery<LibrarySticker[]>({
    queryKey: ['library', search],
    queryFn: () =>
      fetchWithAuth(`${API_BASE}/library/?search=${encodeURIComponent(search)}`).then((r) => r.json()),
    enabled: tab === 'library',
  });

  const postImages = posts.flatMap((p) =>
    ((p as any).images ?? [])
      .filter((img: any) => img?.paths?.medium)
      .map((img: any) => ({ url: img.paths.medium as string, caption: p.caption })),
  );

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadCanvasAsset(file);
      onNodeAdd(url, 'upload');
    } catch {
      // silent — user can retry
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const tabCls = (t: string) =>
    `flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
      tab === t ? 'bg-espresso text-white' : 'text-neutral-500 hover:text-espresso'
    }`;

  const thumbCls =
    'aspect-square rounded-lg overflow-hidden border border-neutral-200 hover:border-neutral-400 hover:scale-[1.04] active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-uci-gold/60 bg-neutral-100';

  return (
    <div className="w-64 shrink-0 bg-white border-r border-neutral-200 flex flex-col">
      <div className="p-3 border-b border-neutral-100 shrink-0">
        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-2">Add to Canvas</p>
        <div className="flex bg-neutral-100 rounded-lg p-0.5 gap-0.5">
          <button onClick={() => setTab('library')} className={tabCls('library')}>Library</button>
          <button onClick={() => setTab('posts')} className={tabCls('posts')}>Posts</button>
          <button onClick={() => setTab('upload')} className={tabCls('upload')}>Upload</button>
        </div>
      </div>

      {tab === 'library' && (
        <div className="px-3 py-2 border-b border-neutral-100 shrink-0">
          <input
            type="text"
            placeholder="Search stickers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-lg placeholder-neutral-400 focus:outline-none focus:border-neutral-400"
          />
        </div>
      )}

      {tab === 'upload' && (
        <div className="px-3 py-2 border-b border-neutral-100 shrink-0">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full py-2 bg-espresso hover:bg-espresso/90 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : '+ Upload image'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2.5">
        {tab === 'library' && (
          isLoading ? (
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-square bg-neutral-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : stickers.length === 0 ? (
            <p className="text-neutral-400 text-xs text-center py-8">No stickers found</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {stickers.filter((s) => s.thumbnail).map((s) => (
                <button key={s.id} onClick={() => onNodeAdd(s.thumbnail!, 'library')} title={s.title} className={thumbCls}>
                  <img src={s.thumbnail!} alt={s.title} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )
        )}

        {tab === 'posts' && (
          postImages.length === 0 ? (
            <p className="text-neutral-400 text-xs text-center py-8">No post images yet</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {postImages.map((img, i) => (
                <button key={i} onClick={() => onNodeAdd(img.url, 'post')} title={img.caption} className={thumbCls}>
                  <img src={img.url} alt={img.caption} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )
        )}

        {tab === 'upload' && (
          <p className="text-neutral-400 text-xs text-center py-8">
            Click <span className="text-neutral-600 font-medium">+ Upload image</span> above to add from your device
          </p>
        )}
      </div>
    </div>
  );
}

// ── Right panel: controls ─────────────────────────────────────────────────────

interface RightPanelProps {
  background: BackgroundConfig;
  onChangeBackground: (bg: BackgroundConfig) => void;
  selectedId: string | null;
  nodes: CanvasNode[];
  keepRatio: boolean;
  onSetKeepRatio: (v: boolean) => void;
  isRemovingBg: boolean;
  removeBgError: string | null;
  onToggleRemoveBg: () => void;
  onMoveNodeUp: (id: string) => void;
  onMoveNodeDown: (id: string) => void;
  onDeleteNode: (id: string) => void;
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  onSave: () => void;
  onDiscard: () => void;
}

function RightPanel({
  background, onChangeBackground,
  selectedId, nodes, keepRatio, onSetKeepRatio,
  isRemovingBg, removeBgError, onToggleRemoveBg,
  onMoveNodeUp, onMoveNodeDown, onDeleteNode,
  isDirty, isSaving, saveError, onSave, onDiscard,
}: RightPanelProps) {
  const selectedNode = nodes.find((n) => n.id === selectedId);
  const nodeIdx = nodes.findIndex((n) => n.id === selectedId);
  const isTop = nodeIdx === nodes.length - 1;
  const isBottom = nodeIdx === 0;

  return (
    <div className="w-64 shrink-0 bg-white border-l border-neutral-200 flex flex-col">
      {/* Background presets */}
      <div className="p-3 border-b border-neutral-100 shrink-0">
        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-2.5">Background</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              title={p.label}
              onClick={() => onChangeBackground(p.bg)}
              className={`w-6 h-6 rounded-full border-2 transition-all ${
                background.value === p.bg.value
                  ? 'border-espresso scale-110 shadow'
                  : 'border-neutral-300 hover:border-neutral-500 hover:scale-105'
              }`}
              style={
                p.bg.type === 'color'
                  ? { background: p.bg.value }
                  : { background: `linear-gradient(135deg, ${p.bg.value}, ${p.bg.gradientEnd})` }
              }
            />
          ))}
        </div>
      </div>

      {/* Node controls — only shown when an image is selected */}
      {selectedId && selectedNode && (
        <div className="p-3 border-b border-neutral-100 shrink-0">
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-2.5">Selected Image</p>

          <p className="text-xs text-neutral-500 mb-1.5">Resize mode</p>
          <div className="flex rounded-lg overflow-hidden border border-neutral-200 mb-3">
            <button
              onClick={() => onSetKeepRatio(true)}
              className={`flex-1 py-1.5 text-xs font-medium transition-colors ${keepRatio ? 'bg-espresso text-white' : 'text-neutral-500 hover:text-espresso'}`}
            >
              Proportional
            </button>
            <button
              onClick={() => onSetKeepRatio(false)}
              className={`flex-1 py-1.5 text-xs font-medium transition-colors ${!keepRatio ? 'bg-espresso text-white' : 'text-neutral-500 hover:text-espresso'}`}
            >
              Free
            </button>
          </div>

          <p className="text-xs text-neutral-500 mb-1.5">Layer order</p>
          <div className="flex gap-1.5 mb-3">
            <button
              onClick={() => onMoveNodeDown(selectedId)}
              disabled={isBottom}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 text-neutral-700 hover:bg-neutral-200 disabled:opacity-30 transition-colors"
            >
              Send Back
            </button>
            <button
              onClick={() => onMoveNodeUp(selectedId)}
              disabled={isTop}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 text-neutral-700 hover:bg-neutral-200 disabled:opacity-30 transition-colors"
            >
              Bring Fwd
            </button>
          </div>

          <button
            onClick={onToggleRemoveBg}
            disabled={isRemovingBg}
            className={`w-full py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 mb-1.5 ${
              selectedNode.bgRemoved
                ? 'bg-uci-gold text-espresso'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            {isRemovingBg ? 'Removing BG…' : selectedNode.bgRemoved ? 'BG Removed ✓' : 'Remove BG'}
          </button>
          {removeBgError && <p className="text-red-500 text-xs mb-2">{removeBgError}</p>}

          <button
            onClick={() => onDeleteNode(selectedId)}
            className="w-full py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
          >
            Delete Image
          </button>
        </div>
      )}

      <div className="flex-1" />

      {/* Save / Discard */}
      <div className="p-3 border-t border-neutral-100 space-y-2 shrink-0">
        {saveError && <p className="text-red-500 text-xs">{saveError}</p>}
        {isDirty && (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <p className="text-amber-600 text-xs">Unsaved changes</p>
          </div>
        )}
        <button
          onClick={onSave}
          disabled={isSaving || !isDirty}
          className="w-full py-2 bg-uci-gold text-espresso text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onDiscard}
          className="w-full py-2 text-neutral-500 hover:text-espresso text-sm rounded-lg transition-colors"
        >
          Discard
        </button>
      </div>
    </div>
  );
}

// ── Shell (async canvas load) ─────────────────────────────────────────────────

interface Props {
  posts: Post[];
  onClose: () => void;
  onSaveSuccess: (previewPath: string) => void;
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
      <div className="flex w-full border border-neutral-200 rounded-xl overflow-hidden" style={{ minHeight: 400 }}>
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
      setScale(entry.contentRect.width / CANVAS_WIDTH);
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
      await saveCanvas(getCanvasJson());
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
    <div className="flex w-full border border-neutral-200 rounded-xl overflow-hidden">
      <LeftPanel
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

      <RightPanel
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
