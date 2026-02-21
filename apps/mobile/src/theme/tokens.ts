export const colors = {
  // Brew — Backgrounds & Surfaces
  brewDark: '#1C1410',
  brewRich: '#2A1F17',
  brewMedium: '#3D2E23',
  brewSurface: '#4A382B',
  brewMuted: '#6B5444',

  // Crema — Text & Highlights
  cremaLight: '#F5E6D3',
  crema: '#E8D5BC',
  cremaDark: '#C4A882',

  // Claude — Accent & Actions
  claudeAmber: '#D4943A',
  claudeGold: '#E8AA4A',
  claudeLight: '#F0C87A',

  // Status
  connected: '#6BBF6A',
  waiting: '#D4943A',
  working: '#5BA4D9',
  offline: '#C75B4A',

  // Terminal
  terminalMuted: '#8A7460',
  terminalSuccess: '#6BBF6A',
  terminalInfo: '#5BA4D9',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 100,
} as const;

export const typography = {
  fraunces: {
    bold: 'Fraunces_700Bold',
    semibold: 'Fraunces_600SemiBold',
    italic: 'Fraunces_400Regular_Italic',
  },
  dmSans: {
    semibold: 'DMSans_600SemiBold',
    regular: 'DMSans_400Regular',
    light: 'DMSans_300Light',
  },
  jetbrainsMono: {
    medium: 'JetBrainsMono_500Medium',
    regular: 'JetBrainsMono_400Regular',
  },
} as const;
