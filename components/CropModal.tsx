import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  Dimensions,
  PanResponder,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  Share,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import * as VideoThumbnails from "expo-video-thumbnails";
import * as FileSystem from "expo-file-system";
import {  useThemeStore, themeTemplates } from '../stores/useThemeStore';
import { DatabaseService } from '../services/database';
import { generateUUID } from '../utils/helpers';
import { useLanguageStore, translations } from '../stores/useLanguageStore';

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface CropModalProps {
  isVisible: boolean;
  onClose: () => void;
  videoUri: string;
  onCropComplete: (startTime: number, endTime: number, title: string, description: string, categoryId: string) => void;
}

interface VideoMetadata {
  uri: string;
  startTime: number;
  endTime: number;
  duration: number;
}

export default function CropModal({ isVisible, onClose, videoUri, onCropComplete }: CropModalProps) {
  const [step, setStep] = useState(2);
  const [caption, setCaption] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(5);
  const [progressStart, setProgressStart] = useState(0);
  const [progressEnd, setProgressEnd] = useState(20);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<Video | null>(null);
  const sliderWidth = Dimensions.get("window").width - 48;

  const SEGMENT_DURATION = 5; // Maximum segment duration
  const MIN_DURATION = 1; // Minimum segment duration

  // Add state for tracking segment dragging
  const [isDraggingSegment, setIsDraggingSegment] = useState(false);
  const [segmentOffset, setSegmentOffset] = useState(0);

  // Add trimming slider state
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Add preview state
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Add progress animation state
  const progressAnimation = useRef(new Animated.Value(0)).current;

  // Add thumbnail state
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [showThumbnail, setShowThumbnail] = useState(false);
  const [thumbnailPosition, setThumbnailPosition] = useState(0);

  // Add title state
  const [title, setTitle] = useState('');

  // Add loading state
  const [isProcessing, setIsProcessing] = useState(false);

  const { isDarkMode, template } = useThemeStore();
  const currentTheme = themeTemplates[template][isDarkMode ? 'dark' : 'light'];

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Add new state
  const [processingState, setProcessingState] = useState<'idle' | 'processing' | 'ready'>('idle');
  const [processedVideo, setProcessedVideo] = useState<VideoMetadata | null>(null);

  // Add new validation state
  const [errors, setErrors] = useState({
    title: '',
    description: '',
    category: ''
  });

  // Add character limits
  const TITLE_MAX_LENGTH = 50;
  const DESCRIPTION_MAX_LENGTH = 200;

  const { language } = useLanguageStore();
  const t = translations[language];

  // Update validateInputs function
  const validateInputs = () => {
    const newErrors = {
      title: '',
      description: '',
      category: ''
    };

    if (!title.trim()) {
      newErrors.title = t.titleRequired;
    } else if (title.length > TITLE_MAX_LENGTH) {
      newErrors.title = t.titleMaxLength.replace('{0}', TITLE_MAX_LENGTH.toString());
    }

    if (description.length > DESCRIPTION_MAX_LENGTH) {
      newErrors.description = t.descriptionMaxLength.replace('{0}', DESCRIPTION_MAX_LENGTH.toString());
    }

    if (!selectedCategory) {
      newErrors.category = t.pleaseSelectCategory;
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error !== '');
  };

  // Handle close and reset
  const handleClose = () => {
    setStep(2);
    setCaption("");
    setDescription("");
    onClose();
  };

  // Load video duration and set initial times
  const onVideoLoad = (data: any) => {
    if (data?.durationMillis) {
      const totalDuration = data.durationMillis / 1000;
      setDuration(totalDuration);
      // Set initial 5-second window at start
      setStartTime(0);
      setEndTime(SEGMENT_DURATION);
      setProgressStart(0);
      setProgressEnd((SEGMENT_DURATION / totalDuration) * 100);
    }
  };

  // Format time (mm:ss)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Drag End Time (White Handle) - allows shortening
  const endPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gestureState) => {
      const newEndPosition = Math.max(
        // Can't go before start point + minimum duration
        progressStart + (MIN_DURATION / duration * 100),
        Math.min(
          // Can't go beyond start point + maximum duration
          progressStart + (SEGMENT_DURATION / duration * 100),
          (gestureState.moveX / sliderWidth) * 100
        )
      );

      setProgressEnd(newEndPosition);
      setEndTime(Math.round((newEndPosition / 100) * duration));
    },
  });

  // Drag Start Time (Blue Handle) - maintains maximum duration
  const startPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gestureState) => {
      const newStartPosition = Math.max(
        0,
        Math.min(
          // Can't go beyond end point - minimum duration
          progressEnd - (MIN_DURATION / duration * 100),
          (gestureState.moveX / sliderWidth) * 100
        )
      );

      setProgressStart(newStartPosition);
      setStartTime(Math.round((newStartPosition / 100) * duration));
    },
  });

  // Create pan responder for the segment (middle area)
  const segmentPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (_, gestureState) => {
      setIsDraggingSegment(true);
      setSegmentOffset(0);
    },
    onPanResponderMove: (_, gestureState) => {
      const segmentWidth = progressEnd - progressStart;
      const movePercent = (gestureState.moveX / sliderWidth) * 100;
      const delta = movePercent - segmentOffset;
      
      // Calculate new positions maintaining segment width
      let newStart = Math.max(0, Math.min(100 - segmentWidth, progressStart + delta));
      let newEnd = newStart + segmentWidth;

      setProgressStart(newStart);
      setProgressEnd(newEnd);
      setStartTime(Math.round((newStart / 100) * duration));
      setEndTime(Math.round((newEnd / 100) * duration));
      setSegmentOffset(movePercent);
    },
    onPanResponderRelease: () => {
      setIsDraggingSegment(false);
    },
  });

  // Handle video playback status
  const handlePlaybackStatus = async (status: any) => {
    if (status.isLoaded) {
      const currentPos = status.positionMillis / 1000;
      setCurrentTime(currentPos);
      
      // Update progress indicator
      const progress = ((currentPos - startTime) / (endTime - startTime)) * 100;
      progressAnimation.setValue(progress);
      
      // Handle preview mode looping
      if (isPreviewMode && currentPos >= endTime) {
        await videoRef.current?.setPositionAsync(startTime * 1000);
        if (isPlaying) {
          await videoRef.current?.playAsync();
        }
      }
      // Normal mode - stop at end
      else if (!isPreviewMode && currentPos >= endTime) {
        setIsPlaying(false);
        await videoRef.current?.pauseAsync();
      }
    }
  };

  // Toggle preview mode
  const togglePreview = async () => {
    setIsPreviewMode(!isPreviewMode);
    setIsPlaying(false);
    await videoRef.current?.setPositionAsync(startTime * 1000);
  };

  // Enhanced play/pause handler
  const handlePlayPause = async () => {
    if (videoRef.current) {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.setPositionAsync(startTime * 1000);
        await videoRef.current.playAsync();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Update the thumbnail generation function
  const generateThumbnails = async () => {
    try {
      if (!duration || duration <= 0) return;

      const thumbnailCount = 5;
      const newThumbnails = [];
      const interval = Math.max(1, Math.floor(duration / thumbnailCount));
      
      for (let i = 0; i < thumbnailCount; i++) {
        // Ensure we don't exceed video duration
        const time = Math.min(
          Math.floor(interval * i),
          Math.floor(duration - 1)
        );
        
        try {
          const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
            time: time * 1000, // Convert to milliseconds
            quality: 0.5,
          });
          newThumbnails.push(uri);
        } catch (innerError) {
          console.log(`Failed to generate thumbnail at ${time}s:`, innerError);
          // Continue with other thumbnails even if one fails
          continue;
        }
      }
      
      if (newThumbnails.length > 0) {
        setThumbnails(newThumbnails);
      }
    } catch (error) {
      console.error('Error in thumbnail generation:', error);
    }
  };

  // Handle slider touch
  const handleTrimTouch = (event: any) => {
    const { locationX } = event.nativeEvent;
    const position = (locationX / sliderWidth) * 100;
    setThumbnailPosition(position);
    setShowThumbnail(true);
  };

  // Update the useEffect to handle thumbnail generation
  useEffect(() => {
    let isMounted = true;

    const initThumbnails = async () => {
      if (duration > 0 && videoUri) {
        await generateThumbnails();
      }
    };

    initThumbnails();

    return () => {
      isMounted = false;
    };
  }, [duration, videoUri]);

  useEffect(() => {
    if (isVisible) {
      setStep(2);
    }
  }, [isVisible]);

  // Handle trim button press
  const handleTrimPress = () => {
    setStep(3); // Move to details step
  };

  // Load categories when modal opens
  useEffect(() => {
    if (isVisible) {
      loadCategories();
    }
  }, [isVisible]);

  const loadCategories = async () => {
    try {
      const cats = await DatabaseService.getCategories();
      setCategories(cats as Category[]);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  // Add new helper functions
  const saveVideoMetadata = async (metadata: VideoMetadata) => {
    try {
      const metadataDir = `${FileSystem.documentDirectory}metadata/`;
      const metadataFile = `${metadataDir}${generateUUID()}.json`;
      
      await FileSystem.makeDirectoryAsync(metadataDir, { intermediates: true });
      await FileSystem.writeAsStringAsync(metadataFile, JSON.stringify(metadata));
      
      return metadataFile;
    } catch (error) {
      console.error('Failed to save video metadata:', error);
      throw error;
    }
  };

  // Update handleSave to include validation
  const handleSave = async () => {
    if (!validateInputs()) {
      return;
    }

    try {
      setIsProcessing(true);
      
      // Create metadata for the trimmed video
      const metadata: VideoMetadata = {
        uri: videoUri,
        startTime,
        endTime,
        duration: endTime - startTime
      };

      // Save metadata
      const metadataFile = await saveVideoMetadata(metadata);

      // Pass metadata to parent
      onCropComplete(
        startTime,
        endTime,
        title.trim(),
        description.trim(),
        selectedCategory
      );

      handleClose();
    } catch (error) {
      console.error('Failed to process video:', error);
      Alert.alert('Error', 'Failed to process video. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Add share functionality
  const handleShare = async () => {
    try {
      setProcessingState('processing');
      
      // Create a temporary file with metadata for sharing
      const shareData = {
        title,
        description,
        videoUri,
        startTime,
        endTime
      };
      
      const shareFile = `${FileSystem.cacheDirectory}share_${generateUUID()}.json`;
      await FileSystem.writeAsStringAsync(shareFile, JSON.stringify(shareData));
      
      // Share the metadata file
      await Share.share({
        url: shareFile,
        title: title || 'Shared Video',
        message: `Check out my video: ${title}\n${description || ''}`
      });
      
      // Clean up
      await FileSystem.deleteAsync(shareFile, { idempotent: true });
    } catch (error) {
      console.error('Failed to share video:', error);
      Alert.alert('Error', 'Failed to share video. Please try again.');
    } finally {
      setProcessingState('idle');
    }
  };

  return (
    <Modal visible={isVisible} animationType="slide">
      <View style={styles.container}>
        {/* Header with safe area padding */}
        <View style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerText}>
              {step === 2 ? t.createSegment : t.addDetails}
            </Text>
            <View style={{ width: 32 }} />
          </View>
        </View>

        {/* Video Preview */}
        <View style={styles.videoContainer}>
          <Video
            ref={videoRef}
            source={{ uri: videoUri }}
            style={{ height: 300 }}
            resizeMode={ResizeMode.CONTAIN}
            onLoad={onVideoLoad}
            onPlaybackStatusUpdate={handlePlaybackStatus}
          />
        </View>

        {isProcessing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={currentTheme.text} />
            <Text style={styles.loadingText}>{t.processingVideo}</Text>
          </View>
        ) : step === 2 ? (
          <View style={styles.trimContainer}>
            {/* Thumbnail Preview */}
            {showThumbnail && thumbnails.length > 0 && (
              <Animated.View
                style={[
                  styles.thumbnailPreview,
                  {
                    left: `${thumbnailPosition}%`,
                    transform: [{ translateX: -40 }], // Half of thumbnail width
                  },
                ]}
              >
                <Image
                  source={{ uri: thumbnails[Math.floor((thumbnailPosition / 100) * thumbnails.length)] }}
                  style={styles.thumbnail}
                />
              </Animated.View>
            )}

            {/* Trim Controls with touch handler */}
            <View 
              style={styles.trimSlider}
              onTouchStart={handleTrimTouch}
              onTouchMove={handleTrimTouch}
              onTouchEnd={() => setShowThumbnail(false)}
            >
              <View
                style={[
                  styles.trimSegment,
                  {
                    left: `${progressStart}%`,
                    width: `${progressEnd - progressStart}%`,
                  },
                ]}
                {...segmentPanResponder.panHandlers}
              />
              
              {/* Progress Indicator */}
              <Animated.View
                style={[
                  styles.progressIndicator,
                  {
                    left: progressAnimation.interpolate({
                      inputRange: [0, 100],
                      outputRange: [`${progressStart}%`, `${progressEnd}%`],
                    }),
                  },
                ]}
              />
              
              <View
                style={[styles.trimHandle, { left: `${progressStart}%` }]}
                {...startPanResponder.panHandlers}
              />
              <View
                style={[styles.trimHandle, { left: `${progressEnd}%` }]}
                {...endPanResponder.panHandlers}
              />
            </View>

            {/* Time Display */}
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(startTime)}</Text>
              <Text style={styles.timeText}>{formatTime(endTime)}</Text>
            </View>

            {/* Preview Toggle */}
            <TouchableOpacity 
              style={styles.previewButton} 
              onPress={togglePreview}
            >
              <Ionicons 
                name={isPreviewMode ? "repeat" : "play-skip-forward"} 
                size={24} 
                color="white" 
              />
              <Text style={styles.previewText}>
                {isPreviewMode ? t.previewMode : t.singlePlay}
              </Text>
            </TouchableOpacity>

            {/* Playback Controls */}
            <View style={styles.controlsRow}>
              <TouchableOpacity style={styles.playButton} onPress={handlePlayPause}>
                <Ionicons 
                  name={isPlaying ? "pause-circle" : "play-circle"} 
                  size={48} 
                  color="white" 
                />
              </TouchableOpacity>
            </View>

            {/* Confirm Button */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={styles.nextButton}
                onPress={handleTrimPress}
              >
                <Text style={styles.nextButtonText}>{t.next}</Text>
                <Ionicons name="arrow-forward" size={24} color="white" style={styles.nextIcon} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <ScrollView 
              style={styles.detailsContainer}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t.videoTitle} *</Text>
                <TextInput
                  style={[
                    styles.input,
                    errors.title ? styles.inputError : null
                  ]}
                  placeholder={t.enterVideoTitle}
                  value={title}
                  onChangeText={(text) => {
                    setTitle(text);
                    if (errors.title) {
                      setErrors(prev => ({ ...prev, title: '' }));
                    }
                  }}
                  placeholderTextColor="#666"
                  maxLength={TITLE_MAX_LENGTH}
                />
                {errors.title ? (
                  <Text style={styles.errorText}>{errors.title}</Text>
                ) : (
                  <Text style={styles.characterCount}>
                    {title.length}/{TITLE_MAX_LENGTH} {t.characters}
                  </Text>
                )}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t.videoDescription}</Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.descriptionInput,
                    errors.description ? styles.inputError : null
                  ]}
                  placeholder={t.enterDescription}
                  value={description}
                  onChangeText={(text) => {
                    setDescription(text);
                    if (errors.description) {
                      setErrors(prev => ({ ...prev, description: '' }));
                    }
                  }}
                  multiline
                  placeholderTextColor="#666"
                  maxLength={DESCRIPTION_MAX_LENGTH}
                />
                <Text style={styles.characterCount}>
                  {description.length}/{DESCRIPTION_MAX_LENGTH} {t.characters}
                </Text>
              </View>

              <View style={styles.categoriesContainer}>
                <Text style={styles.inputLabel}>{t.selectCategory} *</Text>
                {errors.category && (
                  <Text style={styles.errorText}>{errors.category}</Text>
                )}
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.categoryScroll}
                >
                  {categories.map(category => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryButton,
                        selectedCategory === category.id && styles.categoryButtonActive,
                        { borderColor: category.color }
                      ]}
                      onPress={() => {
                        setSelectedCategory(category.id);
                        if (errors.category) {
                          setErrors(prev => ({ ...prev, category: '' }));
                        }
                      }}
                    >
                      <Ionicons 
                        name={category.icon as any}
                        size={20}
                        color={selectedCategory === category.id ? '#FFF' : category.color}
                      />
                      <Text style={[
                        styles.categoryText,
                        { color: selectedCategory === category.id ? '#FFF' : '#FFF' }
                      ]}>
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={[
                    styles.saveButton,
                    isProcessing && styles.disabledButton
                  ]}
                  onPress={handleSave}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>{t.saveVideo}</Text>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.shareButton, 
                    { opacity: isProcessing ? 0.5 : 1 }
                  ]}
                  onPress={handleShare}
                  disabled={isProcessing}
                >
                  <Ionicons name="share-outline" size={24} color="#FFF" />
                  <Text style={styles.shareButtonText}>{t.share}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1c1c1e",
  },
  safeArea: {
    paddingTop: Platform.OS === 'ios' ? 44 : 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  closeButton: {
    padding: 8,
  },
  headerText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  videoContainer: {
    width: "100%",
    backgroundColor: "black",
  },
  video: {
    width: "100%",
    aspectRatio: 16 / 9,
  },
  trimContainer: {
    marginTop: 20,
    padding: 16,
  },
  trimSlider: {
    height: 40,
    backgroundColor: '#2c2c2e',
    borderRadius: 8,
    marginVertical: 10,
  },
  trimHandle: {
    position: 'absolute',
    width: 20,
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 4,
  },
  trimSegment: {
    position: 'absolute',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: {
    color: 'white',
    fontSize: 14,
  },
  playButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginTop: 20,
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#0A84FF",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  saveButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginLeft: 12,
  },
  shareButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 8,
  },
  previewText: {
    color: 'white',
    marginLeft: 8,
    fontSize: 14,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  progressIndicator: {
    position: 'absolute',
    width: 2,
    height: '100%',
    backgroundColor: '#0A84FF',
    zIndex: 2,
  },
  thumbnailPreview: {
    position: 'absolute',
    top: -80,
    zIndex: 3,
  },
  thumbnail: {
    width: 80,
    height: 45,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#0A84FF',
  },
  keyboardView: {
    flex: 1,
  },
  detailsContainer: {
    flex: 1,
    padding: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2c2c2e',
    borderRadius: 8,
    padding: 12,
    color: 'white',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: '#ff4444',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 4,
  },
  characterCount: {
    color: '#666',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  descriptionInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  loadingContainer: {
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
    color: '#FFFFFF',
    marginTop: 12,
    fontSize: 16,
  },
  categoriesContainer: {
    marginTop: 16,
    marginBottom: 24,
  },
  categoryScroll: {
    flexGrow: 0,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  categoryText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.5,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: "#0A84FF",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  nextButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    marginRight: 8,
  },
  nextIcon: {
    marginLeft: 4,
  },
});

