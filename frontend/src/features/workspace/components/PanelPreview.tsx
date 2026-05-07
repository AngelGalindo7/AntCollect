import type { Panel } from '../types/workspace';

interface Props {
  panel: Panel;
}

export function PanelPreview({ panel }: Props) {
  if (panel.preview_path) {
    return (
      <img
        src={panel.preview_path}
        className="w-full h-full object-cover"
        alt=""
        draggable={false}
      />
    );
  }
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #f5f0eb 0%, #e8e0d8 100%)' }}
    >
      <p className="text-neutral-300 text-xs select-none">No preview yet</p>
    </div>
  );
}
