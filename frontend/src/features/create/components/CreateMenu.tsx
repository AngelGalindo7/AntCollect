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
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="rounded-3xl shadow-2xl p-8 w-140 max-w-[95vw]"
        style={{
          background: 'radial-gradient(ellipse at top, #FDFCF0 60%, #EFE9DF 100%)',
          fontFamily: "'Quicksand', sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-7">
          <h2 className="text-2xl font-bold text-espresso">What are you creating? 🎴</h2>
          <p className="text-sm text-espresso/50 mt-1">Add something new to the community</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* New Post */}
          <button
            onClick={onSelectPost}
            data-testid="create-menu-post"
            className="group flex flex-col items-center gap-3 p-5 rounded-2xl transition-all hover:scale-[1.04] active:scale-95 shadow-md"
            style={{ background: 'linear-gradient(135deg, #F2A900 0%, #e09500 100%)' }}
          >
            <span className="text-4xl drop-shadow">✨</span>
            <div className="text-center">
              <p className="text-sm font-bold text-white drop-shadow-sm">New Post</p>
              <p className="text-[11px] text-white/80 mt-0.5 leading-snug">Share what you found or traded</p>
            </div>
          </button>

          {/* New Folder */}
          <button
            onClick={onSelectFolder}
            data-testid="create-menu-folder"
            className="group flex flex-col items-center gap-3 p-5 rounded-2xl transition-all hover:scale-[1.04] active:scale-95 shadow-md"
            style={{ background: 'linear-gradient(135deg, #C85A3A 0%, #a84830 100%)' }}
          >
            <span className="text-4xl drop-shadow">📒</span>
            <div className="text-center">
              <p className="text-sm font-bold text-white drop-shadow-sm">New Folder</p>
              <p className="text-[11px] text-white/80 mt-0.5 leading-snug">Organize your collection</p>
            </div>
          </button>

          {/* Catalog Entry */}
          <button
            onClick={onSelectCatalog}
            data-testid="create-menu-catalog"
            className="group flex flex-col items-center gap-3 p-5 rounded-2xl transition-all hover:scale-[1.04] active:scale-95 shadow-md"
            style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
          >
            <span className="text-4xl drop-shadow">🔍</span>
            <div className="text-center">
              <p className="text-sm font-bold text-white drop-shadow-sm">Catalog Entry</p>
              <p className="text-[11px] text-white/80 mt-0.5 leading-snug">Add a missing sticker to the database</p>
            </div>
          </button>
        </div>

        <p className="text-center text-xs text-espresso/30 mt-6">Tap outside to dismiss</p>
      </div>
    </div>
  );
};

export default CreateMenu;
