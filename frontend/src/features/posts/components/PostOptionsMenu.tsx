import React, { useState, useRef, useEffect } from 'react';
import { Flag, MoreVertical, Shield, Trash2, X } from 'lucide-react';

interface PostOptionsMenuProps {
  isOwner?: boolean;
  canModerate?: boolean;
  onDeleteClick?: (e: React.MouseEvent) => void;
  onAdminDeleteClick?: (e: React.MouseEvent) => void;
  onReportClick?: (e: React.MouseEvent) => void;
}

const PostOptionsMenu: React.FC<PostOptionsMenuProps> = ({
  isOwner,
  canModerate,
  onDeleteClick,
  onAdminDeleteClick,
  onReportClick,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    onDeleteClick?.(e);
  };

  const handleAdminDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    onAdminDeleteClick?.(e);
  };

  const handleReport = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    onReportClick?.(e);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={toggleMenu}
        className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors flex items-center justify-center"
        aria-label="Options"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-40 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-30 animate-in fade-in zoom-in duration-100">
          {isOwner && (
            <button
              onClick={handleDelete}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Post</span>
            </button>
          )}

          {!isOwner && canModerate && (
            <button
              onClick={handleAdminDelete}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors text-left"
            >
              <Shield className="w-4 h-4" />
              <span>Delete (admin)</span>
            </button>
          )}

          {!isOwner && !canModerate && (
            <button
              onClick={handleReport}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 transition-colors text-left"
            >
              <Flag className="w-4 h-4" />
              <span>Report Post</span>
            </button>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
          >
            <X className="w-4 h-4" />
            <span>Cancel</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default PostOptionsMenu;
