import { useState, useEffect, useRef, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// DECOMMISSIONED 2026-05-06: trading & messaging — see docs/RECOMMISSION_TRADING_MESSAGING.md
// import { WebSocketProvider } from '@/features/messaging';
import { refreshAccessToken, fetchWithAuth, API_BASE } from '@/shared/api/api';
import { getSession, setSession, clearSession } from '@/shared/auth/session';
import type { Role } from '@/shared/auth/session';
import { Toaster } from '@/shared/feedback/Toaster';

export const AuthContext = createContext(false);
export const useIsAuthenticated = () => useContext(AuthContext);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {

  const [isAuthenticated, setIsAuthenticated] = useState(
    () => getSession() !== null
  );

  // Separate flag: token has been confirmed valid this session.
  // WebSocketProvider gates on this so the WS upgrade never fires with an
  // expired cookie — JwtHandshakeInterceptor rejects expired tokens at the
  // upgrade step, causing an immediate disconnect + 5s reconnect delay.
  const [isWsReady, setIsWsReady] = useState(false);

  useEffect(() => {
    const handleStorage = () => setIsAuthenticated(getSession() !== null);
    // 'storage' fires when another tab changes localStorage.
    // 'auth:login' is dispatched by LogIn.tsx after same-tab login because
    // the browser does NOT fire 'storage' for same-window localStorage writes.
    window.addEventListener('storage', handleStorage);
    window.addEventListener('auth:login', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('auth:login', handleStorage);
    };
  }, []);

  // Invalidate all cached queries when the user signs in so stale guest data
  // (is_liked: false, is_owner: false) is replaced with personalized responses.
  const prevAuthRef = useRef(false);
  useEffect(() => {
    if (isAuthenticated && !prevAuthRef.current) {
      queryClient.invalidateQueries();
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // When auth state becomes true (login or page load with existing session),
  // proactively refresh the token before the WebSocket connects. This ensures
  // the access_token cookie is valid for the WS upgrade handshake.
  //
  // Skip the round-trip if the token was refreshed within the last 20 minutes
  // (well inside the 30-minute access-token TTL). sessionStorage survives
  // page.reload() but is cleared per tab, so each new tab still refreshes once.
  useEffect(() => {
    if (!isAuthenticated) {
      setIsWsReady(false);
      sessionStorage.removeItem('wsReady');
      return;
    }
    const SKEW_MS = 20 * 60 * 1000;
    const last = parseInt(sessionStorage.getItem('wsReady') ?? '0', 10);
    if (Date.now() - last < SKEW_MS) {
      setIsWsReady(true);
      return;
    }
    refreshAccessToken().then(ok => {
      if (ok) {
        sessionStorage.setItem('wsReady', String(Date.now()));
        setIsWsReady(true);
      } else {
        clearSession();
        setIsAuthenticated(false);
        window.location.href = '/Login';
      }
    });
  }, [isAuthenticated]);

  // Sync the locally-stored role from the server on boot so that a tampered
  // localStorage role cannot grant elevated UI access. Runs once per session
  // (guarded by sessionStorage) so it doesn't add a round-trip on every render.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (sessionStorage.getItem('roleSynced')) return;
    fetchWithAuth(`${API_BASE}/users/me`)
      .then((res) => {
        if (!res.ok) return;
        return res.json();
      })
      .then((data: { id: number; username: string; email: string; role: string } | undefined) => {
        if (!data) return;
        const session = getSession();
        if (!session) return;
        setSession({ ...session, role: data.role as Role });
        sessionStorage.setItem('roleSynced', '1');
      })
      .catch(() => {
        // Non-fatal — worst case the stale role stays until next boot sync.
      });
  }, [isAuthenticated]);

  // Avoid TS unused-var warning for isWsReady while WebSocketProvider is decommissioned.
  void isWsReady;

  return (
    <AuthContext.Provider value={isAuthenticated}>
      <QueryClientProvider client={queryClient}>
        {/* DECOMMISSIONED 2026-05-06: trading & messaging — see docs/RECOMMISSION_TRADING_MESSAGING.md */}
        {/* <WebSocketProvider isAuthenticated={isWsReady}> ... </WebSocketProvider> */}
        <>
          {children}
          <Toaster />
        </>
      </QueryClientProvider>
    </AuthContext.Provider>
  );
}

