import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { restoreSession } from '../src/auth/session';

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000 },
          mutations: { retry: false },
        },
      }),
  );

  useEffect(() => {
    void restoreSession();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 280,
          gestureEnabled: true,
        }}
      />
    </QueryClientProvider>
  );
}
