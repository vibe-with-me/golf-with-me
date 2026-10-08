import { useColorScheme } from 'react-native';

/**
 * Design tokens — the mobile mirror of apps/web/src/styles/tokens.css.
 * Same dormant-seam logic: V2 theming is a token swap, not a redesign.
 * Near-monochrome warm neutrals with EXACTLY ONE vivid accent, reserved
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
  bg: '#f6f3ee',
  surface: '#fffdf9',
  border: 'rgba(28, 25, 22, 0.09)',
  borderInput: 'rgba(28, 25, 22, 0.46)',
  ink: '#1c1916',
  inkMuted: '#6f6a62',
  accent: '#c2410c',
  accentInk: '#ffffff',
};

const dark: Tokens = {
  bg: '#161412',
  surface: '#211e1b',
  border: 'rgba(240, 236, 229, 0.1)',
  borderInput: 'rgba(240, 236, 229, 0.5)',
  ink: '#f0ece5',
  inkMuted: '#a39c91',
  accent: '#ff6a3d',
  accentInk: '#211008',
};

export function useTokens(): Tokens {
  return useColorScheme() === 'dark' ? dark : light;
}

export const fonts = {
  display: 'SpaceGrotesk_600SemiBold',
  displayMedium: 'SpaceGrotesk_500Medium',
  body: 'Inter_400Regular',
  bodySemiBold: 'Inter_600SemiBold',
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
