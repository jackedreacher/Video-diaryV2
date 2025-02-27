import * as FileSystem from 'expo-file-system';

const VIDEO_DIR = `${FileSystem.documentDirectory}videos/`;
const THUMBNAIL_DIR = `${FileSystem.documentDirectory}thumbnails/`;
const MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB

// Define a more specific type for file info results
interface FileStats {
  uri: string;
  size: number;
  exists: boolean;
  isDirectory: boolean;
  modificationTime?: number;
}

// Helper function to safely get file info
const getFileStats = async (path: string): Promise<FileStats> => {
  try {
    const info = await FileSystem.getInfoAsync(path, { size: true });
    return {
      uri: info.uri,
      size: 'size' in info ? info.size : 0,
      exists: info.exists,
      isDirectory: 'isDirectory' in info ? info.isDirectory : false,
      modificationTime: 'modificationTime' in info ? info.modificationTime : undefined
    };
  } catch (error) {
    return {
      uri: path,
      size: 0,
      exists: false,
      isDirectory: false
    };
  }
};

export const FileManager = {
  // Initialize directories
  setup: async () => {
    await Promise.all([
      FileSystem.makeDirectoryAsync(VIDEO_DIR, { intermediates: true }),
      FileSystem.makeDirectoryAsync(THUMBNAIL_DIR, { intermediates: true })
    ]);
  },

  // Save video with proper organization
  saveVideo: async (sourceUri: string): Promise<string> => {
    const fileName = `${Date.now()}.mp4`;
    const destinationUri = `${VIDEO_DIR}${fileName}`;
    await FileSystem.copyAsync({ from: sourceUri, to: destinationUri });
    return destinationUri;
  },

  // Save thumbnail
  saveThumbnail: async (sourceUri: string): Promise<string> => {
    const fileName = `${Date.now()}.jpg`;
    const destinationUri = `${THUMBNAIL_DIR}${fileName}`;
    await FileSystem.copyAsync({ from: sourceUri, to: destinationUri });
    return destinationUri;
  },

  // Clean up old files
  cleanupCache: async () => {
    try {
      const [videoInfo, thumbnailInfo] = await Promise.all([
        getFileStats(VIDEO_DIR),
        getFileStats(THUMBNAIL_DIR)
      ]);
      
      const totalSize = videoInfo.size + thumbnailInfo.size;

      if (totalSize > MAX_CACHE_SIZE) {
        const [videos, thumbnails] = await Promise.all([
          FileSystem.readDirectoryAsync(VIDEO_DIR),
          FileSystem.readDirectoryAsync(THUMBNAIL_DIR)
        ]);

        // Get file stats for all files
        const fileStats = await Promise.all([
          ...videos.map(async name => {
            const path = `${VIDEO_DIR}${name}`;
            const stats = await getFileStats(path);
            return {
              name,
              path,
              size: stats.size,
              time: parseInt(name)
            };
          }),
          ...thumbnails.map(async name => {
            const path = `${THUMBNAIL_DIR}${name}`;
            const stats = await getFileStats(path);
            return {
              name,
              path,
              size: stats.size,
              time: parseInt(name)
            };
          })
        ]);

        // Sort by creation time and delete oldest files until under limit
        const sortedFiles = fileStats.sort((a, b) => a.time - b.time);
        let currentSize = totalSize;

        for (const file of sortedFiles) {
          if (currentSize <= MAX_CACHE_SIZE) break;
          try {
            await FileSystem.deleteAsync(file.path, { idempotent: true });
            currentSize -= file.size;
          } catch (error) {
            console.error(`Failed to delete file ${file.path}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Cache cleanup failed:', error);
    }
  },

  // Delete video and its thumbnail
  deleteVideo: async (videoUri: string, thumbnailUri: string) => {
    try {
      await Promise.all([
        FileSystem.deleteAsync(videoUri, { idempotent: true }),
        FileSystem.deleteAsync(thumbnailUri, { idempotent: true })
      ]);
    } catch (error) {
      console.error('Delete failed:', error);
      throw error;
    }
  },

  // Get cache size
  getCacheSize: async (): Promise<number> => {
    const [videoInfo, thumbnailInfo] = await Promise.all([
      getFileStats(VIDEO_DIR),
      getFileStats(THUMBNAIL_DIR)
    ]);
    return videoInfo.size + thumbnailInfo.size;
  }
}; 