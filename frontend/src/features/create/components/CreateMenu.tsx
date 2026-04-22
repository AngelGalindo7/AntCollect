import React from 'react';

interface CreateMenuProps {
  onSelectPost: () => void;
  onSelectFolder: () => void;
  onSelectCatalog: () => void;
  onClose: () => void;
}

const CreateMenu: React.FC<CreateMenuProps> = ({ onSelectPost, onSelectFolder, onSelectCatalog, onClose }) => {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="rounded-[24px] shadow-2xl p-8 w-[540px] max-w-[95vw]"
        style={{ background: '#FDFCF0', fontFamily: "'Quicksand', sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-espresso mb-1">Create</h2>
        <p className="text-sm text-warm-gray mb-6">What would you like to add?</p>

        <div className="grid grid-cols-3 gap-4">
          {/* New Post */}
          <button
            onClick={onSelectPost}
            data-testid="create-menu-post"
            className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-warm-gray/50 hover:border-amber-400 hover:bg-amber-50/60 transition-all text-center group"
          >
            <span className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center shrink-0 group-hover:bg-amber-200 transition-colors">
              <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-bold text-espresso">New Post</p>
              <p className="text-xs text-warm-gray mt-1 leading-snug">Share what you just found or traded!</p>
            </div>
          </button>

          {/* New Folder */}
          <button
            onClick={onSelectFolder}
            data-testid="create-menu-folder"
            className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-warm-gray/50 hover:border-orange-400 hover:bg-orange-50/60 transition-all text-center group"
          >
            <span className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center shrink-0 group-hover:bg-orange-200 transition-colors">
              <svg className="w-7 h-7 text-orange-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-bold text-espresso">New Folder</p>
              <p className="text-xs text-warm-gray mt-1 leading-snug">Organize your collection for others to see.</p>
            </div>
          </button>

          {/* Catalog Entry */}
          <button
            onClick={onSelectCatalog}
            data-testid="create-menu-catalog"
            className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-warm-gray/50 hover:border-emerald-400 hover:bg-emerald-50/60 transition-all text-center group"
          >
            <span className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-200 transition-colors">
              <svg className="w-7 h-7 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-bold text-espresso">Catalog Entry</p>
              <p className="text-xs text-warm-gray mt-1 leading-snug">Add a missing sticker to our community database.</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateMenu;
