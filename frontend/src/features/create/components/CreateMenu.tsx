import React from 'react';

interface CreateMenuProps {
  onSelectPost: () => void;
  onSelectFolder: () => void;
  onSelectCanvas: () => void;
  onClose: () => void;
}

const ITEMS = [
  {
    key: 'post',
    title: 'New Post',
    desc: 'Share a sticker you found or traded',
  },
  {
    key: 'folder',
    title: 'New Folder',
    desc: 'Organize your collection for others to see',
  },
  {
    key: 'canvas',
    title: 'Canvas',
    desc: 'Arrange your stickers into a showcase',
  },
] as const;

type ItemKey = typeof ITEMS[number]['key'];

const CreateMenu: React.FC<CreateMenuProps> = ({ onSelectPost, onSelectFolder, onSelectCanvas, onClose }) => {
  const handlers: Record<ItemKey, () => void> = {
    post: onSelectPost,
    folder: onSelectFolder,
    canvas: onSelectCanvas,
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl shadow-xl overflow-hidden bg-warm-cream"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-warm-gray/40">
          <h2 className="text-base font-bold text-espresso">Create</h2>
        </div>

        {/* Options */}
        {ITEMS.map((item, i) => (
          <button
            key={item.key}
            data-testid={`create-menu-${item.key}`}
            onClick={handlers[item.key]}
            className={`w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-espresso/5 transition-colors ${
              i < ITEMS.length - 1 ? 'border-b border-warm-gray/30' : ''
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-espresso">{item.title}</p>
              <p className="text-xs text-espresso/50 mt-0.5">{item.desc}</p>
            </div>
            <svg className="w-4 h-4 text-espresso/25 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CreateMenu;
