import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type ThemeColor = 'blue' | 'purple' | 'green' | 'orange';
export type ThemeTemplate = 'default' | 'minimal' | 'pink' | 'classic';

// Organize theme colors by purpose
export interface ThemeColors {
  // Base colors
  bg: string;
  card: string;
  text: string;
  border: string;
  
  // Text variants
  textSecondary: string;
  textTertiary: string;
  
  // System
  statusBar: 'light-content' | 'dark-content';
}

interface ThemeState {
  isDarkMode: boolean;
  accentColor: ThemeColor;
  template: ThemeTemplate;
  setDarkMode: (isDark: boolean) => void;
  setAccentColor: (color: ThemeColor) => void;
  setTemplate: (template: ThemeTemplate) => void;
}

export const themeColors: Record<ThemeColor, { primary: string; secondary: string }> = {
  blue: {
    primary: '#0A84FF',
    secondary: '#5856D6',
  },
  purple: {
    primary: '#BF5AF2',
    secondary: '#D365FF',
  },
  green: {
    primary: '#32D74B',
    secondary: '#30D158',
  },
  orange: {
    primary: '#FF9F0A',
    secondary: '#FFB340',
  },
};

export const themeTemplates: Record<ThemeTemplate, {
  dark: ThemeColors;
  light: ThemeColors;
}> = {
  default: {
    dark: { 
      bg: '#1c1c1e', 
      card: '#2c2c2e', 
      text: '#FFFFFF',
      border: '#404040',
      textSecondary: '#A1A1A1',
      textTertiary: '#808080',
      statusBar: 'light-content'
    },
    light: { 
      bg: '#F2F2F7', 
      card: '#FFFFFF', 
      text: '#000000',
      border: '#E5E5E5',
      textSecondary: '#666666',
      textTertiary: '#999999',
      statusBar: 'dark-content'
    },
  },
  minimal: {
    dark: { 
      bg: '#000000', 
      card: '#1c1c1e', 
      text: '#FFFFFF',
      border: '#333333',
      textSecondary: '#A1A1A1',
      textTertiary: '#808080',
      statusBar: 'light-content'
    },
    light: { 
      bg: '#FFFFFF', 
      card: '#F2F2F7', 
      text: '#000000',
      border: '#E0E0E0',
      textSecondary: '#666666',
      textTertiary: '#999999',
      statusBar: 'dark-content'
    },
  },
  pink: {
    dark: { 
      bg: '#1a1a1a', 
      card: '#2d2d2d', 
      text: '#FFFFFF',
      border: '#3d3d3d',
      textSecondary: '#A1A1A1',
      textTertiary: '#808080',
      statusBar: 'light-content'
    },
    light: { 
      bg: '#FFF0F5', 
      card: '#FFFFFF', 
      text: '#1a1a1a',
      border: '#FFE4E1',
      textSecondary: '#666666',
      textTertiary: '#999999',
      statusBar: 'dark-content'
    },
  },
  classic: {
    dark: { 
      bg: '#2c3e50', 
      card: '#34495e', 
      text: '#FFFFFF',
      border: '#465669',
      textSecondary: '#A1A1A1',
      textTertiary: '#808080',
      statusBar: 'light-content'
    },
    light: { 
      bg: '#ecf0f1', 
      card: '#FFFFFF', 
      text: '#2c3e50',
      border: '#BDC3C7',
      textSecondary: '#666666',
      textTertiary: '#999999',
      statusBar: 'dark-content'
    },
  },
};

// Helper to get initial state based on system theme
const getInitialState = () => {
  if (Platform.OS === 'ios') {
    return {
      isDarkMode: true,
      accentColor: 'blue' as ThemeColor,
      template: 'default' as ThemeTemplate,
    };
  }
  return {
    isDarkMode: true,
    accentColor: 'blue' as ThemeColor,
    template: 'default' as ThemeTemplate,
  };
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      ...getInitialState(),
      setDarkMode: (isDark) => set({ isDarkMode: isDark }),
      setAccentColor: (color) => set({ accentColor: color }),
      setTemplate: (template) => set({ template: template }),
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isDarkMode: state.isDarkMode,
        accentColor: state.accentColor,
        template: state.template,
      }),
    }
  )
); 