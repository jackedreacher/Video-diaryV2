import { View, Text, TouchableOpacity } from 'react-native';
import { useThemeStore, themeTemplates, themeColors } from '../stores/useThemeStore';
import { Ionicons } from '@expo/vector-icons';

interface ErrorMessageProps {
  message: string;
  onRetry: () => void;
}

export const ErrorMessage = ({ message, onRetry }: ErrorMessageProps) => {
  const { isDarkMode, template, accentColor } = useThemeStore();
  const currentTheme = themeTemplates[template][isDarkMode ? 'dark' : 'light'];

  return (
    <View className="flex-1 justify-center items-center p-4">
      <Ionicons 
        name="alert-circle" 
        size={48} 
        color={themeColors[accentColor].primary} 
      />
      <Text 
        style={{ color: currentTheme.text }}
        className="text-lg text-center mt-4"
      >
        {message}
      </Text>
      <TouchableOpacity
        onPress={onRetry}
        className="mt-4 p-3 rounded-lg"
        style={{ backgroundColor: themeColors[accentColor].primary }}
      >
        <Text style={{ color: '#FFFFFF' }}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}; 