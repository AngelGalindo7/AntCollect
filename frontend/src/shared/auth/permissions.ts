import type { Session } from './session';

export function canModeratePosts(session: Session | null): boolean {
  return session?.role === 'admin' || session?.role === 'moderator';
}
