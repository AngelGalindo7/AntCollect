import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Sparkles } from 'lucide-react';
import BinderViewer from './BinderViewer';

interface BinderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  username?: string;
}

export default function BinderSheet({ isOpen, onClose, username }: BinderSheetProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet — slides in from left, exits to right */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.45, ease: [0.45, 0, 0.55, 1] }}
            className="fixed inset-0 z-50 bg-[#1c1c1e] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2 text-slate-200">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <span className="font-semibold text-lg tracking-tight">
                  {username ? `${username}'s Binder` : 'Sticker Binder'}
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-slate-300 hover:text-white"
                aria-label="Close binder"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Binder visual */}
            <div className="flex-1 flex items-center justify-center px-8 py-6 overflow-hidden">
              <BinderViewer />
            </div>

            {/* Footer hint */}
            <div className="shrink-0 pb-5 flex items-center justify-center gap-2 text-[#8e8e93] text-sm opacity-70">
              <Sparkles className="w-4 h-4" />
              Swipe or click the corners to turn pages
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
