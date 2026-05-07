import { useCallback } from 'react';
import { useUIStore } from '@/shared/store/useUIStore';
import { getSession } from '@/shared/auth/session';

export function useGuestGate() {
  const openAuthWall = useUIStore((s) => s.openAuthWall);

  const guard = useCallback(
    (fn: () => void): void => {
      if (!getSession()) {
        openAuthWall();
        return;
      }
      fn();
    },
    [openAuthWall],
  );

  return { guard };
}
