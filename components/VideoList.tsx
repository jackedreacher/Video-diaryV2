import { ScrollView, TouchableOpacity, View, Text } from 'react-native';
import { useThemeStore, themeTemplates } from '../stores/useThemeStore';
import { Ionicons } from '@expo/vector-icons';
import { VideoEntry } from '../stores/useVideoStore';

interface VideoListProps {
  videos: VideoEntry[];
  onVideoPress: (videoId: string) => void;
}

export const VideoList = ({ videos, onVideoPress }: VideoListProps) => {
  const { isDarkMode, template } = useThemeStore();
  const currentTheme = themeTemplates[template][isDarkMode ? 'dark' : 'light'];

  if (videos.length === 0) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Ionicons name="videocam-outline" size={48} color={currentTheme.text} />
        <Text 
          style={{ color: currentTheme.text }}
          className="text-lg text-center mt-4"
        >
          No videos yet. Start recording!
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 px-4">
      {videos.map(video => (
        <TouchableOpacity
          key={video.id}
          style={{ backgroundColor: currentTheme.card }}
          className="flex-row items-center p-4 mb-2 rounded-lg"
          onPress={() => onVideoPress(video.id)}
        >
          <View 
            style={{ backgroundColor: currentTheme.bg }} 
            className="w-12 h-12 rounded-lg items-center justify-center mr-4"
          >
            <Ionicons name="play" size={20} color={currentTheme.text} />
          </View>
          <View>
            <Text style={{ color: currentTheme.text }} className="text-lg">
              {video.title}
            </Text>
            <Text style={{ color: '#8E8E93' }} className="mt-1">
              {new Date(video.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}; 