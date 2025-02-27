import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useThemeStore } from '../stores/useThemeStore';
import { StatusBar, SafeAreaView } from 'react-native';
import { useEffect } from 'react';
import { DatabaseService } from '../services/database';
import { useVideoStore } from '../stores/useVideoStore';
import { PortalProvider } from '@gorhom/portal';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60, // 1 hour
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  const { isDarkMode } = useThemeStore();
  const loadVideos = useVideoStore(state => state.loadVideos);

  useEffect(() => {
    const initDatabase = async () => {
      try {
        await DatabaseService.setup();
        await loadVideos();
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };

    initDatabase();
  }, []);

  // Set status bar style
  StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content', true);

  return (
    <QueryClientProvider client={queryClient}>
      <PortalProvider>
        <SafeAreaView style={{ flex: 1 }}>
          <StatusBar />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              presentation: 'card',
              contentStyle: {
                backgroundColor: 'transparent',
              },
            }}
          >
            <Stack.Screen
              name="(tabs)"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="video/[id]"
              options={{
                headerShown: false,
                presentation: 'modal',
              }}
            />
          </Stack>
        </SafeAreaView>
      </PortalProvider>
    </QueryClientProvider>
  );
} 