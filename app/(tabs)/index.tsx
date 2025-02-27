import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Dimensions, Platform, RefreshControl, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore, themeTemplates, themeColors, } from '../../stores/useThemeStore';
import { useVideoStore, type VideoEntry } from '../../stores/useVideoStore';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import Animated, { 
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  withSpring,
  withSequence,
  useSharedValue
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, AnimatePresence } from 'moti';
import type { FC } from 'react';
import { DatabaseService } from '../../services/database';
import { CoreMemoryModal } from '../../components/CoreMemoryModal';
import { Portal } from '@gorhom/portal';
import { generateUUID } from '../../utils/helpers';
import { useLanguageStore, translations } from '../../stores/useLanguageStore';
import { VideoPlayer } from '../../components/VideoPlayer';
import { ResizeMode } from 'expo-av';

const { width, height } = Dimensions.get('window');
const DIARY_BOOK_WIDTH = width * 0.38;
const DIARY_BOOK_HEIGHT = DIARY_BOOK_WIDTH * 1.4;

// Add these constants
const STICKY_NOTE_COLORS = [
  '#FFB6C1', // Light pink
  '#98FB98', // Light green
  '#87CEFA', // Light blue
  '#DDA', // Light purple
  '#F0E68C', // Khaki
  '#FFD700', // Gold
  '#FFA07A', // Light salmon
  '#E6E6FA'  // Lavender
];

const STICKY_NOTE_ROTATIONS = [-3, 2, -2, 3, -1, 1];

const SPRING_CONFIG = {
  damping: 15,
  mass: 1,
  stiffness: 120,
  overshootClamping: false,
};

interface Category {
  id: string;
  key: string;
  name: string;
  icon: string;
  color: string;
}

interface CoreMemory {
  videoId: string;
  note: string;
  color: string;
  createdAt: string;
}

interface VideoWithCoreMemory extends VideoEntry {
  coreMemory: CoreMemory;
}

// Add this interface
interface CustomCategoryModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: (category: Omit<Category, 'id'>) => void;
  title: string;
  nameLabel: string;
  iconLabel: string;
  colorLabel: string;
  saveButton: string;
  cancelButton: string;
}

// Add the CustomCategoryModal component
const CustomCategoryModal: React.FC<CustomCategoryModalProps> = ({
  isVisible,
  onClose,
  onSave,
  title,
  nameLabel,
  iconLabel,
  colorLabel,
  saveButton,
  cancelButton
}) => {
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('bookmark-outline');
  const [selectedColor, setSelectedColor] = useState('#FFB6C1');
  const { isDarkMode, template } = useThemeStore();
  const theme = themeTemplates[template][isDarkMode ? 'dark' : 'light'];

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a category name');
      return;
    }

    // Generate the key from the name
    const key = name.trim().toLowerCase().replace(/\s+/g, '_');

    onSave({
      name: name.trim(),
      key, // Add the key property
      icon: selectedIcon,
      color: selectedColor
    });

    // Reset form
    setName('');
    setSelectedIcon('bookmark-outline');
    setSelectedColor('#FFB6C1');
  };

  const iconOptions = [
    'bookmark-outline',
    'heart-outline',
    'star-outline',
    'flag-outline',
    'flame-outline',
    'flower-outline',
    'leaf-outline',
    'planet-outline'
  ];

  const colorOptions = STICKY_NOTE_COLORS;

  return (
    <Portal>
      <AnimatePresence>
        {isVisible && (
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={[modalStyles.container, { backgroundColor: theme.card }]}
          >
            <View style={modalStyles.header}>
              <Text style={[modalStyles.title, { color: theme.text }]}>
                {title}
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={modalStyles.content}>
              <TextInput
                style={[modalStyles.input, { backgroundColor: theme.bg, color: theme.text }]}
                placeholder={nameLabel}
                placeholderTextColor={theme.textSecondary}
                value={name}
                onChangeText={setName}
              />

              <Text style={[modalStyles.label, { color: theme.text }]}>{colorLabel}</Text>
              <View style={modalStyles.colorGrid}>
                {colorOptions.map(color => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      modalStyles.colorOption,
                      { backgroundColor: color },
                      selectedColor === color && modalStyles.selectedColor
                    ]}
                    onPress={() => setSelectedColor(color)}
                  />
                ))}
              </View>

              <Text style={[modalStyles.label, { color: theme.text }]}>{iconLabel}</Text>
              <View style={modalStyles.iconGrid}>
                {iconOptions.map(icon => (
                  <TouchableOpacity
                    key={icon}
                    style={[
                      modalStyles.iconOption,
                      { backgroundColor: theme.bg },
                      selectedIcon === icon && { borderColor: selectedColor }
                    ]}
                    onPress={() => setSelectedIcon(icon)}
                  >
                    <Ionicons
                      name={icon as any}
                      size={24}
                      color={selectedIcon === icon ? selectedColor : theme.text}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[modalStyles.saveButton, { backgroundColor: selectedColor }]}
                onPress={handleSave}
              >
                <Text style={modalStyles.saveButtonText}>{saveButton}</Text>
              </TouchableOpacity>
            </ScrollView>
          </MotiView>
        )}
      </AnimatePresence>
    </Portal>
  );
};

// Add modal styles
const modalStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '10%',
    left: 20,
    right: 20,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  content: {
    maxHeight: '100%',
  },
  input: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  selectedColor: {
    borderWidth: 3,
    borderColor: '#fff',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  saveButton: {
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

const HomeScreen: FC = () => {
  const { isDarkMode, template, accentColor } = useThemeStore();
  const theme = themeTemplates[template][isDarkMode ? 'dark' : 'light'];
  const accent = themeColors[accentColor].primary;
  const { videos, isLoading, loadVideos } = useVideoStore();
  const scrollY = useSharedValue(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [coreMemories, setCoreMemories] = useState<CoreMemory[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoEntry | null>(null);
  const [showCoreMemoryModal, setShowCoreMemoryModal] = useState(false);
  const [showCustomCategoryModal, setShowCustomCategoryModal] = useState(false);
  const [newCoreMemoryId, setNewCoreMemoryId] = useState<string | null>(null);
  const scrollViewRef = useRef<Animated.ScrollView>(null);

  // Animated values for micro-interactions
  const addButtonScale = useSharedValue(1);
  const headerOpacity = useSharedValue(1);

  // Add language store hook with other hooks
  const { language } = useLanguageStore();
  const t = translations[language];

  // Load core memories and categories on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        console.log('Loading initial data...');
        const [memories, dbCategories] = await Promise.all([
          DatabaseService.getCoreMemories() as Promise<CoreMemory[]>,
          DatabaseService.getCategories() as Promise<Category[]>
        ]);
        
        console.log('Loaded core memories:', memories);
        console.log('Loaded categories:', dbCategories);
        
        if (dbCategories && dbCategories.length > 0) {
          setCategories(dbCategories);
          // Set initial category to 'all'
          setSelectedCategory('all');
        }
        
        if (memories && memories.length > 0) {
          setCoreMemories(memories);
        }

        // Load videos after categories and memories
        await loadVideos();
      } catch (error) {
        console.error('Failed to load initial data:', error);
        Alert.alert('Error', 'Failed to load data. Please try refreshing.');
      }
    };
    loadInitialData();
  }, []);

  // Filter videos by category
  const filteredVideos = useMemo(() => {
    console.log('Filtering videos by category:', selectedCategory);
    console.log('Available videos:', videos);
    if (selectedCategory === 'all') return videos;
    return videos.filter(video => video.categoryId === selectedCategory);
  }, [videos, selectedCategory]);

  // Filter videos that are core memories with their notes
  const coreMemoryVideos = useMemo(() => {
    console.log('Filtering core memories...');
    console.log('Videos:', videos);
    console.log('Core memories:', coreMemories);
    
    if (!videos || !coreMemories) {
      console.log('No videos or core memories available');
      return [];
    }

    const coreMemoryMap = new Map(coreMemories.map(m => [m.videoId, m]));
    const filtered = videos
      .filter(v => {
        // First check if it's a core memory
        const isCoreMemory = coreMemoryMap.has(v.id);
        // Then check category if selected
        const matchesCategory = selectedCategory === 'all' || v.categoryId === selectedCategory;
        return isCoreMemory && matchesCategory;
      })
      .map(v => ({
        ...v,
        coreMemory: coreMemoryMap.get(v.id)!
      }));
      
    console.log('Filtered core memory videos:', filtered);
    return filtered;
  }, [videos, coreMemories, selectedCategory]);

  // Load core memories on refresh too
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [newVideos, newCategories, newMemories] = await Promise.all([
        loadVideos(),
        DatabaseService.getCategories() as Promise<Category[]>,
        DatabaseService.getCoreMemories() as Promise<CoreMemory[]>
      ]);
      
      if (newCategories) {
        setCategories(newCategories);
      }
      
      if (newMemories) {
        setCoreMemories(newMemories);
      }
      
      // Animate categories
      categories.forEach((_, index) => {
        setTimeout(() => {
          addButtonScale.value = withSequence(
            withSpring(1.1, { damping: 10 }),
            withSpring(1, { damping: 12 })
          );
        }, index * 100);
      });
    } catch (error) {
      console.error('Refresh failed:', error);
      Alert.alert('Error', 'Failed to refresh. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleAddCoreMemory = useCallback((videoId: string, video: VideoEntry) => {
    console.log('Adding core memory for video:', video);
    setSelectedVideo(video);
    setShowCoreMemoryModal(true);
  }, []);

  // Add effect to handle new core memory
  useEffect(() => {
    if (newCoreMemoryId) {
      // Show refresh animation
      setRefreshing(true);
      
      // Trigger refresh
      handleRefresh().then(() => {
        // After refresh, scroll to core memories section with animation
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
          
          // Animate the new core memory card
          addButtonScale.value = withSequence(
            withSpring(1.2, { damping: 10 }),
            withSpring(1, { damping: 12 })
          );
          
          // Clear the new core memory id
          setNewCoreMemoryId(null);
        }, 500);
      });
    }
  }, [newCoreMemoryId]);

  const handleSaveCoreMemory = useCallback(async (note: string) => {
    if (!selectedVideo) return;

    try {
      const newMemory: CoreMemory = {
        videoId: selectedVideo.id,
        note,
        color: STICKY_NOTE_COLORS[Math.floor(Math.random() * STICKY_NOTE_COLORS.length)],
        createdAt: new Date().toISOString()
      };
      console.log('Saving new core memory:', newMemory);
      const memoryWithType = {
        ...newMemory,
        typeId: 'default'
      };
      await DatabaseService.addCoreMemory(memoryWithType);
      setCoreMemories(prev => [...prev, memoryWithType]);
      setShowCoreMemoryModal(false); 
      setSelectedVideo(null);
      
      // Set the new core memory id to trigger animation
      setNewCoreMemoryId(selectedVideo.id);
      
      // Show success message
      Alert.alert(t.success, t.changesSaved);
    } catch (error) {
      console.error('Failed to save core memory:', error);
      Alert.alert(t.error, t.error);
    }
  }, [selectedVideo, t]);

  // Add function to handle custom category creation
  const handleCreateCategory = useCallback(async (category: Omit<Category, 'id'>) => {
    try {
      const newCategory = {
        ...category,
        id: generateUUID(),
        key: category.name.toLowerCase().replace(/\s+/g, '_') // Generate key from name
      };
      
      await DatabaseService.addCategory(newCategory);
      setCategories(prev => [...prev, newCategory]);
      
      Alert.alert(t.success, t.changesSaved);
    } catch (error) {
      console.error('Failed to create category:', error);
      Alert.alert(t.error, t.error);
    }
  }, [t]);

  // Enhanced scroll handler with bounce effect
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      headerOpacity.value = interpolate(
        event.contentOffset.y,
        [0, 100],
        [1, 0.8],
        'clamp'
      );

      // Add subtle parallax to featured cards
      const parallaxValue = interpolate(
        event.contentOffset.y,
        [0, 200],
        [0, -30],
        'clamp'
      );
      // We'll use this value in featured section
    },
    onBeginDrag: () => {
      addButtonScale.value = withSpring(0.95, SPRING_CONFIG);
    },
    onEndDrag: () => {
      addButtonScale.value = withSpring(1, SPRING_CONFIG);
    },
  });

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, 100],
          [0, -20],
          'clamp'
        ),
      },
    ],
  }));

  const addButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: addButtonScale.value }],
  }));

  // Create styles with theme access
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    backgroundGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: height * 0.3,
    },
    header: {
      paddingTop: Platform.OS === 'ios' ? 20 : 20,
      marginBottom: 20,
    },
    headerBlur: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 15,
    },
    title: {
      fontSize: 28,
      fontFamily: 'Noteworthy-Bold',
      letterSpacing: 0.5,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 12,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    scrollContent: {
      paddingBottom: 100,
      minHeight: height + 1, // Ensures smooth refresh on shorter content
    },
    categoriesSection: {
      marginBottom: 24,
      backfaceVisibility: 'hidden', // Prevents flicker during animations
    },
    categoriesContainer: {
      paddingHorizontal: 20,
      gap: 12,
    },
    categoryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1.5,
      gap: 8,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    categoryIcon: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
    },
    categoryText: {
      fontSize: 15,
      fontFamily: 'Noteworthy-Bold',
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 22,
      fontFamily: 'Noteworthy-Bold',
    },
    seeAllButton: {
      fontSize: 14,
      fontFamily: 'Noteworthy',
    },
    featuredSection: {
      marginBottom: 32,
      paddingVertical: 10,
    },
    featuredContainer: {
      paddingHorizontal: 20,
      gap: 20,
    },
    featuredCardContainer: {
      width: width * 0.8,
      marginVertical: 10,
    },
    featuredCard: {
      borderRadius: 16,
      overflow: 'hidden',
      height: 280,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    featuredThumbnail: {
      width: '100%',
      height: '100%',
      borderRadius: 16,
    },
    bookSpine: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 20,
      backgroundColor: 'rgba(0,0,0,0.2)',
      borderTopLeftRadius: 16,
      borderBottomLeftRadius: 16,
    },
    bookmarkContainer: {
      position: 'absolute',
      top: -10,
      right: 20,
      zIndex: 10,
    },
    bookmark: {
      width: 30,
      height: 60,
      borderRadius: 4,
      transform: [{ rotate: '5deg' }],
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    featuredGradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '60%',
      justifyContent: 'flex-end',
      padding: 20,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16,
    },
    featuredContent: {
      gap: 8,
    },
    featuredTitle: {
      color: '#FFF',
      fontSize: 24,
      fontFamily: 'Noteworthy-Bold',
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    featuredDate: {
      color: '#EEE',
      fontSize: 16,
      fontFamily: 'Noteworthy',
      opacity: 0.9,
    },
    recentSection: {
      paddingHorizontal: 20,
    },
    recentGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
      justifyContent: 'space-between',
    },
    recentCardContainer: {
      width: (width - 56) / 2,
      marginBottom: 16,
    },
    recentCard: {
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: '#FFF',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 2, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
        },
        android: {
          elevation: 5,
        },
      }),
    },
    recentThumbnailContainer: {
      width: '100%',
      height: 160,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
    },
    recentThumbnail: {
      width: '100%',
      height: 160,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
    },
    bookEdge: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: 6,
      backgroundColor: 'rgba(0,0,0,0.1)',
      borderTopRightRadius: 12,
      borderBottomRightRadius: 12,
    },
    recentContent: {
      padding: 12,
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12,
    },
    recentMetadata: {
      gap: 8,
    },
    recentDateBadge: {
      backgroundColor: 'rgba(0,0,0,0.05)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      alignSelf: 'flex-start',
    },
    recentDateText: {
      fontSize: 12,
      fontFamily: 'Noteworthy',
      color: theme.text,
      opacity: 0.7,
    },
    recentTitle: {
      fontSize: 16,
      fontFamily: 'Noteworthy-Bold',
      color: theme.text,
      lineHeight: 20,
    },
    recentDecorations: {
      position: 'absolute',
      bottom: 8,
      left: 12,
      right: 12,
    },
    pageLines: {
      gap: 4,
    },
    pageLine: {
      height: 1,
      backgroundColor: 'rgba(0,0,0,0.1)',
      marginVertical: 2,
    },
    cornerDecoration: {
      position: 'absolute',
      bottom: -4,
      right: -4,
      width: 16,
      height: 16,
      borderRadius: 4,
      transform: [{ rotate: '45deg' }],
    },
    fabContainer: {
      position: 'absolute',
      bottom: 30,
      right: 20,
    },
    addButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
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
    fabGradient: {
      width: '100%',
      height: '100%',
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyCore: {
      width: width * 0.8,
      height: 280,
      backgroundColor: theme.card,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: 10,
    },
    emptyCoreText: {
      marginTop: 16,
      fontSize: 16,
      textAlign: 'center',
      lineHeight: 24,
    },
    stickyNote: {
      position: 'absolute',
      top: 20,
      right: 20,
      width: 140,
      minHeight: 140,
      padding: 16,
      borderRadius: 4,
      zIndex: 10,
      transform: [{ rotate: '3deg' }],
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 2, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    stickyNoteTape: {
      position: 'absolute',
      top: -10,
      left: '50%',
      width: 40,
      height: 20,
      marginLeft: -20,
      backgroundColor: 'rgba(255,255,255,0.6)',
      transform: [{ rotate: '-2deg' }],
      borderRadius: 2,
    },
    stickyNoteText: {
      fontSize: 14,
      color: '#1a1a1a',
      fontFamily: 'Noteworthy',
      lineHeight: 20,
    },
    stickyNoteDate: {
      fontSize: 12,
      color: '#1a1a1a',
      fontFamily: 'Noteworthy',
      opacity: 0.7,
      marginTop: 8,
    },
    categoryBadge: {
      position: 'absolute',
      top: 10,
      left: 10,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 15,
      gap: 4,
      backgroundColor: 'rgba(255,255,255,0.9)',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 3,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    categoryBadgeIcon: {
      width: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryBadgeText: {
      fontSize: 12,
      fontFamily: 'Noteworthy',
      color: '#1a1a1a',
    },
    addCategoryButton: {
      width: 50,
      aspectRatio: 1,
      borderStyle: 'dashed',
      borderWidth: 2,
      borderColor: theme.border,
    },
    refreshHint: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 100 : 80,
      left: 20,
      right: 20,
      padding: 12,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    refreshHintText: {
      color: '#FFF',
      fontSize: 16,
      fontFamily: 'Noteworthy-Bold',
    },
  });

  // Add this helper function at component level
  const getCategoryName = (category: Category) => {
    // First try to get translated name
    const translatedName = t.categories[category.key as keyof typeof t.categories];
    // Fallback to stored name if translation not found
    return translatedName || category.name;
  };

  if (isLoading) return <LoadingSpinner />;

  // Update the categories section render
  const renderCategories = () => (
    <MotiView style={styles.categoriesSection}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContainer}
      >
        {categories.map((category, index) => (
          <Animated.View
            key={category.id}
            entering={FadeInDown.delay(index * 100)}
          >
            <TouchableOpacity
              style={[
                styles.categoryButton,
                { 
                  backgroundColor: selectedCategory === category.id 
                    ? category.color 
                    : theme.card,
                  borderColor: category.color,
                }
              ]}
              onPress={() => {
                console.log('Selected category:', category);
                setSelectedCategory(category.id);
              }}
            >
              <View style={[styles.categoryIcon, { 
                backgroundColor: selectedCategory === category.id 
                  ? 'rgba(255,255,255,0.2)' 
                  : 'transparent' 
              }]}>
                <Ionicons 
                  name={category.icon as any} 
                  size={20} 
                  color={selectedCategory === category.id ? '#FFF' : category.color} 
                />
              </View>
              <Text style={[
                styles.categoryText,
                { color: selectedCategory === category.id ? '#FFF' : theme.text }
              ]}>
                {getCategoryName(category)}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
        
        {/* Add Category Button */}
        <Animated.View entering={FadeInDown.delay(categories.length * 100)}>
          <TouchableOpacity
            style={[
              styles.categoryButton,
              styles.addCategoryButton,
              { backgroundColor: theme.card }
            ]}
            onPress={() => {
              console.log('Opening custom category modal');
              setShowCustomCategoryModal(true);
            }}
          >
            <Ionicons name="add" size={24} color={theme.text} />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </MotiView>
  );

  // Update the core memory card render
  const renderCoreMemoryCard = (video: VideoWithCoreMemory, index: number) => (
    <MotiView
      key={video.id}
      from={{ opacity: 0, scale: 0.9, translateX: 50 }}
      animate={{ opacity: 1, scale: 1, translateX: 0 }}
      transition={{ delay: index * 100 }}
      style={styles.featuredCardContainer}
    >
      <TouchableOpacity
        style={[styles.featuredCard, { backgroundColor: theme.card }]}
        onPress={() => router.push(`/video/${video.id}`)}
      >
        <Image
          source={{ uri: video.thumbnail }}
          style={styles.featuredThumbnail}
          resizeMode="cover"
        />
        <View style={styles.bookSpine} />
        
        {/* Category Badge */}
        {video.categoryId && video.categoryId !== 'all' && (
          <View style={styles.categoryBadge}>
            <View style={styles.categoryBadgeIcon}>
              <Ionicons 
                name={categories.find(c => c.id === video.categoryId)?.icon as any} 
                size={14} 
                color={categories.find(c => c.id === video.categoryId)?.color} 
              />
            </View>
            <Text style={styles.categoryBadgeText}>
              {getCategoryName(categories.find(c => c.id === video.categoryId) as Category)}
            </Text>
          </View>
        )}
        
        {/* Enhanced Sticky Note */}
        <MotiView
          from={{ rotate: '-10deg', scale: 0.9 }}
          animate={{ rotate: STICKY_NOTE_ROTATIONS[index % STICKY_NOTE_ROTATIONS.length] + 'deg', scale: 1 }}
          transition={{ type: 'spring', delay: index * 150 }}
          style={[
            styles.stickyNote,
            { backgroundColor: video.coreMemory.color }
          ]}
        >
          <View style={styles.stickyNoteTape} />
          <Text style={styles.stickyNoteText} numberOfLines={4}>
            {video.coreMemory.note}
          </Text>
          <Text style={styles.stickyNoteDate}>
            {new Date(video.coreMemory.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            })}
          </Text>
        </MotiView>

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.featuredGradient}
        >
          <View style={styles.featuredContent}>
            <Text style={styles.featuredTitle} numberOfLines={2}>
              {video.title}
            </Text>
            <Text style={styles.featuredDate}>
              {new Date(video.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })}
            </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </MotiView>
  );

  // Update the core memory section render
  const renderCoreMemoriesSection = () => (
    <Animated.View style={[styles.featuredSection]}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {t.coreMemories} ({coreMemoryVideos.length})
        </Text>
        <TouchableOpacity onPress={() => {
          // Navigate to create core memory screen
          router.push('/create-core');
        }}>
          <Text style={[styles.seeAllButton, { color: accent }]}>Add New</Text>
        </TouchableOpacity>
      </View>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}  
        contentContainerStyle={styles.featuredContainer}
        decelerationRate="fast"
        snapToInterval={width * 0.8 + 20}
      >
        {coreMemoryVideos.length === 0 ? (
          <View style={[styles.emptyCore, { backgroundColor: theme.card }]}>
            <Ionicons name="heart-outline" size={32} color={theme.textSecondary} />
            <Text style={[styles.emptyCoreText, { color: theme.textSecondary }]}>
              {t.noCoreMemoriesYet}
            </Text>
          </View>
        ) : (
          coreMemoryVideos.map((video, index) => renderCoreMemoryCard(video, index))
        )}
      </ScrollView>
    </Animated.View>
  );

  // Update the renderRecentCard function
  const renderRecentCard = (video: VideoEntry, index: number) => (
    <MotiView
      key={video.id}
      from={{ opacity: 0, scale: 0.9, translateY: 20 }}
      animate={{ 
        opacity: 1, 
        scale: 1, 
        translateY: 0 
      }}
      transition={{ 
        type: 'spring',
        delay: refreshing ? index * 100 : 0,
        damping: 15
      }}
      style={styles.recentCardContainer}
    >
      <TouchableOpacity
        style={[styles.recentCard, { backgroundColor: theme.card }]}
        onPress={() => router.push(`/video/${video.id}`)}
      >
        <View style={styles.recentThumbnailContainer}>
          <VideoPlayer
            videoId={video.id}
            uri={video.uri}
            style={styles.recentThumbnail}
            showControls={false}
            autoPlay={false}
            resizeMode={ResizeMode.COVER}
          />
        </View>
        {video.categoryId && video.categoryId !== 'all' && (
          <View style={styles.categoryBadge}>
            <View style={styles.categoryBadgeIcon}>
              <Ionicons 
                name={categories.find(c => c.id === video.categoryId)?.icon as any} 
                size={14} 
                color={categories.find(c => c.id === video.categoryId)?.color} 
              />
            </View>
            <Text style={styles.categoryBadgeText}>
              {getCategoryName(categories.find(c => c.id === video.categoryId) as Category)}
            </Text>
          </View>
        )}
        <View style={styles.bookEdge} />
        <BlurView
          intensity={70}
          tint={isDarkMode ? 'dark' : 'light'}
          style={styles.recentContent}
        >
          <View style={styles.recentMetadata}>
            <View style={styles.recentDateBadge}>
              <Text style={styles.recentDateText}>
                {new Date(video.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })}
              </Text>
            </View>
            <Text style={styles.recentTitle} numberOfLines={2}>
              {video.title}
            </Text>
          </View>
          <View style={styles.recentDecorations}>
            <View style={styles.pageLines}>
              {[...Array(3)].map((_, i) => (
                <View key={i} style={styles.pageLine} />
              ))}
            </View>
            <View style={[styles.cornerDecoration, { 
              backgroundColor: categories.find(c => c.id === video.categoryId)?.color || STICKY_NOTE_COLORS[index % STICKY_NOTE_COLORS.length]
            }]} />
          </View>
        </BlurView>
      </TouchableOpacity>
    </MotiView>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Decorative Background Elements */}
      <LinearGradient
        colors={[
          isDarkMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
          'transparent'
        ]}
        style={styles.backgroundGradient}
      />
      
      {/* Animated Header */}
      <Animated.View style={[styles.header, headerStyle]}>
        <BlurView
          intensity={isDarkMode ? 30 : 50}
          tint={isDarkMode ? 'dark' : 'light'}
          style={styles.headerBlur}
        >
          <Text style={[styles.title, { color: theme.text }]}>
            {t.myDiaryCollection}
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: theme.card }]}
            >
              <Ionicons name="search-outline" size={22} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: theme.card }]}
            >
              <Ionicons name="filter-outline" size={22} color={theme.text} />
            </TouchableOpacity>
          </View>
        </BlurView>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollViewRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={accent}
            colors={[accent]}
            progressBackgroundColor={theme.card}
            progressViewOffset={Platform.OS === 'ios' ? 0 : 20}
            style={{ backgroundColor: 'transparent' }}
          />
        }
      >
        {renderCategories()}
        {renderCoreMemoriesSection()}

        {/* Recent Collection */}
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t.recentCollection}
            </Text>
            <TouchableOpacity>
              <Text style={[styles.seeAllButton, { color: accent }]}></Text>
            </TouchableOpacity>
          </View>
          <View style={styles.recentGrid}>
            {filteredVideos.slice(0, 6).map((video, index) => renderRecentCard(video, index))}
          </View>
        </View>
      </Animated.ScrollView>

      {/* Core Memory Modal */}
      <CoreMemoryModal
        isVisible={showCoreMemoryModal}
        onClose={() => {
          setShowCoreMemoryModal(false);
          setSelectedVideo(null);
        }}
        onSave={handleSaveCoreMemory}
        initialNote={coreMemories.find(m => m.videoId === selectedVideo?.id)?.note}
        videoTitle={selectedVideo?.title || ''}
      />

      {/* Add CustomCategoryModal */}
      <CustomCategoryModal
        isVisible={showCustomCategoryModal}
        onClose={() => setShowCustomCategoryModal(false)}
        onSave={handleCreateCategory}
        title={t.createCategory}
        nameLabel={t.categoryName}
        iconLabel={t.chooseIcon}
        colorLabel={t.chooseColor}
        saveButton={t.save}
        cancelButton={t.cancel}
      />

      {/* Add pull-to-refresh hint when new core memory is added */}
      <AnimatePresence>
        {newCoreMemoryId && (
          <MotiView
            from={{ opacity: 0, translateY: -50 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0, translateY: -50 }}
            style={[styles.refreshHint, { backgroundColor: accent }]}
          >
            <Text style={styles.refreshHintText}>
              {t.pullToRefresh}
            </Text>
          </MotiView>
        )}
      </AnimatePresence>
    </View>
  );
};

export default HomeScreen;
