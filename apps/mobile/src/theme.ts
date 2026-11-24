import { Platform } from 'react-native';

export const theme = {
  colors: {
    brand: '#174B3A',
    brandDark: '#103A2D',
    brandLight: '#E8F1E8',
    background: '#F6F4EC',
    surface: '#FFFFFF',
    text: '#18271F',
    muted: '#68766C',
    border: '#E2E6DC',
    accent: '#C69A4A',
    accentLight: '#F6EEDC',
    input: '#FBFCF9',
    danger: '#A33B32',
    dangerBackground: '#FFF4F1',
    white: '#FFFFFF',
  },
  radius: { card: 28, input: 15, button: 16, pill: 999 },
  fonts: {
    family: Platform.select({ ios: 'System', android: 'sans-serif', default: 'Arial' }) ?? 'Arial',
  },
} as const;
