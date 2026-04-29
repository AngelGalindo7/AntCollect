interface Props {
  previewPath: string | null;
  isOwner: boolean;
  onEditClick: () => void;
}

export function CanvasPreview({ previewPath, isOwner, onEditClick }: Props) {
  if (!previewPath && !isOwner) return null;

  return (
    <div className="relative w-full">
      {previewPath ? (
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/9' }}>
          <img
            src={previewPath}
            alt="Sticker showcase"
            className="w-full h-full object-cover"
          />
          {isOwner && (
            <button
              onClick={onEditClick}
              className="absolute top-3 right-3 bg-white/80 hover:bg-white text-espresso text-xs font-semibold px-3 py-1.5 rounded-lg shadow transition-colors"
            >
              Edit Canvas
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={onEditClick}
          className="w-full border-2 border-dashed border-warm-gray/40 hover:border-warm-gray/70 transition-colors flex flex-col items-center justify-center gap-2 py-10 text-warm-gray/60 hover:text-warm-gray/90"
          style={{ aspectRatio: '16/9' }}
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-sm font-medium">Create your showcase</span>
          <span className="text-xs">Arrange your stickers into a canvas</span>
        </button>
      )}
    </div>
  );
}
