import { Video } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { generateUUID } from '../utils/helpers';

export interface VideoMetadata {
  uri: string;
  startTime: number;
  endTime: number;
  duration: number;
  id: string;
}

class VideoService {
  private static instance: VideoService;
  private metadataCache: Map<string, VideoMetadata> = new Map();
  private metadataDir: string;

  private constructor() {
    this.metadataDir = `${FileSystem.documentDirectory}metadata/`;
    this.ensureMetadataDirectory();
  }

  private async ensureMetadataDirectory() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.metadataDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.metadataDir, { intermediates: true });
      }
    } catch (error) {
      console.error('Failed to create metadata directory:', error);
    }
  }

  static getInstance(): VideoService {
    if (!VideoService.instance) {
      VideoService.instance = new VideoService();
    }
    return VideoService.instance;
  }

  async getVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
    // First check cache
    if (this.metadataCache.has(videoId)) {
      return this.metadataCache.get(videoId)!;
    }

    try {
      // Ensure directory exists
      await this.ensureMetadataDirectory();
      
      const metadataFile = `${this.metadataDir}${videoId}.json`;
      
      // Check if file exists first
      const fileInfo = await FileSystem.getInfoAsync(metadataFile);
      if (!fileInfo.exists) {
        console.warn(`Metadata file does not exist for video ${videoId}`);
        return null;
      }

      const content = await FileSystem.readAsStringAsync(metadataFile);
      const metadata = JSON.parse(content) as VideoMetadata;
      
      // Cache the result
      this.metadataCache.set(videoId, metadata);
      
      return metadata;
    } catch (error) {
      console.warn('Failed to get video metadata:', error);
      return null;
    }
  }

  async saveVideoMetadata(metadata: Omit<VideoMetadata, 'id'> & { id?: string }): Promise<string> {
    try {
      // Ensure directory exists
      await this.ensureMetadataDirectory();

      const id = metadata.id || generateUUID();
      const fullMetadata: VideoMetadata = {
        ...metadata,
        id
      };

      const metadataFile = `${this.metadataDir}${id}.json`;
      
      // Ensure we don't have stale data
      this.metadataCache.delete(id);
      
      await FileSystem.writeAsStringAsync(metadataFile, JSON.stringify(fullMetadata));
      
      // Update cache with fresh data
      this.metadataCache.set(id, fullMetadata);
      
      return id;
    } catch (error) {
      console.error('Failed to save video metadata:', error);
      throw error;
    }
  }

  async updateVideoMetadata(id: string, metadata: Partial<VideoMetadata>): Promise<void> {
    try {
      // Ensure directory exists
      await this.ensureMetadataDirectory();

      const existing = await this.getVideoMetadata(id);
      if (!existing) throw new Error('Video metadata not found');

      const updated = {
        ...existing,
        ...metadata
      };

      const metadataFile = `${this.metadataDir}${id}.json`;
      await FileSystem.writeAsStringAsync(metadataFile, JSON.stringify(updated));
      
      // Update cache
      this.metadataCache.set(id, updated);
    } catch (error) {
      console.error('Failed to update video metadata:', error);
      throw error;
    }
  }

  clearCache(): void {
    this.metadataCache.clear();
  }
}

export const videoService = VideoService.getInstance(); 