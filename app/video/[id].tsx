import { View, Text, StyleSheet, Image, Dimensions, TouchableOpacity, Platform, TextInput, Modal, ActivityIndicator, TouchableWithoutFeedback, Keyboard, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Video as ExpoVideo, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useVideoStore } from '../../stores/useVideoStore';
import { useThemeStore, ThemeColors, themeTemplates } from '../../stores/useThemeStore';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  FadeIn, 
  SlideInRight,
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated';
import { useState, useRef, useCallback, useEffect } from 'react';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import { DatabaseService } from '../../services/database';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { VideoPlayer } from '../../components/VideoPlayer';

const { width, height } = Dimensions.get('window');
const HEADER_HEIGHT = 250;

// Add type for video ref
type VideoRef = ExpoVideo | null;

// Add these types at the top
interface VideoError {
  type: 'PLAYBACK' | 'LOADING' | 'NETWORK' | 'CONTROLS' | 'GENERAL';
  message: string;
  timestamp: number;
  retryable: boolean;
}

interface EditableFields {
  title: string;
  description: string;
  categoryId: string;
  createdAt: string;
}

interface DatabaseCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface Category {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export default function VideoScreen() {
  const { id } = useLocalSearchParams();
  const { videos, updateVideo } = useVideoStore();
  const { isDarkMode, template, accentColor } = useThemeStore();
  const theme = themeTemplates[template][isDarkMode ? 'dark' : 'light'];
  const scrollY = useSharedValue(0);

  // State management
  const [isPlaying, setIsPlaying] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editableFields, setEditableFields] = useState<EditableFields>({
    title: '',
    description: '',
    categoryId: '',
    createdAt: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const videoRef = useRef<VideoRef>(null);
  const video = videos.find(v => v.id === id);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Load categories when component mounts
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await DatabaseService.getCategories() as DatabaseCategory[];
        if (Array.isArray(cats)) {
          setCategories(cats.map(cat => ({
            ...cat,
            icon: (cat.icon || 'bookmark') as keyof typeof Ionicons.glyphMap
          })));
        }
      } catch (error) {
        console.error('Failed to load categories:', error);
      }
    };
    loadCategories();
  }, []);

  // Initialize editable fields when video loads
  useEffect(() => {
    if (video) {
      setEditableFields({
        title: video.title,
        description: video.description || '',
        categoryId: video.categoryId || 'all',
        createdAt: video.createdAt
      });
    }
  }, [video]);

  const handleSaveEdit = async () => {
    if (!video) return;

    try {
      setIsEditing(true);
      await DatabaseService.updateVideo(video.id, editableFields);
      await updateVideo(video.id, editableFields);
      setShowEditModal(false);
    } catch (error) {
      console.error('Failed to update video:', error);
    } finally {
      setIsEditing(false);
    }
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setEditableFields(prev => ({
        ...prev,
        createdAt: selectedDate.toISOString()
      }));
    }
  };

  // Simple styles
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    paperTexture: {
      position: 'absolute',
      width: '100%',
      height: '100%',
    },
    decorativeTape: {
      position: 'absolute',
      top: 40,
      left: -20,
      width: 80,
      height: 30,
      backgroundColor: '#FFD3B6',
      transform: [{ rotate: '-45deg' }],
      opacity: 0.7,
    },
    decorativeTapeRight: {
      position: 'absolute',
      top: 60,
      right: -20,
      width: 80,
      height: 30,
      backgroundColor: '#B6FFD3',
      transform: [{ rotate: '45deg' }],
      opacity: 0.7,
    },
    header: {
      height: 60,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      zIndex: 100,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    headerContent: {
      flex: 1,
      alignItems: 'center',
    },
    headerDate: {
      fontFamily: 'Noteworthy',
      fontSize: 18,
      color: theme.text,
    },
    scrollContainer: {
      flex: 1,
    },
    videoSection: {
      marginTop: 20,
      paddingHorizontal: 20,
    },
    videoWrapper: {
      borderRadius: 15,
      overflow: 'hidden',
      backgroundColor: '#000',
      aspectRatio: 16/9,
      width: '100%',
      position: 'relative',
    },
    video: {
      flex: 1,
      width: '100%',
      height: '100%',
    },
    contentSection: {
      padding: 20,
    },
    titleSection: {
      marginBottom: 20,
    },
    title: {
      fontSize: 32,
      fontFamily: 'Noteworthy-Bold',
      textAlign: 'center',
      letterSpacing: 0.5,
      color: theme.text,
      ...Platform.select({
        ios: {
          textShadowColor: 'rgba(0,0,0,0.1)',
          textShadowOffset: { width: 1, height: 1 },
          textShadowRadius: 1,
        },
        android: {
          elevation: 1,
        },
      }),
    },
    titleUnderline: {
      height: 2,
      backgroundColor: '#FFD3B6',
      width: '50%',
      alignSelf: 'center',
      marginTop: 10,
    },
    dateSection: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 30,
    },
    dateLine: {
      flex: 1,
      height: 1,
      backgroundColor: '#E0E0E0',
    },
    date: {
      fontFamily: 'Noteworthy-Bold',
      fontSize: 14,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: theme.text,
      marginHorizontal: 10,
    },
    descriptionContainer: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: 15,
      padding: 20,
      marginBottom: 30,
    },
    marginLine: {
      position: 'absolute',
      left: 15,
      top: 0,
      bottom: 0,
      width: 2,
      backgroundColor: '#FF9999',
    },
    descriptionContent: {
      paddingLeft: 30,
    },
    description: {
      fontSize: 18,
      fontFamily: 'Noteworthy',
      lineHeight: 32,
      letterSpacing: 0.3,
      textAlign: 'justify',
      color: theme.text,
    },
    notebookLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      marginTop: 32,
    },
    paperClip: {
      position: 'absolute',
      top: -10,
      right: 20,
      width: 30,
      height: 60,
      borderWidth: 3,
      borderColor: '#B6B6B6',
      borderRadius: 5,
      transform: [{ rotate: '45deg' }],
    },
    editButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 'auto',
      marginRight: 20,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      width: '100%',
      maxWidth: 500,
      borderRadius: 16,
      padding: 20,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 24,
      fontFamily: 'Noteworthy-Bold',
    },
    closeButton: {
      padding: 4,
    },
    inputContainer: {
      gap: 12,
    },
    inputLabel: {
      fontSize: 16,
      fontFamily: 'Noteworthy',
      marginBottom: 4,
    },
    input: {
      width: '100%',
      height: 48,
      borderRadius: 8,
      paddingHorizontal: 16,
      fontSize: 16,
      fontFamily: 'Noteworthy',
    },
    textArea: {
      width: '100%',
      height: 120,
      borderRadius: 8,
      padding: 16,
      fontSize: 16,
      fontFamily: 'Noteworthy',
    },
    modalFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 20,
    },
    cancelButton: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      borderWidth: 1,
    },
    saveButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      fontSize: 16,
      fontFamily: 'Noteworthy',
    },
    saveButtonText: {
      fontSize: 16,
      fontFamily: 'Noteworthy',
      color: '#FFF',
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    categoryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 20,
      borderWidth: 1,
      gap: 4,
    },
    categoryIcon: {
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryText: {
      fontSize: 14,
      fontFamily: 'Noteworthy',
    },
    datePickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      marginTop: 8,
      gap: 8,
    },
    playPauseOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.3)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    playPauseOverlayPlaying: {
      backgroundColor: 'transparent',
      opacity: 0,
    },
    playButtonContainer: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'white',
    },
    playIcon: {
      marginLeft: 4, // Slight offset to center the play icon visually
    },
  });

  // Simple play/pause handler
  const handlePlayPause = async () => {
    if (!videoRef.current) return;
    
    try {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Play/Pause error:', error);
      Alert.alert('Error', 'Failed to play/pause video. Please try again.');
    }
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.value,
      [-100, 0],
      [1.5, 1],
      'clamp'
    );
    const opacity = interpolate(
      scrollY.value,
      [0, HEADER_HEIGHT / 2],
      [1, 0.3],
      'clamp'
    );
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  if (!video) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      {/* Decorative Elements */}
      <Image
        source={require('../../assets/paper-texture.png')}
        style={[styles.paperTexture, { opacity: isDarkMode ? 0.05 : 0.1 }]}
        resizeMode="repeat"
      />
      <View style={styles.decorativeTape} />
      <View style={styles.decorativeTapeRight} />

      {/* Animated Header */}
      <Animated.View style={[styles.header, headerStyle]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerDate}>
            {new Date(video.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            })}
          </Text>
        </View>
        <TouchableOpacity 
          style={[styles.editButton, { backgroundColor: theme.card }]}
          onPress={() => setShowEditModal(true)}
        >
          <Ionicons name="pencil" size={24} color={theme.text} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView 
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Video Player */}
        <View style={styles.videoSection}>
          {video && (
            <View style={styles.videoWrapper}>
              <VideoPlayer
                videoId={video.id}
                uri={video.uri}
                style={styles.video}
                showControls={false}
                resizeMode={ResizeMode.COVER}
                onError={(error) => {
                  console.error('Video playback error:', error);
                  Alert.alert('Error', 'Failed to play video. Please try again.');
                }}
                autoPlay={false}
                ref={videoRef}
                onPlaybackStatusUpdate={(status) => {
                  if (!status.isLoaded) return;
                  setIsPlaying(status.isPlaying);
                }}
              />
              <TouchableOpacity 
                style={[
                  styles.playPauseOverlay,
                  isPlaying && styles.playPauseOverlayPlaying
                ]}
                onPress={handlePlayPause}
                activeOpacity={0.8}
              >
                <View style={styles.playButtonContainer}>
                  <Ionicons 
                    name={isPlaying ? "pause" : "play"} 
                    size={40} 
                    color="white" 
                    style={styles.playIcon}
                  />
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Animated Content */}
        <Animated.View 
          style={styles.contentSection}
          entering={SlideInRight.duration(1000).springify()}
        >
          {/* Title Section */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>{video.title}</Text>
            <View style={styles.titleUnderline} />
          </View>

          {/* Date with Decorative Elements */}
          <View style={styles.dateSection}>
            <View style={styles.dateLine} />
            <Text style={styles.date}>
              {new Date(video.createdAt).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Text>
            <View style={styles.dateLine} />
          </View>

          {/* Description with Notebook Style */}
          {video.description && (
            <Animated.View 
              style={styles.descriptionContainer}
              entering={FadeIn.delay(500).duration(1000)}
            >
              <View style={styles.marginLine} />
              <View style={styles.descriptionContent}>
                <Text style={styles.description}>{video.description}</Text>
                {Array.from({ length: Math.ceil(video.description.length / 50) }).map((_, i) => (
                  <View key={i} style={[styles.notebookLine, { 
                    backgroundColor: isDarkMode ? '#444' : '#E0E0E0' 
                  }]} />
                ))}
              </View>
              <View style={styles.paperClip} />
            </Animated.View>
          )}
        </Animated.View>
      </Animated.ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <BlurView
            intensity={isDarkMode ? 30 : 50}
            tint={isDarkMode ? 'dark' : 'light'}
            style={styles.modalContainer}
          >
            <MotiView
              from={{ translateY: 100, opacity: 0 }}
              animate={{ translateY: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 15 }}
              style={[styles.modalContent, { backgroundColor: theme.card }]}
            >
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>
                    Edit Details
                  </Text>
                  <TouchableOpacity 
                    onPress={() => setShowEditModal(false)}
                    style={styles.closeButton}
                  >
                    <Ionicons name="close" size={24} color={theme.text} />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>Title</Text>
                  <TextInput
                    style={[styles.input, { 
                      color: theme.text,
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' 
                    }]}
                    value={editableFields.title}
                    onChangeText={(text) => setEditableFields(prev => ({ ...prev, title: text }))}
                    placeholder="Enter title"
                    placeholderTextColor={theme.textSecondary}
                  />

                  <Text style={[styles.inputLabel, { color: theme.text }]}>Description</Text>
                  <TextInput
                    style={[styles.textArea, { 
                      color: theme.text,
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' 
                    }]}
                    value={editableFields.description}
                    onChangeText={(text) => setEditableFields(prev => ({ ...prev, description: text }))}
                    placeholder="Add a description"
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />

                  <Text style={[styles.inputLabel, { color: theme.text }]}>Category</Text>
                  <View style={styles.categoryGrid}>
                    {categories.map((category) => (
                      <TouchableOpacity
                        key={category.id}
                        onPress={() => setEditableFields(prev => ({ ...prev, categoryId: category.id }))}
                        style={[
                          styles.categoryItem,
                          { 
                            borderColor: category.color,
                            backgroundColor: editableFields.categoryId === category.id 
                              ? category.color 
                              : 'transparent'
                          }
                        ]}
                      >
                        <View style={styles.categoryIcon}>
                          <Ionicons 
                            name={category.icon} 
                            size={16} 
                            color={editableFields.categoryId === category.id ? '#FFF' : category.color} 
                          />
                        </View>
                        <Text 
                          style={[
                            styles.categoryText, 
                            { color: editableFields.categoryId === category.id ? '#FFF' : theme.text }
                          ]}
                        >
                          {category.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.inputLabel, { color: theme.text }]}>Date</Text>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    style={[
                      styles.datePickerButton,
                      { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }
                    ]}
                  >
                    <Ionicons name="calendar-outline" size={20} color={theme.text} />
                    <Text style={[styles.buttonText, { color: theme.text }]}>
                      {new Date(editableFields.createdAt).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={[styles.cancelButton, { borderColor: theme.text }]}
                    onPress={() => setShowEditModal(false)}
                  >
                    <Text style={[styles.buttonText, { color: theme.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: accentColor }]}
                    onPress={handleSaveEdit}
                    disabled={isEditing}
                  >
                    {isEditing ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>Save Changes</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </MotiView>
          </BlurView>
        </TouchableWithoutFeedback>
      </Modal>

      {showDatePicker && (
        <DateTimePicker
          value={new Date(editableFields.createdAt)}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
    </View>
  );
} 