import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Design tokens for the Traveler Guide app. A single source of truth for
 * colour, spacing, radius, type and elevation so every screen reads as one
 * system. Kept intentionally small and flat for fast lookups.
 */

export const colors = {
  // Surfaces
  bg: '#F5F6FB',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F2FA',
  overlay: 'rgba(16, 20, 55, 0.45)',

  // Text
  text: '#151B3B',
  textDim: '#7A85A8',
  textFaint: '#AAB2CC',
  onPrimary: '#FFFFFF',

  // Brand (violet — matches the admin portal)
  primary: '#6C4DFF',
  primaryDark: '#4E2FE0',
  primarySoft: '#EEE9FF',
  primarySoftText: '#5A34E8',

  // Accents
  accent: '#FF7A59', // warm coral for highlights / CTAs
  accentSoft: '#FFE7DF',
  teal: '#12C7B4',
  tealSoft: '#DAF7F3',
  star: '#FFB020',

  // Status
  success: '#12B76A',
  successSoft: '#E4F7EE',
  danger: '#F0435C',
  dangerSoft: '#FDE7EA',
  warning: '#F5A524',
  info: '#3E7BFF',

  // Lines
  border: '#E9EDF7',
  borderStrong: '#DCE2F0',
} as const;

export const gradients = {
  brand: ['#8A63FF', '#5A2EE6'] as const,
  brandBright: ['#9E82FF', '#6C4DFF'] as const,
  candy: ['#A85CFF', '#FF5FA2'] as const, // violet → pink, high-energy accent
  sunset: ['#FFB65C', '#FF5E7E'] as const,
  ocean: ['#3E9BFF', '#12C7B4'] as const,
  aurora: ['#5A2EE6', '#12C7B4'] as const,
  night: ['#2B2F63', '#141833'] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

export const font = {
  // React Native maps the system font when family is undefined; keep weights.
  h1: { fontSize: 30, lineHeight: 36, fontWeight: '800' } as TextStyle,
  h2: { fontSize: 24, lineHeight: 30, fontWeight: '800' } as TextStyle,
  h3: { fontSize: 20, lineHeight: 26, fontWeight: '700' } as TextStyle,
  title: { fontSize: 17, lineHeight: 23, fontWeight: '700' } as TextStyle,
  body: { fontSize: 15, lineHeight: 22, fontWeight: '500' } as TextStyle,
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '700' } as TextStyle,
  small: { fontSize: 13, lineHeight: 18, fontWeight: '500' } as TextStyle,
  caption: { fontSize: 11, lineHeight: 15, fontWeight: '700' } as TextStyle,
} as const;

/** Soft, layered shadows. iOS uses shadow*, Android uses elevation. */
export const shadow = {
  card:
    Platform.select({
      ios: {
        shadowColor: '#5B6B99',
        shadowOpacity: 0.14,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 12 },
      },
      android: { elevation: 4 },
    }) ?? {},
  soft:
    Platform.select({
      ios: {
        shadowColor: '#5B6B99',
        shadowOpacity: 0.1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 2 },
    }) ?? {},
  lifted:
    Platform.select({
      ios: {
        shadowColor: '#3A2E7A',
        shadowOpacity: 0.28,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 14 },
      },
      android: { elevation: 8 },
    }) ?? {},
} as Record<'card' | 'soft' | 'lifted', ViewStyle>;

export type GradientName = keyof typeof gradients;
