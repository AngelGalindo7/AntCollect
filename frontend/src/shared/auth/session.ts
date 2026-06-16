export type Role = 'user' | 'moderator' | 'admin';

export interface Session {
  userId: string;
  username: string;
  email: string;
  role: Role;
}

let _memRole: Role | null = null;

const KEYS = ['userId', 'username', 'email'] as const;

export function getSession(): Session | null {
  const userId = localStorage.getItem('userId');
  if (!userId) return null;
  return {
    userId,
    username: localStorage.getItem('username') ?? '',
    email: localStorage.getItem('email') ?? '',
    role: (_memRole ?? 'user') as Role,
  };
}

export function setSession(s: Session): void {
  localStorage.setItem('userId', s.userId);
  localStorage.setItem('username', s.username);
  localStorage.setItem('email', s.email);
  _memRole = s.role;
}

export function clearSession(): void {
  for (const k of KEYS) localStorage.removeItem(k);
  _memRole = null;
}
