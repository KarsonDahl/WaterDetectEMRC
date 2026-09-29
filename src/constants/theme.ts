/**
 * App colors for light and dark mode. Light mode is the field default — it
 * reads best in direct sun — but dark mode follows the phone setting.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0B0B0B',
    background: '#FFFFFF',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#52514E',
    border: '#D4D4D8',
    tint: '#1F63B4',
    onTint: '#FFFFFF',
    danger: '#B42323',
    warningText: '#7A4B00',
    warningBackground: '#FFF3D6',
    errorBackground: '#FDE7E7',
    // Chart roles (see the dataviz reference palette).
    chartSeries: '#2A78D6',
    chartDraft: '#EB6834',
    chartGrid: '#E1E0D9',
    chartAxis: '#C3C2B7',
    chartMuted: '#6E6C66',
  },
  dark: {
    text: '#FFFFFF',
    background: '#000000',
    backgroundElement: '#1C1D20',
    backgroundSelected: '#2E3135',
    textSecondary: '#C3C2B7',
    border: '#3A3D42',
    tint: '#4D9BF0',
    onTint: '#00152E',
    danger: '#FF7A7A',
    warningText: '#FFD27A',
    warningBackground: '#3A2C0C',
    errorBackground: '#401616',
    chartSeries: '#3987E5',
    chartDraft: '#D95926',
    chartGrid: '#2C2C2A',
    chartAxis: '#383835',
    chartMuted: '#A3A19A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    mono: "ui-monospace, Menlo, Consolas, 'Liberation Mono', monospace",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Minimum touch target — generous for field use, possibly with gloves. */
export const TouchTarget = 52;
export const Radius = 10;
export const MaxContentWidth = 720;
