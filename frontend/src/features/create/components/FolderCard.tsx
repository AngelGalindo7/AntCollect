import React from 'react';
import type { Folder } from '@/shared/types/Types';

interface FolderCardProps {
  folder: Folder;
  onClick?: (folder: Folder) => void;
}

const FolderCard: React.FC<FolderCardProps> = ({ folder, onClick }) => {
  return (
    <div
      data-testid="folder-card"
      className="cursor-pointer group"
      onClick={() => onClick?.(folder)}
    >
      <div className="relative z-0">
        {/* Tab — same fill as body, bordered on 3 sides (no bottom).
            z-10 so its background covers the body's top-left border beneath it,
            creating a seamless folder-tab silhouette. */}
        <div className="relative z-10 w-2/5 h-6 bg-soft-white border-[3px] border-b-0 border-espresso rounded-t-lg" />

        {/* Body — -mt-[3px] pulls it up exactly one border-width so the left
            edge is continuous with the tab. No top-left radius needed; the tab
            sits flush there. The body's top border shows only on the right 60%,
            forming the folder's "shelf". */}
        <div
          className="
            relative z-0 -mt-0.75 w-full aspect-square
            bg-soft-white border-[3px] border-espresso
            rounded-b-2xl rounded-tr-2xl overflow-hidden
            flex flex-col items-center justify-center gap-3
            group-hover:bg-warm-cream transition-colors duration-200
          "
        >
          {folder.avatar_path ? (
            <>
              <img
                src={folder.avatar_path}
                alt={folder.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <span className="absolute bottom-2 right-2 text-xs font-medium text-white bg-black/50 rounded-full px-2 py-0.5">
                {folder.post_count} {folder.post_count === 1 ? 'post' : 'posts'}
              </span>
            </>
          ) : (
            <>
              <svg
                className="w-20 h-20 text-warm-gray"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              <span className="text-sm font-medium text-espresso/40">
                {folder.post_count} {folder.post_count === 1 ? 'post' : 'posts'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Folder name only — mirrors the image's label-below pattern */}
      <div className="mt-2 px-1 text-center">
        <p className="text-sm font-bold text-espresso truncate">{folder.name}</p>
      </div>
    </div>
  );
};

export default FolderCard;
