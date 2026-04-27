import type { BackgroundConfig } from '../types/canvas';

const PRESETS: { label: string; bg: BackgroundConfig }[] = [
  { label: 'Cream',     bg: { type: 'color', value: '#f5f0e8' } },
  { label: 'White',     bg: { type: 'color', value: '#ffffff' } },
  { label: 'Black',     bg: { type: 'color', value: '#111111' } },
  { label: 'Navy',      bg: { type: 'color', value: '#003366' } },
  { label: 'UCI Gold',  bg: { type: 'color', value: '#ffd200' } },
  { label: 'UCI Blue',  bg: { type: 'color', value: '#0064a4' } },
  { label: 'Sunset',    bg: { type: 'gradient', value: '#ff6b35', gradientEnd: '#ffd200', angle: 135 } },
  { label: 'Ocean',     bg: { type: 'gradient', value: '#0064a4', gradientEnd: '#00b4d8', angle: 135 } },
  { label: 'Dusk',      bg: { type: 'gradient', value: '#4a1942', gradientEnd: '#ff6b35', angle: 135 } },
  { label: 'Forest',    bg: { type: 'gradient', value: '#1b4332', gradientEnd: '#40916c', angle: 135 } },
];

interface Props {
  background: BackgroundConfig;
  onBackgroundChange: (bg: BackgroundConfig) => void;
  onSave: () => void;
  onClose: () => void;
  isSaving: boolean;
  isDirty: boolean;
}

export function CanvasToolbar({ background, onBackgroundChange, onSave, onClose, isSaving, isDirty }: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-neutral-900 border-b border-neutral-700 shrink-0">
      <button
        onClick={onClose}
        className="text-neutral-400 hover:text-white transition-colors text-lg leading-none"
        title="Close"
      >
        ✕
      </button>

      <span className="text-neutral-200 text-sm font-medium">Canvas Editor</span>

      <div className="flex items-center gap-1 ml-2 flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            title={p.label}
            onClick={() => onBackgroundChange(p.bg)}
            className={`w-5 h-5 rounded-full border-2 transition-all ${
              background.value === p.bg.value
                ? 'border-white scale-110'
                : 'border-neutral-600 hover:border-neutral-400'
            }`}
            style={
              p.bg.type === 'color'
                ? { background: p.bg.value }
                : { background: `linear-gradient(135deg, ${p.bg.value}, ${p.bg.gradientEnd})` }
            }
          />
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {isDirty && (
          <span className="w-2 h-2 rounded-full bg-yellow-400" title="Unsaved changes" />
        )}
        <button
          onClick={onSave}
          disabled={isSaving || !isDirty}
          className="px-4 py-1.5 bg-uci-gold text-espresso text-sm font-semibold rounded hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
