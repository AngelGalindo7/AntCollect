import type { BackgroundConfig, CanvasNode } from '../types/canvas';
import { BACKGROUND_PRESETS } from '../constants/backgroundPresets';

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
  onToggleHolo: (id: string) => void;
  onCropNode: (id: string) => void;
  onDeleteNode: (id: string) => void;
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  onSave: () => void;
  onDiscard: () => void;
}

export function StickerControls({
  background, onChangeBackground,
  selectedId, nodes, keepRatio, onSetKeepRatio,
  isRemovingBg, removeBgError, onToggleRemoveBg,
  onMoveNodeUp, onMoveNodeDown, onToggleHolo, onCropNode, onDeleteNode,
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
          {BACKGROUND_PRESETS.map((p) => (
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
            onClick={() => onCropNode(selectedId)}
            className="w-full py-1.5 rounded-lg text-xs font-medium bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors mb-1.5"
          >
            Crop
          </button>

          <button
            onClick={() => onToggleHolo(selectedId)}
            className={`w-full py-1.5 rounded-lg text-xs font-medium transition-colors mb-1.5 ${
              selectedNode.holo
                ? 'bg-uci-gold text-espresso'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            {selectedNode.holo ? '✦ Holo On' : '✦ Holo Off'}
          </button>

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
