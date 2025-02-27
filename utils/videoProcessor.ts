import * as VideoThumbnails from 'expo-video-thumbnails';
import { FileManager } from './fileManager';
import * as FileSystem from 'expo-file-system';
import { videoService } from '../services/videoService';
import { logger } from './logger';
import { Video, AVPlaybackStatus } from 'expo-av';
import { generateUUID } from './helpers';

// Store metadata alongside video files
const saveMetadata = async (videoUri: string, startTime: number, endTime: number) => {
  try {
    logger.debug('saveMetadata', 'Saving metadata file', { videoUri, startTime, endTime });
    const metaPath = videoUri + '.meta';
    
    // Check if directory exists
    const dirPath = videoUri.substring(0, videoUri.lastIndexOf('/'));
    const dirInfo = await FileSystem.getInfoAsync(dirPath);
    if (!dirInfo.exists) {
      logger.info('saveMetadata', 'Creating directory', { dirPath });
      await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
    }

    // Write metadata
    await FileSystem.writeAsStringAsync(metaPath, JSON.stringify({ startTime, endTime }));
    logger.info('saveMetadata', 'Successfully saved metadata file', { metaPath });
  } catch (error) {
    logger.error('saveMetadata', 'Failed to save metadata', { error, videoUri });
    throw error;
  }
};

// Read metadata for a video
export const getMetadata = async (videoUri: string) => {
  try {
    logger.debug('getMetadata', 'Reading metadata file', { videoUri });
    const metaPath = videoUri + '.meta';
    
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(metaPath);
    if (!fileInfo.exists) {
      logger.warn('getMetadata', 'Metadata file does not exist', { metaPath });
      return { startTime: 0, endTime: null };
    }

    const data = await FileSystem.readAsStringAsync(metaPath);
    const parsed = JSON.parse(data);
    logger.info('getMetadata', 'Successfully read metadata', { parsed });
    return parsed;
  } catch (error) {
    logger.error('getMetadata', 'Failed to read metadata', { error, videoUri });
    return { startTime: 0, endTime: null };
  }
};

interface ThumbnailError extends Error {
  code?: string;
}

export const generateThumbnail = async (videoUri: string, timestamp: number = 0): Promise<string> => {
  const thumbnailDir = `${FileSystem.documentDirectory}thumbnails`;
  
  try {
    logger.debug('generateThumbnail', 'Starting thumbnail generation', { videoUri, timestamp });

    // Ensure thumbnail directory exists
    await FileSystem.makeDirectoryAsync(thumbnailDir, { intermediates: true })
      .catch((err: ThumbnailError) => {
        if (err.code !== 'E_DIR_EXISTS') throw err;
      });

    // Generate thumbnail using expo-video-thumbnails
    const { uri: tempUri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time: timestamp * 1000,
      quality: 0.7,
    });

    // Save to final location
    const thumbnailFilename = `${Date.now()}_${generateUUID()}.jpg`;
    const thumbnailUri = `${thumbnailDir}/${thumbnailFilename}`;

    // Copy with retry logic
    const maxRetries = 3;
    let lastError: ThumbnailError | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        await FileSystem.copyAsync({
          from: tempUri,
          to: thumbnailUri
        });
        
        // Verify file exists
        const fileInfo = await FileSystem.getInfoAsync(thumbnailUri);
        if (!fileInfo.exists) {
          throw new Error('Thumbnail file not found after copy');
        }

        logger.info('generateThumbnail', 'Thumbnail generated successfully', {
          videoUri,
          thumbnailUri
        });

        return thumbnailUri;
      } catch (err) {
        lastError = err as ThumbnailError;
        logger.warn('generateThumbnail', `Copy attempt ${i + 1} failed`, { 
          error: err,
          attempt: i + 1 
        });
        
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
        }
      }
    }

    throw lastError || new Error('Failed to copy thumbnail');
  } catch (error) {
    const thumbError = error as ThumbnailError;
    logger.error('generateThumbnail', 'Thumbnail generation failed', {
      error: {
        code: thumbError.code || 'UNKNOWN',
        message: thumbError.message
      },
      videoUri
    });
    throw thumbError;
  } finally {
    // Clean up any temporary files
    try {
      const tempFiles = await FileSystem.readDirectoryAsync(thumbnailDir);
      const oldFiles = tempFiles.filter(file => {
        const fileTime = parseInt(file.split('_')[0]);
        return Date.now() - fileTime > 24 * 60 * 60 * 1000; // Older than 24 hours
      });

      await Promise.all(
        oldFiles.map(file => 
          FileSystem.deleteAsync(`${thumbnailDir}/${file}`, { idempotent: true })
        )
      );
    } catch (err) {
      logger.warn('generateThumbnail', 'Failed to cleanup old thumbnails', { 
        error: err 
      });
    }
  }
};

export const processVideo = async (sourceUri: string, startTime: number, endTime: number, videoId: string): Promise<{uri: string}> => {
  try {
    logger.debug('processVideo', 'Starting video processing', { 
      sourceUri, startTime, endTime, videoId 
    });

    // Save video and get final path
    const finalUri = await FileManager.saveVideo(sourceUri);
    
    // Extract directory path for metadata
    const videoDir = finalUri.substring(0, finalUri.lastIndexOf('/'));
    
    // Ensure metadata directory exists
    await FileSystem.makeDirectoryAsync(videoDir, { intermediates: true });
    
    // Save metadata with verified paths
    const metadataPath = `${videoDir}/${videoId}.meta`;
    
    // Save both metadata with retries
    let saved = false;
    let attempts = 0;
    
    while (!saved && attempts < 3) {
      try {
        await Promise.all([
          // Local metadata
          FileSystem.writeAsStringAsync(
            metadataPath,
            JSON.stringify({ startTime, endTime })
          ),
          // Service metadata
          videoService.saveVideoMetadata({
            id: videoId,
            uri: finalUri,
            startTime,
            endTime,
            duration: endTime - startTime
          })
        ]);
        saved = true;
        logger.info('processVideo', 'Metadata saved successfully', {
          metadataPath,
          videoId
        });
      } catch (error) {
        attempts++;
        logger.warn('processVideo', 'Metadata save attempt failed', {
          attempt: attempts,
          error
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!saved) {
      throw new Error('Failed to save metadata after 3 attempts');
    }

    // Verify metadata is readable
    const verifyMetadata = await getMetadata(finalUri);
    if (!verifyMetadata?.endTime) {
      throw new Error('Metadata verification failed');
    }

    return { uri: finalUri };
  } catch (error) {
    logger.error('processVideo', 'Video processing failed', {
      error,
      sourceUri,
      videoId
    });
    throw error;
  }
};

/**
 * FFmpeg implementation of video trimming - REQUIRES EJECTING FROM EXPO GO
 * To use this:
 * 1. Eject from Expo Go
 * 2. Install required packages:
 *    - npm install react-native-ffmpeg
 *    - npm install @react-native-community/slider
 * 3. Uncomment the code below and replace the current processVideo function
 */

/*
import { RNFFmpeg } from 'react-native-ffmpeg';

export const trimVideoWithFFmpeg = async (
  sourceUri: string, 
  startTime: number, 
  endTime: number, 
  videoId: string
): Promise<{uri: string}> => {
  try {
    logger.debug('trimVideoWithFFmpeg', 'Starting FFmpeg trim', { 
      sourceUri, startTime, endTime, videoId 
    });

    // Create output path
    const outputUri = `${FileSystem.documentDirectory}videos/${videoId}.mp4`;
    const outputDir = outputUri.substring(0, outputUri.lastIndexOf('/'));
    
    // Ensure directory exists
    const dirInfo = await FileSystem.getInfoAsync(outputDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(outputDir, { intermediates: true });
    }

    // FFmpeg command for trimming
    // -ss: start time
    // -t: duration (endTime - startTime)
    // -c copy: copy streams without re-encoding (fast)
    const duration = endTime - startTime;
    const command = `-ss ${startTime} -t ${duration} -i "${sourceUri}" -c copy "${outputUri}"`;

    logger.debug('trimVideoWithFFmpeg', 'Executing FFmpeg command', { command });
    
    // Execute FFmpeg command
    const result = await RNFFmpeg.execute(command);
    
    if (result === 0) {
      logger.info('trimVideoWithFFmpeg', 'Successfully trimmed video', { outputUri });
      
      // Save metadata
      await saveMetadata(outputUri, startTime, endTime);
      await videoService.saveVideoMetadata({
        uri: outputUri,
        startTime,
        endTime,
        duration
      });

      return { uri: outputUri };
    } else {
      throw new Error(`FFmpeg command failed with code ${result}`);
    }
  } catch (error) {
    logger.error('trimVideoWithFFmpeg', 'Video trimming failed', {
      error,
      sourceUri,
      videoId
    });
    throw error;
  }
};
*/ 