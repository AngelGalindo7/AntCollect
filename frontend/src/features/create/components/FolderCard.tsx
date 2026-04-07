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
      className="relative bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 cursor-pointer"
      onClick={() => onClick?.(folder)}
    >
      {/* Header — matches PostCard title area */}
      <div className="px-3 py-2 bg-white border-b border-gray-200 flex items-start justify-between">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 flex-1 pr-2">
          {folder.name}
        </h3>
        <div className="shrink-0 w-7 h-7 rounded-full bg-purple-700 text-white flex items-center justify-center text-xs font-bold">
          F
        </div>
      </div>

      {/* Avatar area — same aspect-square as PostCard image, blank for now */}
      <div className="relative aspect-square overflow-hidden bg-purple-50 flex items-center justify-center">
        <svg
          className="w-16 h-16 text-purple-200"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        </svg>
      </div>

      {/* Footer — type badge + post count */}
      <div className="px-3 py-2 bg-white border-t border-gray-200 flex items-center justify-between">
        <span className="text-xs font-medium text-purple-600 bg-purple-50 rounded-full px-2 py-0.5">
          {FOLDER_TYPE_LABELS[folder.folder_type]}
        </span>
        <span className="text-sm text-gray-500">
          {folder.post_count} {folder.post_count === 1 ? 'post' : 'posts'}
        </span>
      </div>
    </div>
  );
};

export default FolderCard;
