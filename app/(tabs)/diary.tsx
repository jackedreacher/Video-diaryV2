import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, StyleSheet, RefreshControl, Dimensions, Platform, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useThemeStore, themeTemplates, themeColors } from '../../stores/useThemeStore';
import { useVideoStore } from '../../stores/useVideoStore';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorMessage } from '../../components/ErrorMessage';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  interpolate,
} from 'react-native-reanimated';
import { MotiView, AnimatePresence } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { DatabaseService } from '../../services/database';
import { useLanguageStore, translations } from '../../stores/useLanguageStore';

const { width, height } = Dimensions.get('window');
const HEADER_HEIGHT = Platform.select({ ios: 180, android: 165 });
const SPRING_CONFIG = {
  damping: 15,
  mass: 1,
  stiffness: 120,
};

// Types for our video entries
interface VideoEntry {
  id: string;
  uri: string;
  thumbnail: string;
  duration: number;
  createdAt: string;
  title: string;
  description?: string;
  startTime: number;
  endTime: number;
  categoryId?: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

const formatTimeRange = (startTime: number, endTime: number) => {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  return `${formatTime(startTime)}-${formatTime(endTime)}`;
};

// Add new view mode type
type ViewMode = 'grid' | 'list';
type SortOption = 'date' | 'title' | 'duration';

const sortOptions: { label: string; value: SortOption }[] = [
  { label: 'Date', value: 'date' },
  { label: 'Title', value: 'title' },
  { label: 'Duration', value: 'duration' },
];

/* Mock data for reference:
const DUMMY_VIDEOS = [
  {
    id: '1',
    title: 'Dog running in the park',
    thumbnail: 'https://picsum.photos/200/300',
    timeRange: '0:30-1:40'
  },
  ...
];
*/

export default function DiaryScreen() {
  const { isDarkMode, template, accentColor } = useThemeStore();
  const currentTheme = themeTemplates[template][isDarkMode ? 'dark' : 'light'];
  const accent = themeColors[accentColor].primary;
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  const scrollY = useSharedValue(0);
  const searchFocused = useSharedValue(0);

  const { videos, isLoading, error, loadVideos } = useVideoStore();
  const { language } = useLanguageStore();
  const t = translations[language];

  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      const dbCategories = await DatabaseService.getCategories() as Category[];
      setCategories(dbCategories);
    };
    loadCategories();
  }, []);

  // Enhanced filtering and sorting
  const sortedAndFilteredVideos = useMemo(() => {
    let filtered = videos.filter(video => 
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (selectedCategory === 'all' || video.categoryId === selectedCategory)
    );

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'duration':
          return (b.endTime - b.startTime) - (a.endTime - a.startTime);
        case 'date':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [videos, searchQuery, selectedCategory, sortBy]);

  // Batch operations
  const handleBatchDelete = useCallback(async () => {
    if (selectedVideos.length === 0) return;

    Alert.alert(
      t.deleteConfirmation,
      t.cannotBeUndone,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(selectedVideos.map(id => DatabaseService.deleteVideo(id)));
              await loadVideos();
              setSelectedVideos([]);
              setIsSelectionMode(false);
              Alert.alert('Success', t.videosDeletedSuccessfully);
            } catch (error) {
              console.error('Failed to delete videos:', error);
              Alert.alert('Error', t.failedToDeleteVideos);
            }
          }
        }
      ]
    );
  }, [selectedVideos]);

  // Toggle video selection
  const toggleVideoSelection = useCallback((videoId: string) => {
    setSelectedVideos(prev => {
      if (prev.includes(videoId)) {
        const newSelection = prev.filter(id => id !== videoId);
        if (newSelection.length === 0) {
          setIsSelectionMode(false);
        }
        return newSelection;
      }
      return [...prev, videoId];
    });
  }, []);

  // Render video card with selection support
  const renderVideoCard = useCallback((video: VideoEntry, index: number) => (
    <MotiView
      key={video.id}
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{
        type: 'timing',
        delay: index * 50,
        duration: 350,
      }}
      style={[
        viewMode === 'grid' ? styles.gridCard : styles.listCard,
        isSelectionMode && styles.selectionModeCard
      ]}
    >
      <TouchableOpacity
        style={{ flex: 1 }}
        onPress={() => {
          if (isSelectionMode) {
            toggleVideoSelection(video.id);
          } else {
            router.push(`/video/${video.id}`);
          }
        }}
        onLongPress={() => {
          if (!isSelectionMode) {
            setIsSelectionMode(true);
            setSelectedVideos([video.id]);
          }
        }}
      >
        <View style={viewMode === 'grid' ? styles.gridContent : styles.listContent}>
          <Image
            source={{ uri: video.thumbnail }}
            style={viewMode === 'grid' ? styles.gridThumbnail : styles.listThumbnail}
            resizeMode="cover"
          />
          
          {/* Selection Indicator */}
          {isSelectionMode && (
            <View style={[
              styles.selectionIndicator,
              selectedVideos.includes(video.id) && styles.selectedIndicator
            ]}>
              <Ionicons
                name={selectedVideos.includes(video.id) ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={selectedVideos.includes(video.id) ? accent : currentTheme.textSecondary}
              />
            </View>
          )}

          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)']}
            style={StyleSheet.absoluteFill}
          />
          
          <View style={viewMode === 'grid' ? styles.gridInfo : styles.listInfo}>
            <View style={styles.titleRow}>
              <Text style={[
                styles.videoTitle,
                viewMode === 'list' && styles.listTitle
              ]} numberOfLines={2}>
                {video.title}
              </Text>
              {video.categoryId && video.categoryId !== 'all' && (
                <View style={[
                  styles.categoryBadge,
                  { backgroundColor: categories.find(c => c.id === video.categoryId)?.color + '20' }
                ]}>
                  <Ionicons
                    name={categories.find(c => c.id === video.categoryId)?.icon as any}
                    size={12}
                    color={categories.find(c => c.id === video.categoryId)?.color}
                  />
                  <Text style={[
                    styles.categoryText,
                    { color: categories.find(c => c.id === video.categoryId)?.color }
                  ]}>
                    {categories.find(c => c.id === video.categoryId)?.name}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.metaRow}>
              <Text style={styles.dateText}>
                {new Date(video.createdAt).toLocaleDateString()}
              </Text>
              <Text style={styles.durationText}>
                {formatTimeRange(video.startTime, video.endTime)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </MotiView>
  ), [viewMode, isSelectionMode, selectedVideos, categories, accent, currentTheme]);

  // Handle refresh with categories reload
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [_, newCategories] = await Promise.all([
        loadVideos(),
        DatabaseService.getCategories()
      ]);
      setCategories(newCategories as Category[]);
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
    setRefreshing(false);
    }
  }, [loadVideos]);

  // Animated header style
  const headerStyle = useAnimatedStyle(() => {
    const height = interpolate(
      scrollY.value,
      [0, 120],
      [HEADER_HEIGHT!, HEADER_HEIGHT! - 60],
      'clamp'
    );
    return { height };
  });

  const searchBarStyle = useAnimatedStyle(() => {
    const scale = interpolate(searchFocused.value, [0, 1], [1, 1.02]);
    const shadowOpacity = interpolate(searchFocused.value, [0, 1], [0.1, 0.2]);
    return {
      transform: [{ scale }],
      shadowOpacity,
    };
  });

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: currentTheme.bg,
    },
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      backgroundColor: currentTheme.bg + '95',
    },
    headerContent: {
      padding: 16,
      paddingTop: Platform.OS === 'ios' ? 10 : 40,
    },
    titleContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      marginTop: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
      color: currentTheme.text,
      letterSpacing: -0.5,
    },
    searchContainer: {
      marginVertical: 12,
      borderRadius: 12,
      backgroundColor: currentTheme.card + (isDarkMode ? '90' : '75'),
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: isDarkMode ? '#000' : accent,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 12,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    searchInner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      height: 44,
    },
    searchInput: {
      flex: 1,
      marginLeft: 8,
      fontSize: 16,
      color: currentTheme.text,
      fontWeight: '400',
    },
    categoriesContainer: {
      flexDirection: 'row',
      marginTop: 16,
      paddingHorizontal: 8,
    },
    categoryButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      marginHorizontal: 4,
      borderRadius: 20,
      flexDirection: 'row',
      alignItems: 'center',
    },
    categoryActive: {
      backgroundColor: accent + '15',
    },
    categoryText: {
      marginLeft: 6,
      fontSize: 14,
      fontWeight: '500',
    },
    contentContainer: {
      paddingTop: HEADER_HEIGHT,
      minHeight: height,
    },
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: 8,
    },
    videoCard: {
      width: (width - 32) / 2,
      margin: 8,
      borderRadius: 16,
      backgroundColor: currentTheme.card,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: isDarkMode ? '#000' : accent,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    thumbnail: {
      width: '100%',
      height: 120,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
    },
    videoInfo: {
      padding: 12,
    },
    videoTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: currentTheme.text,
      marginBottom: 4,
    },
    videoMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    duration: {
      fontSize: 13,
      color: currentTheme.textSecondary,
      opacity: 0.8,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 60,
    },
    emptyStateText: {
      fontSize: 16,
      color: currentTheme.textSecondary,
      marginTop: 12,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginLeft: 8,
    },
    gridCard: {
      width: (width - 32) / 2,
      margin: 8,
      borderRadius: 16,
      backgroundColor: currentTheme.card,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: isDarkMode ? '#000' : accent,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    listCard: {
      width: width - 32,
      marginHorizontal: 16,
      marginVertical: 40,
      borderRadius: 16,
      backgroundColor: currentTheme.card,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: isDarkMode ? '#000' : accent,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    gridContent: {
      aspectRatio: 1,
    },
    listContent: {
      flexDirection: 'row',
      height: 120,
    },
    gridThumbnail: {
      width: '100%',
      height: '100%',
    },
    listThumbnail: {
      width: 120,
      height: '100%',
    },
    gridInfo: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 12,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    listInfo: {
      flex: 1,
      padding: 12,
      justifyContent: 'space-between',
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 8,
    },
    listTitle: {
      color: currentTheme.text,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    dateText: {
      fontSize: 13,
      color: currentTheme.textSecondary,
    },
    durationText: {
      fontSize: 13,
      color: currentTheme.textSecondary,
    },
    categoryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    selectionModeCard: {
      opacity: 0.8,
    },
    selectionIndicator: {
      position: 'absolute',
      top: 8,
      right: 8,
      zIndex: 10,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.9)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedIndicator: {
      backgroundColor: accent,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 12,
    },
    actionButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: currentTheme.card,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: {
          shadowColor: isDarkMode ? '#000' : accent,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    sortMenu: {
      position: 'absolute',
      top: 50,
      right: 16,
      backgroundColor: currentTheme.card,
      borderRadius: 12,
      padding: 8,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    sortOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      gap: 8,
    },
    sortOptionText: {
      fontSize: 16,
      color: currentTheme.text,
    },
    selectionBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 60,
      backgroundColor: currentTheme.card,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    listContainer: {
      paddingVertical: 8,
    },
  });

  const onScroll = useCallback((event: any) => {
    'worklet';
    scrollY.value = event.nativeEvent.contentOffset.y;
  }, []);

  const handleSearchFocus = () => {
    searchFocused.value = withSpring(1, SPRING_CONFIG);
  };

  const handleSearchBlur = () => {
    searchFocused.value = withSpring(0, SPRING_CONFIG);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 400 }}
        >
        <LoadingSpinner />
        </MotiView>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ErrorMessage message={error.toString()} onRetry={loadVideos} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Animated Header */}
      <Animated.View style={[styles.header, headerStyle]}>
        <BlurView intensity={isDarkMode ? 45 : 65} tint={isDarkMode ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={[currentTheme.bg, currentTheme.bg + '00']}
            style={StyleSheet.absoluteFill}
          />
        </BlurView>
        <View style={styles.headerContent}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Video Library</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => setViewMode(prev => prev === 'grid' ? 'list' : 'grid')}
              >
                <MaterialCommunityIcons 
                  name={viewMode === 'grid' ? "view-list" : "view-grid"} 
                  size={24} 
                  color={currentTheme.text} 
                />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => setShowSortMenu(prev => !prev)}
              >
                <MaterialCommunityIcons 
                  name="sort" 
                  size={24} 
                  color={currentTheme.text} 
                />
          </TouchableOpacity>
        </View>
          </View>

          {/* Sort Menu */}
          <AnimatePresence>
            {showSortMenu && (
              <MotiView
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                style={styles.sortMenu}
              >
                {sortOptions.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={styles.sortOption}
                    onPress={() => {
                      setSortBy(option.value);
                      setShowSortMenu(false);
                    }}
                  >
                    <Ionicons
                      name={sortBy === option.value ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={sortBy === option.value ? accent : currentTheme.textSecondary}
                    />
                    <Text style={[
                      styles.sortOptionText,
                      sortBy === option.value && { color: accent }
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </MotiView>
            )}
          </AnimatePresence>
        
        {/* Search Bar */}
          <Animated.View style={[styles.searchContainer, searchBarStyle]}>
            <View style={styles.searchInner}>
              <Ionicons name="search" size={20} color={currentTheme.textSecondary} />
          <TextInput
                style={styles.searchInput}
                placeholder={t.search}
                placeholderTextColor={currentTheme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={currentTheme.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>

          {/* Categories */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesContainer}
          >
            {categories.map(category => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryButton,
                  selectedCategory === category.id && [
                    styles.categoryActive,
                    { backgroundColor: category.color + '15' }
                  ]
                ]}
                onPress={() => setSelectedCategory(category.id)}
              >
                <Ionicons 
                  name={category.icon as any} 
                  size={18} 
                  color={selectedCategory === category.id ? category.color : currentTheme.textSecondary}
                />
                <Text
                  style={[
                    styles.categoryText,
                    { 
                      color: selectedCategory === category.id 
                        ? category.color 
                        : currentTheme.textSecondary 
                    }
                  ]}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Animated.View>

      {/* Content */}
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={accent}
          />
        }
      >
        <View style={[
          styles.contentContainer,
          { paddingBottom: isSelectionMode ? 80 : 20 }
        ]}>
          {sortedAndFilteredVideos.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons 
                name="video-off-outline" 
                size={48} 
                color={currentTheme.textSecondary} 
              />
              <Text style={styles.emptyStateText}>
                {searchQuery 
                  ? t.noVideosMatchSearch
                  : selectedCategory !== 'all'
                    ? t.noVideosInCategory
                    : t.noVideosFound}
              </Text>
            </View>
          ) : (
            <View style={viewMode === 'grid' ? styles.gridContainer : styles.listContainer}>
              {sortedAndFilteredVideos.map((video, index) => renderVideoCard(video, index))}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* Selection Mode Bar */}
      <AnimatePresence>
        {isSelectionMode && (
          <MotiView
            from={{ translateY: 60 }}
            animate={{ translateY: 0 }}
            exit={{ translateY: 60 }}
            style={styles.selectionBar}
          >
            <Text style={[styles.title, { fontSize: 16 }]}>
              {selectedVideos.length} selected
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => {
                  setSelectedVideos([]);
                  setIsSelectionMode(false);
                }}
              >
                <Ionicons name="close" size={24} color={currentTheme.text} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: '#ff4444' }]}
                onPress={handleBatchDelete}
              >
                <Ionicons name="trash" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </MotiView>
        )}
      </AnimatePresence>
    </View>
  );
}