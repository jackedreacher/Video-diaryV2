import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useLanguageStore, translations } from '../../stores/useLanguageStore';

export default function VideoDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { language } = useLanguageStore();
  const t = translations[language];

  // Mock data - will be replaced with store data
  const video = {
    id,
    title: "Carmen's first step",
    date: 'October 5, 2023',
    duration: '5s',
    url: 'https://example.com/video.mp4',
  };

  return (
    <View className="flex-1 bg-[#1c1c1e]">
      {/* Header */}
      <View className="flex-row items-center p-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-medium ml-4">
          {t.videoDetails}
        </Text>
      </View>

      {/* Video Player */}
      <View className="w-full bg-[#2c2c2e]">
        <Video
          source={{ uri: video.url }}
          useNativeControls
          style={{ width: '100%', aspectRatio: 16/9 }}
          resizeMode={ResizeMode.CONTAIN}
          videoStyle={{ backgroundColor: 'black' }}
        />
      </View>

      {/* Video Info */}
      <ScrollView className="flex-1 p-4">
        <Text className="text-white text-2xl font-medium">{video.title}</Text>
        <View className="flex-row items-center mt-2">
          <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
          <Text className="text-[#8E8E93] ml-2">{video.date}</Text>
          <Ionicons name="time-outline" size={16} color="#8E8E93" className="ml-4" />
          <Text className="text-[#8E8E93] ml-2">{video.duration}</Text>
        </View>
      </ScrollView>

      {/* Actions */}
      <View className="flex-row justify-around p-4 border-t border-[#2c2c2e]">
        <TouchableOpacity className="flex-row items-center">
          <Ionicons name="share-outline" size={24} color="#0A84FF" />
          <Text className="text-[#0A84FF] ml-2">{t.share}</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-row items-center">
          <Ionicons name="trash-outline" size={24} color="#FF453A" />
          <Text className="text-[#FF453A] ml-2">{t.deleteVideo}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
} 