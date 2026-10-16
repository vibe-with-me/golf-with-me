import { useColorScheme } from 'react-native';

/**
 * Design tokens — the mobile mirror of apps/web/src/styles/tokens.css.
 * Same dormant-seam logic: V2 theming is a token swap, not a redesign.
 * Near-monochrome scorecard neutrals (graphite on card stock) with EXACTLY ONE vivid accent, reserved
 * for the handshake pair (Connect and Accept).
 */
export interface Tokens {
  bg: string;
  surface: string;
  border: string;
  borderInput: string;
  ink: string;
  inkMuted: string;
  accent: string;
  accentInk: string;
}

const light: Tokens = {
  bg: '#eeebe1',
  surface: '#fdfcf7',
  border: 'rgba(38, 38, 42, 0.1)',
  borderInput: 'rgba(38, 38, 42, 0.5)',
  ink: '#26262a',
  inkMuted: '#63625d',
  accent: '#c42a1f',
  accentInk: '#ffffff',
};

const dark: Tokens = {
  bg: '#131314',
  surface: '#222224',
  border: 'rgba(236, 234, 226, 0.1)',
  borderInput: 'rgba(236, 234, 226, 0.5)',
  ink: '#eceae2',
  inkMuted: '#a3a199',
  accent: '#ff6b5b',
  accentInk: '#2b0703',
};

export function useTokens(): Tokens {
  return useColorScheme() === 'dark' ? dark : light;
}

/**
 * Elevation — the mirror of --shadow-card and --shadow-bar in tokens.css,
 * as React Native shadow props. Cards have no border; the shadow and the
 * bg/surface step do the work. The bar has no shadow in dark (it vanishes
 * on a dark ground) and keeps a hairline instead.
 */
export interface Shadow {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
}

export const shadow = {
  card: {
    light: {
      shadowColor: '#26262a',
      shadowOpacity: 0.16,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
    dark: {
      shadowColor: '#000000',
      shadowOpacity: 0.55,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
  },
  bar: {
    light: {
      shadowColor: '#26262a',
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: -6 },
      elevation: 8,
    },
    dark: null,
  },
} as const satisfies { card: Record<'light' | 'dark', Shadow>; bar: Record<'light' | 'dark', Shadow | null> };

export function useShadow(): { card: Shadow; bar: Shadow | null } {
  const isDark = useColorScheme() === 'dark';
  return isDark
    ? { card: shadow.card.dark, bar: shadow.bar.dark }
    : { card: shadow.card.light, bar: shadow.bar.light };
}

export const fonts = {
  display: 'Caveat_600SemiBold',
  displayMedium: 'Caveat_500Medium',
  displayBold: 'Caveat_700Bold',
  wordmark: 'Caveat_700Bold',
  body: 'IBMPlexSans_400Regular',
  bodyMedium: 'IBMPlexSans_500Medium',
  bodySemiBold: 'IBMPlexSans_600SemiBold',
} as const;

export const radius = {
  card: 24,
  control: 14,
  pill: 999,
} as const;

export const space = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 24,
  s6: 32,
  s7: 48,
} as const;

/** Minimum tap target (pt). Taps happen outdoors and at night events. */
export const TAP_TARGET = 44;

/** Mirror of --shell-nav-height in tokens.css. The tab bar keeps React Navigation's default height. */
export const SHELL = { headerHeight: 56 } as const;

/**
 * Display sizes: the mobile mirror of --text-title and --text-lg in tokens.css,
 * which only display text uses (names, titles, section headers, the header
 * wordmark). The display face (Caveat) sets small, so both run larger than a
 * grotesk would need.
 */
export const displaySize = { title: 38, section: 24, wordmark: 24 } as const;
