import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WebSocketProvider } from '@/features/messaging';

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
    () => !!localStorage.getItem('userId')
  );

  useEffect(() => {
    const handleStorage = () => setIsAuthenticated(!!localStorage.getItem('userId'));
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

  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider isAuthenticated={isAuthenticated}>
        {children}
      </WebSocketProvider>
    </QueryClientProvider>
  );
}

