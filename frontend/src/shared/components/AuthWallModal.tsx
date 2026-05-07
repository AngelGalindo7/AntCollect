import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useUIStore } from '@/shared/store/useUIStore';

export const AuthWallModal: React.FC = () => {
  const { isAuthWallOpen } = useUIStore();
  const signInRef = useRef<HTMLAnchorElement>(null);

  // Capture-phase listener blocks Escape from closing any underlying modal
  // (e.g. PostDetailModal uses bubble-phase; capture fires first).
  useEffect(() => {
    if (!isAuthWallOpen) return;
    const block = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', block, true);
    return () => window.removeEventListener('keydown', block, true);
  }, [isAuthWallOpen]);

  // Auto-focus sign-in link on open for keyboard accessibility.
  useEffect(() => {
    if (isAuthWallOpen) signInRef.current?.focus();
  }, [isAuthWallOpen]);

  if (!isAuthWallOpen) return null;

  const root = document.getElementById('modal-root');
  if (!root) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="authwall-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8 flex flex-col items-center gap-6">
        <span className="text-2xl font-bold text-espresso tracking-tight">PetrCollect</span>

        <div className="text-center">
          <h2 id="authwall-title" className="text-lg font-semibold text-gray-900 mb-2">
            Sign in to interact
          </h2>
          <p className="text-sm text-gray-500">
            Create an account or sign in to like, trade, and connect with other collectors.
          </p>
        </div>

        <div className="flex flex-col w-full gap-3">
          <Link
            ref={signInRef}
            to="/Login"
            className="w-full py-2.5 text-center text-sm font-semibold bg-campus-blue text-white rounded-xl hover:opacity-90 transition-opacity"
          >
            Sign In
          </Link>
          <Link
            to="/CreateAccount"
            className="w-full py-2.5 text-center text-sm font-semibold border border-gray-200 text-espresso rounded-xl hover:bg-gray-50 transition-colors"
          >
            Create Account
          </Link>
        </div>

        <button
          onClick={() => window.history.back()}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Go back
        </button>
      </div>
    </div>,
    root,
  );
};
