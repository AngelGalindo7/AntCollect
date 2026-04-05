import React from 'react';

interface CreateMenuProps {
  onSelectPost: () => void;
  onSelectFolder: () => void;
  onClose: () => void;
}

const CreateMenu: React.FC<CreateMenuProps> = ({ onSelectPost, onSelectFolder, onClose }) => {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-72 p-6 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-800 mb-1">Create</h2>

        <button
          onClick={onSelectPost}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
        >
          <span className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-medium text-gray-900">Post</p>
            <p className="text-xs text-gray-400">Share a sticker or card</p>
          </div>
        </button>

        <button
          onClick={onSelectFolder}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition-colors text-left"
        >
          <span className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-medium text-gray-900">Folder</p>
            <p className="text-xs text-gray-400">Group posts into a collection</p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default CreateMenu;
