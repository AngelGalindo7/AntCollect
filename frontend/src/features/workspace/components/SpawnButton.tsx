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
      title="Add panel"
      style={{ position: 'absolute', bottom: 20, right: 20 }}
      className="w-11 h-11 rounded-full bg-espresso text-uci-gold flex items-center justify-center shadow-lg hover:opacity-90 active:scale-95 disabled:opacity-40 transition-all"
    >
      <Plus size={20} strokeWidth={2.5} />
    </button>
  );
}
