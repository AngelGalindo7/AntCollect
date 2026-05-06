import { Plus } from 'lucide-react';

interface Props {
  onSpawn: () => void;
  disabled?: boolean;
}

export function SpawnButton({ onSpawn, disabled = false }: Props) {
  return (
    <button
      onClick={onSpawn}
      disabled={disabled}
      style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 9999 }}
      className="flex items-center gap-2 px-4 h-11 rounded-full bg-espresso text-uci-gold shadow-lg hover:opacity-90 active:scale-95 disabled:opacity-40 transition-all"
    >
      <Plus size={18} strokeWidth={2.5} />
      <span className="text-sm font-semibold">Add Panel</span>
    </button>
  );
}
