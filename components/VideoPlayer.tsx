import React, { useRef, useEffect, useState, useCallback, forwardRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { Video, AVPlaybackStatus, ResizeMode } from 'expo-av';
import { videoService, VideoMetadata } from '../services/videoService';
import { logger } from '../utils/logger';
import { getMetadata } from '../utils/videoProcessor';

interface VideoPlayerProps {
  videoId: string;
  uri: string;
  style?: any;
  onError?: (error: Error) => void;
  autoPlay?: boolean;
  showControls?: boolean;
  resizeMode?: ResizeMode;
  onPlaybackStatusUpdate?: (status: AVPlaybackStatus) => void;
}

interface VideoLoadingStatus {
  isLoaded: boolean;
  error: Error | null;
}

const MAX_METADATA_LOAD_ATTEMPTS = 3;
const METADATA_LOAD_RETRY_DELAY = 1000; // 1 second

export const VideoPlayer = forwardRef<Video, VideoPlayerProps>((props, ref) => {
  const {
    videoId,
    uri,
    style,
    onError,
    autoPlay = false,
    resizeMode = ResizeMode.CONTAIN,
    onPlaybackStatusUpdate
  } = props;

  const [isLoading, setIsLoading] = useState(true);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [timeDisplay, setTimeDisplay] = useState<string>('');
  const [videoStatus, setVideoStatus] = useState<VideoLoadingStatus>({
    isLoaded: false,
    error: null
  });
  
  const internalVideoRef = useRef<Video>(null);
  const videoReference = (ref || internalVideoRef) as React.RefObject<Video>;
  const setupAttempts = useRef(0);
  const metadataLoadAttempts = useRef(0);

  // Add formatTimeRange function
 
  // Enhanced metadata loading with retries
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        logger.debug('VideoPlayer', 'Starting metadata load attempt', { 
          videoId, 
          uri,
          attempt: metadataLoadAttempts.current + 1 
        });
        
        const startTime = Date.now();
        
        // Try to load metadata from both sources
        const [serviceMeta, localMeta] = await Promise.all([
          videoService.getVideoMetadata(videoId),
          getMetadata(uri)
        ]);

        const loadTime = Date.now() - startTime;
        logger.info('VideoPlayer', 'Metadata load timing', {
          loadTimeMs: loadTime,
          hasServiceMeta: !!serviceMeta,
          hasLocalMeta: !!localMeta?.endTime
        });

        // Validate metadata
        if (serviceMeta) {
          logger.info('VideoPlayer', 'Using service metadata', { 
            serviceMeta,
            videoId,
            currentTime: Date.now()
          });
          setMetadata(serviceMeta);
          
          return true;
        } 
        
        if (localMeta?.endTime) {
          logger.info('VideoPlayer', 'Using local metadata', { 
            localMeta,
            videoId,
            currentTime: Date.now()
          });
          const meta = {
            startTime: localMeta.startTime,
            endTime: localMeta.endTime,
            duration: localMeta.endTime - localMeta.startTime,
            id: videoId,
            uri: uri
          };
          setMetadata(meta);
          
          return true;
        }

        // No valid metadata found
        logger.warn('VideoPlayer', 'No valid metadata found', { 
          videoId,
          serviceMeta,
          localMeta,
          currentTime: Date.now()
        });
        
        // If we've tried enough times, use default values
        if (metadataLoadAttempts.current >= MAX_METADATA_LOAD_ATTEMPTS - 1) {
          const defaultMeta = {
            startTime: 0,
            endTime: Number.MAX_SAFE_INTEGER,
            duration: 0,
            id: videoId,
            uri: uri
          };
          setMetadata(defaultMeta);
          
          return true;
        }
        
        return false;
      } catch (err) {
        logger.error('VideoPlayer', 'Failed to load metadata', { 
          error: err, 
          videoId,
          attempt: metadataLoadAttempts.current + 1
        });
        return false;
      }
    };

    const attemptMetadataLoad = async () => {
      while (metadataLoadAttempts.current < MAX_METADATA_LOAD_ATTEMPTS) {
        const success = await loadMetadata();
        if (success) return;
        
        metadataLoadAttempts.current++;
        if (metadataLoadAttempts.current < MAX_METADATA_LOAD_ATTEMPTS) {
          logger.info('VideoPlayer', 'Retrying metadata load', {
            attempt: metadataLoadAttempts.current + 1,
            videoId
          });
          await new Promise(resolve => setTimeout(resolve, METADATA_LOAD_RETRY_DELAY));
        }
      }
    };

    // Reset attempts counter when video changes
    metadataLoadAttempts.current = 0;
    attemptMetadataLoad();
  }, [videoId, uri, ]);

  // Handle initial video loading
  const handleLoad = useCallback(async (status: AVPlaybackStatus) => {
    logger.debug('VideoPlayer', 'Video load status received', { 
      status,
      hasMetadata: !!metadata,
      videoId 
    });
    
    if (!status.isLoaded) {
      logger.error('VideoPlayer', 'Video failed to load', { 
        status,
        videoId,
        currentTime: Date.now()
      });
      setVideoStatus({
        isLoaded: false,
        error: new Error('Failed to load video')
      });
      return;
    }

    logger.info('VideoPlayer', 'Video loaded successfully', {
      videoId,
      currentTime: Date.now(),
      hasMetadata: !!metadata
    });
    
    setVideoStatus({
      isLoaded: true,
      error: null
    });

    // Only set up video if it's successfully loaded
    if (metadata && videoReference.current) {
      try {
        const initialPosition = metadata.startTime * 1000;
        logger.debug('VideoPlayer', 'Setting initial position', { 
          initialPosition,
          videoId,
          currentTime: Date.now()
        });
        
        await videoReference.current.setStatusAsync({
          shouldPlay: autoPlay,
          positionMillis: initialPosition,
          isLooping: false
        });
        
        logger.info('VideoPlayer', 'Video setup complete', {
          autoPlay,
          initialPosition,
          videoId,
          currentTime: Date.now()
        });
      } catch (err) {
        logger.error('VideoPlayer', 'Failed to setup video', { 
          error: err,
          videoId,
          currentTime: Date.now()
        });
        if (onError) onError(err as Error);
      }
    }
  }, [metadata, autoPlay, onError, videoId]);

  // Handle playback status updates
  const handlePlaybackStatus = useCallback(async (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      logger.warn('VideoPlayer', 'Received unloaded status update', {
        videoId,
        currentTime: Date.now()
      });
      return;
    }

    try {
      setIsLoading(false);

      // If we have metadata and video is loaded, enforce trim points
      if (metadata && videoStatus.isLoaded) {
        const currentPos = status.positionMillis / 1000;
        logger.debug('VideoPlayer', 'Playback position check', { 
          currentPos,
          startTime: metadata.startTime,
          endTime: metadata.endTime,
          videoId,
          currentTime: Date.now()
        });

        // Handle end of trimmed section
        if (currentPos >= metadata.endTime) {
          logger.info('VideoPlayer', 'Reached end of trim, resetting', {
            currentPos,
            endTime: metadata.endTime,
            videoId
          });
          await videoReference.current?.pauseAsync();
          await videoReference.current?.setPositionAsync(metadata.startTime * 1000);
        }

        // Handle if video somehow plays before start time
        if (currentPos < metadata.startTime) {
          logger.info('VideoPlayer', 'Position before start, correcting', {
            currentPos,
            startTime: metadata.startTime,
            videoId
          });
          await videoReference.current?.setPositionAsync(metadata.startTime * 1000);
        }
      }

      // Pass status to parent if needed
      if (onPlaybackStatusUpdate) {
        onPlaybackStatusUpdate(status);
      }
    } catch (err) {
      logger.error('VideoPlayer', 'Playback error', { 
        error: err,
        videoId,
        currentTime: Date.now()
      });
      if (onError) onError(err as Error);
    }
  }, [metadata, videoStatus.isLoaded, onPlaybackStatusUpdate, onError, videoId]);

  // Reset loading state when uri changes
  useEffect(() => {
    logger.debug('VideoPlayer', 'URI changed, resetting state', { uri });
    setIsLoading(true);
    setVideoStatus({ isLoaded: false, error: null });
    setupAttempts.current = 0;
  }, [uri]);

  return (
    <View style={[styles.container, style]}>
      <Video
        ref={videoReference}
        source={{ uri }}
        style={styles.video}
        resizeMode={resizeMode}
        onPlaybackStatusUpdate={handlePlaybackStatus}
        onLoad={handleLoad}
        useNativeControls={false}
        shouldPlay={false}
      />
      
      {(isLoading || !videoStatus.isLoaded) && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFF" />
        </View>
      )}

      {timeDisplay && (
        <View style={styles.timeDisplay}>
          <Text style={styles.timeText}>{timeDisplay}</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
    width: '100%',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  timeDisplay: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
    borderRadius: 8,
  },
  timeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  }
}); 