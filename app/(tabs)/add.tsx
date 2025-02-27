import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import CropModal from '../../components/CropModal';
import { router } from 'expo-router';
import { useVideoStore, VideoEntry } from '../../stores/useVideoStore';
import {  generateThumbnail } from '../../utils/videoProcessor';
import { useThemeStore, themeTemplates } from '../../stores/useThemeStore';
import { generateUUID } from '../../utils/helpers';
import { Ionicons } from '@expo/vector-icons';
import { useLanguageStore, translations } from '../../stores/useLanguageStore';


export default function AddScreen() {
  const { isDarkMode, template } = useThemeStore();
  const currentTheme = themeTemplates[template][isDarkMode ? 'dark' : 'light'];
  const { addVideo } = useVideoStore();
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { language } = useLanguageStore();
  const t = translations[language];

  const handleVideoSelect = async () => {
    try {
      const [mediaPermission, libraryPermission] = await Promise.all([
        ImagePicker.requestMediaLibraryPermissionsAsync(),
        MediaLibrary.requestPermissionsAsync()
      ]);

      if (!mediaPermission.granted || !libraryPermission.granted) {
        Alert.alert("Permission Required", "Please grant access to your media library");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedVideo(result.assets[0].uri);
        setShowCropModal(true);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to select video. Please try again.");
    }
  };

  const handleCropComplete = async (
    startTime: number, 
    endTime: number, 
    title: string, 
    description: string,
    categoryId: string
  ) => {
    if (!selectedVideo) return;

    try {
      setIsProcessing(true);

      // Generate thumbnail
      const thumbnailUri = await generateThumbnail(selectedVideo, startTime);
      
      // Calculate duration
      const duration = endTime - startTime;

      // Create new video entry
      const newVideo: VideoEntry = {
        id: generateUUID(),
        uri: selectedVideo,
        thumbnail: thumbnailUri,
        duration,
        title,
        description,
        startTime,
        endTime,
        categoryId,
        createdAt: new Date().toISOString(),
      };

      // Add video through store (which handles both store and database)
      await addVideo(newVideo);

      // Reset state
      setShowCropModal(false);
      setSelectedVideo(null);
      setIsProcessing(false);

      // Show success message and navigate
      Alert.alert(
        t.success,
        t.changesSaved,
        [
          {
            text: 'View Diary',
            onPress: () => router.push('/diary'),
          },
          {
            text: 'Add Another',
            onPress: () => setShowCropModal(false),
          },
        ]
      );
    } catch (error) {
      setIsProcessing(false);
      console.error('Error saving video:', error);
      Alert.alert(t.error, t.error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.bg }]}>
      <View style={styles.content}>
        <View style={[styles.illustration, { backgroundColor: currentTheme.card }]}>
          <Ionicons 
            name="videocam-outline" 
            size={80} 
            color={currentTheme.text} 
          />
        </View>
        
        <Text style={[styles.title, { color: currentTheme.text }]}>
          {t.createNewMemory}
        </Text>
        
        <Text style={styles.subtitle}>
          {t.selectVideoDescription}
        </Text>

        <TouchableOpacity
          style={[styles.selectButton, { backgroundColor: currentTheme.card }]}
          onPress={handleVideoSelect}
        >
          <Ionicons name="cloud-upload-outline" size={32} color={currentTheme.text} />
          <Text style={[styles.buttonText, { color: currentTheme.text }]}>
            {t.selectVideo}
          </Text>
          <Text style={styles.maxDuration}>
            {t.maxDuration}
          </Text>
        </TouchableOpacity>

        <View style={styles.tipsContainer}>
          <Text style={[styles.tipsTitle, { color: currentTheme.text }]}>
            {t.tips}
          </Text>
          <Text style={styles.tipText}>{t.tipWellLit}</Text>
          <Text style={styles.tipText}>{t.tipSteady}</Text>
          <Text style={styles.tipText}>{t.tipClear}</Text>
        </View>
      </View>

      {selectedVideo && (
        <CropModal
          isVisible={showCropModal}
          onClose={() => {
            setShowCropModal(false);
            setSelectedVideo(null);
          }}
          videoUri={selectedVideo}
          onCropComplete={handleCropComplete}
        />
      )}

      {isProcessing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={currentTheme.text} />
          <Text style={[styles.loadingText, { color: currentTheme.text }]}>
            {t.savingVideo}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  illustration: {
    width: 160,
    height: 160,
    borderRadius: 80,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  selectButton: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#8E8E93',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  maxDuration: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
  },
  tipsContainer: {
    alignSelf: 'stretch',
    marginTop: 40,
    padding: 20,
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
}); 