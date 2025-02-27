import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Dimensions, Platform, TextInput, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, themeTemplates, themeColors } from '../../stores/useThemeStore';
import { useVideoStore, VideoEntry } from '../../stores/useVideoStore';
import { DatabaseService } from '../../services/database';
import { router } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { CoreMemoryModal } from '../../components/CoreMemoryModal';
import { useLanguageStore, translations } from '../../stores/useLanguageStore';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.8;
const CARD_HEIGHT = CARD_WIDTH * 1.2;

// Separate memory types into default and custom
const DEFAULT_MEMORY_TYPES = [
  { id: 'happy', name: ' Happy', icon: 'happy-outline', color: '#FFB6C1' },
  { id: 'family', name: 'In love', icon: 'heart-outline', color: '#98FB98' },
  { id: 'friends', name: 'Excited', icon: 'flame-outline', color: '#87CEFA' },
  { id: 'achievement', name: 'Successfull', icon: 'trophy-outline', color: '#DDA0DD' },
  { id: 'travel', name: 'Sad', icon: 'sad-outline', color: '#F0E68C' },
];

interface MemoryType {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface CoreMemory {
  videoId: string;
  note: string;
  color: string;
  createdAt: string;
  typeId: string;
}

interface CustomTypeModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: (type: MemoryType) => void;
  theme: any;
  accent: string;
}

const CustomTypeModal = ({ isVisible, onClose, onSave, theme, accent }: CustomTypeModalProps) => {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#FFB6C1');
  const [selectedIcon, setSelectedIcon] = useState('bookmark-outline');

  const iconOptions = [
    'bookmark-outline', 'heart-outline', 'star-outline', 'flag-outline',
    'flame-outline', 'flower-outline', 'leaf-outline', 'planet-outline',
    'diamond-outline', 'ribbon-outline', 'rocket-outline', 'sparkles-outline'
  ];

  const colorOptions = [
    '#FFB6C1', '#ADD8E6', '#98FB98', '#DDA0DD', 
    '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1',
    '#FFA07A', '#87CEEB', '#F0E68C', '#E6E6FA'
  ];

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name for your memory type');
      return;
    }

    const newType: MemoryType = {
      id: 'custom_' + Date.now(),
      name: name.trim(),
      icon: selectedIcon,
      color: selectedColor
    };

    onSave(newType);
    setName('');
    setSelectedColor('#FFB6C1');
    setSelectedIcon('bookmark-outline');
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          style={[styles.modalContainer, { backgroundColor: theme.card }]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
             Create Core Memory
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, color: theme.text }]}
              value={name}
              onChangeText={setName}
              placeholder="Memory Name"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={[styles.sectionLabel, { color: theme.text }]}>
              Select Color
            </Text>
            <View style={styles.colorGrid}>
              {colorOptions.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedColor === color && styles.selectedColor
                  ]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>

            <Text style={[styles.sectionLabel, { color: theme.text }]}>
              Select Icon
            </Text>
            <View style={styles.iconGrid}>
              {iconOptions.map(icon => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconOption,
                    {
                      backgroundColor: theme.bg,
                      borderColor: selectedIcon === icon ? selectedColor : 'transparent'
                    }
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
              style={[styles.saveButton, { backgroundColor: selectedColor }]}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>Create</Text>
            </TouchableOpacity>
          </View>
        </MotiView>
      )}
    </AnimatePresence>
  );
};

export default function CreateCoreMemoryScreen() {
  const { isDarkMode, template, accentColor } = useThemeStore();
  const theme = themeTemplates[template][isDarkMode ? 'dark' : 'light'];
  const accent = themeColors[accentColor].primary;
  const { videos } = useVideoStore();
  const { language } = useLanguageStore();
  const t = translations[language];
  
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [coreMemories, setCoreMemories] = useState<CoreMemory[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoEntry | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showCustomTypeModal, setShowCustomTypeModal] = useState(false);
  const [customTypes, setCustomTypes] = useState<MemoryType[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Check if there are any available videos
  useEffect(() => {
    if (videos.length === 0) {
      Alert.alert(
        t.noMomentsAvailable,
        t.createNewMomentFirst,
        [
          {
            text: t.createNew,
            onPress: () => router.push('/add'),
            style: 'default'
          },
          {
            text: t.cancel,
            style: 'cancel'
          }
        ]
      );
    }
  }, [videos, t]);

  // Load core memories and custom types
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([
        loadCoreMemories(),
        loadCustomTypes()
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
      // Also refresh videos from store
      await useVideoStore.getState().loadVideos();
    } catch (error) {
      console.error('Failed to refresh data:', error);
      Alert.alert('Error', 'Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  const loadCoreMemories = async () => {
    try {
      const memories = await DatabaseService.getCoreMemories() as CoreMemory[];
      setCoreMemories(memories);
    } catch (error) {
      console.error('Failed to load core memories:', error);
    }
  };

  const loadCustomTypes = async () => {
    try {
      const types = await DatabaseService.getCustomMemoryTypes();
      setCustomTypes(types);
    } catch (error) {
      console.error('Failed to load custom types:', error);
    }
  };

  const handleSaveMemory = async (note: string) => {
    if (!selectedVideo || !selectedType) return;

    try {
      const memoryType = [...DEFAULT_MEMORY_TYPES, ...customTypes].find(t => t.id === selectedType);
      if (!memoryType) return;

      const newMemory: CoreMemory = {
        videoId: selectedVideo.id,
        note,
        color: memoryType.color,
        createdAt: new Date().toISOString(),
        typeId: memoryType.id
      };

      await DatabaseService.addCoreMemory(newMemory);
      setCoreMemories(prev => [...prev, newMemory]);
      setShowModal(false);
      setSelectedVideo(null);
    } catch (error) {
      console.error('Failed to save core memory:', error);
    }
  };

  const handleSaveCustomType = async (newType: MemoryType) => {
    try {
      await DatabaseService.addCustomMemoryType(newType);
      setCustomTypes(prev => [...prev, newType]);
      setShowCustomTypeModal(false);
      Alert.alert(t.success, t.changesSaved);
    } catch (error) {
      console.error('Failed to save custom type:', error);
      Alert.alert(t.error, t.error);
    }
  };

  const filteredVideos = selectedType 
    ? videos.filter(v => !coreMemories.some(m => m.videoId === v.id))
    : [];

  const allMemoryTypes = [...DEFAULT_MEMORY_TYPES, ...customTypes];

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <BlurView
        intensity={isDarkMode ? 30 : 50}
        tint={isDarkMode ? 'dark' : 'light'}
        style={styles.header}
      >
        <Text style={[styles.title, { color: theme.text }]}>
          {t.createCoreMemory}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {t.transformMoments}
        </Text>
      </BlurView>

      {videos.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <Ionicons 
            name="videocam-outline" 
            size={64} 
            color={theme.textSecondary} 
          />
          <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
            {t.noMomentsAvailable}
          </Text>
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: accent }]}
            onPress={() => router.push('/add')}
          >
            <Text style={styles.createButtonText}>
              {t.createNew}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.text}
              colors={[accent]}
              progressBackgroundColor={theme.card}
            />
          }
        >
          {/* Memory Types Grid */}
          <View style={styles.categoriesGrid}>
            {allMemoryTypes.map((type, index) => (
              <MotiView
                key={type.id}
                from={{ opacity: 0, scale: 0.8, translateY: 20 }}
                animate={{ opacity: 1, scale: 1, translateY: 0 }}
                transition={{ type: 'spring', delay: index * 100 }}
              >
                <TouchableOpacity
                  style={[
                    styles.categoryCard,
                    { 
                      backgroundColor: selectedType === type.id ? type.color : theme.card,
                      borderColor: type.color,
                    }
                  ]}
                  onPress={() => setSelectedType(type.id)}
                >
                  <Ionicons 
                    name={type.icon as any} 
                    size={32} 
                    color={selectedType === type.id ? '#FFF' : type.color} 
                  />
                  <Text style={[
                    styles.categoryName,
                    { color: selectedType === type.id ? '#FFF' : theme.text }
                  ]}>
                    {type.name}
                  </Text>
                </TouchableOpacity>
              </MotiView>
            ))}

            {/* Add Custom Type Button */}
            <MotiView
              from={{ opacity: 0, scale: 0.8, translateY: 20 }}
              animate={{ opacity: 1, scale: 1, translateY: 0 }}
              transition={{ type: 'spring', delay: allMemoryTypes.length * 100 }}
            >
              <TouchableOpacity
                style={[
                  styles.categoryCard,
                  { 
                    backgroundColor: theme.card,
                    borderColor: accent,
                    borderStyle: 'dashed'
                  }
                ]}
                onPress={() => setShowCustomTypeModal(true)}
              >
                <Ionicons 
                  name="add-circle-outline" 
                  size={32} 
                  color={accent}
                />
                <Text style={[styles.categoryName, { color: theme.text }]}>
                  {t.createCustomType}
                </Text>
              </TouchableOpacity>
            </MotiView>
          </View>

          {/* Available Videos */}
          {selectedType && (
            <View style={styles.videosSection}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {t.selectMoment}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.videosList}
                decelerationRate="fast"
                snapToInterval={CARD_WIDTH + 20}
              >
                {filteredVideos.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
                    <Ionicons name="videocam-outline" size={48} color={theme.textSecondary} />
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                      {t.noAvailableVideos}
                      {'\n'}
                      {t.recordNewMoments}
                    </Text>
                  </View>
                ) : (
                  filteredVideos.map((video, index) => (
                    <MotiView
                      key={video.id}
                      from={{ opacity: 0, scale: 0.9, translateX: 50 }}
                      animate={{ opacity: 1, scale: 1, translateX: 0 }}
                      transition={{ delay: index * 100 }}
                    >
                      <TouchableOpacity
                        style={[styles.videoCard, { backgroundColor: theme.card }]}
                        onPress={() => {
                          setSelectedVideo(video);
                          setShowModal(true);
                        }}
                      >
                        <Image
                          source={{ uri: video.thumbnail }}
                          style={styles.thumbnail}
                        />
                        <LinearGradient
                          colors={['transparent', 'rgba(0,0,0,0.8)']}
                          style={styles.gradient}
                        >
                          <Text style={styles.videoTitle} numberOfLines={2}>
                            {video.title}
                          </Text>
                          <Text style={styles.videoDate}>
                            {new Date(video.createdAt).toLocaleDateString()}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </MotiView>
                  ))
                )}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      )}

      {/* Core Memory Modal */}
      <CoreMemoryModal
        isVisible={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedVideo(null);
        }}
        onSave={handleSaveMemory}
        videoTitle={selectedVideo?.title || ''}
      />

      {/* Custom Type Modal */}
      <CustomTypeModal
        isVisible={showCustomTypeModal}
        onClose={() => setShowCustomTypeModal(false)}
        onSave={handleSaveCustomType}
        theme={theme}
        accent={accent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Noteworthy-Bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Noteworthy',
    opacity: 0.8,
  },
  content: {
    flex: 1,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    gap: 16,
  },
  categoryCard: {
    width: (width - 56) / 2,
    aspectRatio: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
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
  categoryName: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'Noteworthy',
    textAlign: 'center',
  },
  videosSection: {
    marginTop: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 24,
    fontFamily: 'Noteworthy-Bold',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  videosList: {
    paddingHorizontal: 20,
    gap: 20,
  },
  videoCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
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
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    justifyContent: 'flex-end',
    padding: 20,
  },
  videoTitle: {
    color: '#FFF',
    fontSize: 20,
    fontFamily: 'Noteworthy-Bold',
    marginBottom: 8,
  },
  videoDate: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Noteworthy',
    opacity: 0.8,
  },
  emptyCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'Noteworthy',
    textAlign: 'center',
    lineHeight: 24,
  },
  modalContainer: {
    position: 'absolute',
    top: '10%',
    left: 20,
    right: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalContent: {
    gap: 16,
  },
  input: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
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
  },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
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
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
    fontFamily: 'Noteworthy',
  },
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Noteworthy-Bold',
  },
}); 