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
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider isAuthenticated={isAuthenticated}>
        {children}
      </WebSocketProvider>
    </QueryClientProvider>
  );
}

