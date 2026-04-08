import React from 'react';
import type { Folder, FolderType } from '@/shared/types/Types';

const FOLDER_TYPE_LABELS: Record<FolderType, string> = {
  collection: 'Collection',
  looking_for: 'Looking For',
  trading: 'Trading Away',
};

interface FolderCardProps {
  folder: Folder;
  onClick?: (folder: Folder) => void;
}

const FolderCard: React.FC<FolderCardProps> = ({ folder, onClick }) => {
  return (
    <div
      className="cursor-pointer group"
      onClick={() => onClick?.(folder)}
    >
      <div className="relative">
        {/* Tab — sits above-left of the body */}
        <div className="w-2/5 h-6 bg-gray-900 rounded-t-lg relative z-10" />

        {/* Body — overlaps tab bottom by 1px so borders join flush.
            No top-left radius so the left edge runs continuous with the tab's left border. */}
        <div
          className="
            -mt-px w-full aspect-square
            bg-purple-50 border-[3px] border-gray-900
            rounded-b-2xl rounded-tr-2xl overflow-hidden
            flex flex-col items-center justify-center gap-3
            group-hover:bg-purple-100 transition-colors duration-200
          "
        >
          <svg
            className="w-16 h-16 text-purple-300"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>
          <span className="text-sm font-medium text-purple-400">
            {folder.post_count} {folder.post_count === 1 ? 'post' : 'posts'}
          </span>
        </div>
      </div>

      {/* Label below — equivalent of PostCard's header/footer text area */}
      <div className="mt-2 px-1 text-center">
        <p className="text-sm font-bold text-gray-900 truncate">{folder.name}</p>
        <p className="text-xs text-purple-500 mt-0.5">
          {FOLDER_TYPE_LABELS[folder.folder_type]}
        </p>
      </div>
    </div>
  );
};

export default FolderCard;
