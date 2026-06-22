import { useState } from 'react';
import { X } from 'lucide-react';

const PRESETS = [
  { key: 'story',  label: 'Story',  w: 540,  h: 960, ratio: '9:16' },
  { key: 'square', label: 'Square', w: 720,  h: 720, ratio: '1:1'  },
  { key: 'banner', label: 'Banner', w: 1200, h: 400, ratio: '3:1'  },
  { key: 'wide',   label: 'Wide',   w: 1280, h: 720, ratio: '16:9' },
] as const;

type PresetKey = typeof PRESETS[number]['key'];

interface Props {
  existingCount: number;
  onClose: () => void;
  onCreate: (w: number, h: number, title: string | null) => Promise<void>;
}

export function NewPanelModal({ onClose, onCreate }: Props) {
  const [selected, setSelected] = useState<PresetKey | 'custom'>('banner');
  const [customW, setCustomW] = useState('800');
  const [customH, setCustomH] = useState('600');
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const preset = PRESETS.find((p) => p.key === selected);
  const isCustom = selected === 'custom';
  const finalW = isCustom ? Math.max(280, parseInt(customW, 10) || 280) : (preset?.w ?? 1200);
  const finalH = isCustom ? Math.max(220, parseInt(customH, 10) || 220) : (preset?.h ?? 400);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await onCreate(finalW, finalH, title.trim() || null);
    } catch {
      setCreating(false);
    }
  };

  const btnClass = (key: string) =>
    `flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer text-center ${
      selected === key
        ? 'border-campus-blue bg-blue-50'
        : 'border-warm-gray/30 bg-warm-cream hover:border-campus-blue/50 hover:bg-white'
    }`;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl shadow-xl overflow-hidden"
        style={{ background: '#FDFCF0', fontFamily: "'Quicksand', sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-gray/40">
          <h2 className="text-base font-bold text-espresso">New Canvas</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-warm-gray/30 text-espresso/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm font-semibold text-espresso/70">Choose a size:</p>

          {/* Preset grid */}
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => {
              const maxDim = 40;
              const pw = p.w > p.h ? maxDim : Math.round(maxDim * p.w / p.h);
              const ph = p.h > p.w ? 26 : Math.round(26 * p.h / p.w);
              return (
                <button key={p.key} onClick={() => setSelected(p.key)} className={btnClass(p.key)}>
                  <div
                    className="border border-espresso/25 rounded"
                    style={{ width: pw, height: ph, background: 'rgba(0,0,0,0.07)' }}
                  />
                  <span className="text-xs font-bold text-espresso">{p.label}</span>
                  <span className="text-[10px] text-espresso/40">{p.ratio}</span>
                </button>
              );
            })}

            <button onClick={() => setSelected('custom')} className={`${btnClass('custom')} col-span-2`}>
              <div className="w-10 h-6 border border-dashed border-espresso/30 rounded flex items-center justify-center">
                <span className="text-[10px] text-espresso/40">W×H</span>
              </div>
              <span className="text-xs font-bold text-espresso">Custom</span>
            </button>
          </div>

          {/* Custom dimensions */}
          {isCustom && (
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={customW}
                onChange={(e) => setCustomW(e.target.value)}
                placeholder="Width"
                min={280}
                className="flex-1 border border-warm-gray/40 rounded-lg px-3 py-2 text-sm text-espresso bg-white outline-none focus:border-campus-blue"
              />
              <span className="text-espresso/40 text-sm">×</span>
              <input
                type="number"
                value={customH}
                onChange={(e) => setCustomH(e.target.value)}
                placeholder="Height"
                min={220}
                className="flex-1 border border-warm-gray/40 rounded-lg px-3 py-2 text-sm text-espresso bg-white outline-none focus:border-campus-blue"
              />
            </div>
          )}

          {/* Name */}
          <div>
            <p className="text-sm font-semibold text-espresso/70 mb-1.5">Name (optional):</p>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='e.g. "My Favorites"'
              maxLength={80}
              className="w-full border border-warm-gray/40 rounded-lg px-3 py-2 text-sm text-espresso bg-white outline-none focus:border-campus-blue"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full rounded-xl py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: '#0064A4' }}
          >
            {creating ? 'Creating…' : 'Create Canvas'}
          </button>
        </div>
      </div>
    </div>
  );
}
