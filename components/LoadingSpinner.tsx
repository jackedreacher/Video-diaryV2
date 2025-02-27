import { ActivityIndicator, View } from 'react-native';
import { useThemeStore } from '../stores/useThemeStore';

export const LoadingSpinner = () => {
  const { isDarkMode } = useThemeStore();
  
  return (
    <View className="flex-1 justify-center items-center">
      <ActivityIndicator size="large" color={isDarkMode ? '#FFFFFF' : '#000000'} />
    </View>
  );
}; 