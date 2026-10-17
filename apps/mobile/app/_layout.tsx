import {
  Caveat_500Medium,
  Caveat_600SemiBold,
  Caveat_700Bold,
  useFonts,
} from '@expo-google-fonts/caveat';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';
import { Feather } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useSession } from '../lib/use-session';
import { useTokens } from '../lib/tokens';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const t = useTokens();
  const { session, loading } = useSession();
  const [fontsLoaded] = useFonts({
    ...Feather.font,
    Caveat_500Medium,
    Caveat_600SemiBold,
    Caveat_700Bold,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
  });

  const ready = fontsLoaded && !loading;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        {/* Always-available anchor: redirects by session (see index.tsx). */}
        <Stack.Screen name="index" />
        {/* Public — the resolver is the product and works signed out. */}
        <Stack.Screen name="t/[uid]" />
        <Stack.Screen name="scan" />
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="gathering/[id]" />
          <Stack.Screen name="claim/[uid]" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
