import { Feather } from '@expo/vector-icons';
import { isProfileComplete } from '@withme/contract';
import { router, Tabs, usePathname } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useEffect, useRef, type ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { Header } from '../../components/Header';
import { TabBar } from '../../components/TabBar';
import { api } from '../../lib/api';
import { useSession } from '../../lib/use-session';
import { useTokens } from '../../lib/tokens';

type FeatherName = ComponentProps<typeof Feather>['name'];

// Dormant without a store URL: hidden from the bar and unreachable. A
// development build shows it anyway, as a setup card (see merch.tsx), so a
// forker meets it while running the demo; a release build never does.
const STORE_URL = process.env.EXPO_PUBLIC_STORE_URL;

function icon(name: FeatherName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Feather name={name} color={color} size={size} />
  );
}

// Module scope, not inside TabsLayout: react/no-unstable-nested-components.
function header() {
  return <Header />;
}

function tabBar(props: BottomTabBarProps) {
  return <TabBar {...props} />;
}

/**
 * The signed-in tabs. Adding a top-level section = one Tabs.Screen here plus
 * a file in this folder (docs/the-slice.md step 6). Detail screens stay in
 * app/ as stack screens so they push over the bar, as the share button's
 * screen does.
 */
export default function TabsLayout() {
  const t = useTokens();
  // The completion gate (web's is ShellRoute in routes/_app.tsx): once per
  // signed-in account, on entering the tabs. A UX gate, never a boundary.
  const { session } = useSession();
  const userId = session?.user.id;
  // Like web's `pathname !== '/profile'`: navigating to the screen you are on
  // replaces its params and would drop `redirect`. A ref, so the async check
  // reads the current path.
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  // A failed check never locks anyone out: the screens' own states handle errors.
  useEffect(() => {
    if (!userId) return;
    let live = true;
    api.app.profile
      .get()
      .then(({ profile }) => {
        if (live && !isProfileComplete(profile) && pathRef.current !== '/profile') {
          router.navigate('/profile');
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [userId]);
  return (
    <Tabs
      // The bar draws the tabs from these options and raises the share button
      // out of its middle (components/TabBar.tsx).
      tabBar={tabBar}
      screenOptions={{
        header,
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="rounds" options={{ title: 'Rounds', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="connections" options={{ title: 'Connections', tabBarIcon: icon('users') }} />
      <Tabs.Screen
        name="merch"
        options={{ title: 'Merch', href: STORE_URL || __DEV__ ? undefined : null, tabBarIcon: icon('shopping-bag') }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('user') }} />
    </Tabs>
  );
}
