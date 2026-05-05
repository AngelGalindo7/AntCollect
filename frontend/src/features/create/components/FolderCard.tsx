import React from 'react';
import type { Folder } from '@/shared/types/Types';

interface FolderCardProps {
  folder: Folder;
  onClick?: (folder: Folder) => void;
}

const FolderCard: React.FC<FolderCardProps> = ({ folder, onClick }) => {
  const previews = folder.preview_images ?? [];
  const tiles = previews.slice(0, 4);
  while (tiles.length < 4) tiles.push('');

  return (
    <div
      data-testid="folder-card"
      className="cursor-pointer group"
      onClick={() => onClick?.(folder)}
    >
      <div
        className="
          relative w-full aspect-square overflow-hidden
          bg-white rounded-2xl border border-black/5
          shadow-sm group-hover:shadow-md transition-shadow duration-200
        "
      >
        {folder.avatar_path ? (
          <img
            src={folder.avatar_path}
            alt={folder.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : previews.length > 0 ? (
          <div className="grid grid-cols-2 grid-rows-2 gap-px w-full h-full bg-black/5">
            {tiles.map((src, i) =>
              src ? (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div key={i} className="w-full h-full bg-soft-white" />
              )
            )}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-soft-white">
            <svg
              className="w-16 h-16 text-warm-gray/60"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
          </div>
        )}

        <span className="absolute bottom-2 right-2 text-[11px] font-medium text-white bg-black/55 backdrop-blur-sm rounded-full px-2 py-0.5">
          {folder.post_count} {folder.post_count === 1 ? 'post' : 'posts'}
        </span>
      </div>

      <div className="mt-2 px-1 text-center">
        <p className="text-sm font-bold text-espresso truncate">{folder.name}</p>
      </div>
    </div>
  );
};

export default FolderCard;
