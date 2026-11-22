import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function createQueryClient(options: { retryDelay?: number } = {}) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        // In produzione vale il backoff esponenziale predefinito; i test lo azzerano.
        ...(options.retryDelay !== undefined ? { retryDelay: options.retryDelay } : {}),
      },
    },
  });
}

export function Providers({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const [defaultClient] = useState(createQueryClient);
  return <QueryClientProvider client={client ?? defaultClient}>{children}</QueryClientProvider>;
}
