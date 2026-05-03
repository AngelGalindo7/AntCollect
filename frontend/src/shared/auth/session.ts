export type Role = 'user' | 'moderator' | 'admin';

export interface Session {
  userId: string;
  username: string;
  email: string;
  role: Role;
}

const KEYS = ['userId', 'username', 'email', 'role'] as const;

export function getSession(): Session | null {
  const userId = localStorage.getItem('userId');
  if (!userId) return null;
  const role = (localStorage.getItem('role') as Role | null) ?? 'user';
  return {
    userId,
    username: localStorage.getItem('username') ?? '',
    email: localStorage.getItem('email') ?? '',
    role,
  };
}

export function setSession(s: Session): void {
  localStorage.setItem('userId', s.userId);
  localStorage.setItem('username', s.username);
  localStorage.setItem('email', s.email);
  localStorage.setItem('role', s.role);
}

export function clearSession(): void {
  for (const k of KEYS) localStorage.removeItem(k);
}
