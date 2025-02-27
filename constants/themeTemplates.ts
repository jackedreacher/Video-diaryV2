export const themeTemplates = {
  default: {
    light: {
      bg: '#FFFFFF',
      text: '#000000',
      card: '#F2F2F7',
      border: '#E5E5EA',
    },
    dark: {
      bg: '#000000',
      text: '#FFFFFF',
      card: '#1C1C1E',
      border: '#38383A',
    }
  }
} as const;

export type ThemeTemplate = keyof typeof themeTemplates; 