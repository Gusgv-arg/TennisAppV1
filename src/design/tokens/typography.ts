import { Platform, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const isMobile = width < 768;
const scale = isMobile ? 1.15 : 1.0; // Incremento del 15% para modo celular

export const typography = {
  family: {
    sans: Platform.select({
      ios: 'System',
      android: 'sans-serif',
      default: 'System',
    }),
    mono: Platform.select({
      ios: 'Courier',
      android: 'monospace',
      default: 'monospace',
    }),
  },
  size: {
    xs: Math.round(12 * scale),
    sm: Math.round(14 * scale),
    md: Math.round(16 * scale),
    lg: Math.round(20 * scale),
    xl: Math.round(24 * scale),
    xxl: Math.round(32 * scale),
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  variants: {
    h1: {
      fontSize: Math.round(32 * scale),
      fontWeight: '700' as const,
      lineHeight: Math.round(38 * scale),
    },
    h2: {
      fontSize: Math.round(24 * scale),
      fontWeight: '700' as const,
      lineHeight: Math.round(28 * scale),
    },
    h3: {
      fontSize: Math.round(20 * scale),
      fontWeight: '700' as const,
      lineHeight: Math.round(24 * scale),
    },
    bodyLarge: {
      fontSize: Math.round(16 * scale),
      fontWeight: '400' as const,
      lineHeight: Math.round(24 * scale),
    },
    bodyMedium: {
      fontSize: Math.round(14 * scale),
      fontWeight: '400' as const,
      lineHeight: Math.round(20 * scale),
    },
    bodySmall: {
      fontSize: Math.round(12 * scale),
      fontWeight: '400' as const,
      lineHeight: Math.round(18 * scale),
    },
    label: {
      fontSize: Math.round(14 * scale),
      fontWeight: '600' as const,
      lineHeight: Math.round(20 * scale),
    },
    labelSmall: {
      fontSize: Math.round(12 * scale),
      fontWeight: '600' as const,
      lineHeight: Math.round(16 * scale),
    }
  }
};

