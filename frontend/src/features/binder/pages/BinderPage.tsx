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
    <BinderSheet
      isOpen={true}
      onClose={handleBack}
      onBack={handleBack}
      username={username}
      isOwner={isOwner}
    />
  );
}
