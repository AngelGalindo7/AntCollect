import { useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BinderSheet from '../BinderSheet';
import { getSession } from '@/shared/auth/session';

export default function BinderPage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const session = getSession();
  const isOwner = !!session && session.username === username;

  const handleBack = useCallback(() => navigate(`/${username}`), [username, navigate]);

  return (
    <>
      <BinderSheet
        isOpen={true}
        onClose={handleBack}
        username={username}
        isOwner={isOwner}
      />
      {/* Back nav — floats above the BinderSheet header (z-50); pointer-events-none
          wrapper prevents blocking BinderSheet's right-side close button */}
      <div className="fixed top-0 left-0 z-[60] h-16 flex items-center px-6 pointer-events-none">
        <button
          onClick={handleBack}
          className="pointer-events-auto flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-sm font-medium"
        >
          ← @{username}
        </button>
      </div>
    </>
  );
}
