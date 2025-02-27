export const themeColors = {
  blue: {
    primary: '#007AFF',
    secondary: '#5856D6',
    background: '#F2F2F7'
  },
  purple: {
    primary: '#5856D6',
    secondary: '#007AFF',
    background: '#F2F2F7'
  },
  pink: {
    primary: '#FF2D55',
    secondary: '#FF9500',
    background: '#F2F2F7'
  },
  orange: {
    primary: '#FF9500',
    secondary: '#FF2D55',
    background: '#F2F2F7'
  },
  green: {
    primary: '#34C759',
    secondary: '#30B0C7',
    background: '#F2F2F7'
  }
} as const;

export type ThemeColorKey = keyof typeof themeColors; 