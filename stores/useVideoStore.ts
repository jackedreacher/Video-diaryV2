import { create } from 'zustand';
import { DatabaseService } from '../services/database';
import { FileManager } from '../utils/fileManager';

export interface VideoEntry {
  id: string;
  uri: string;
  thumbnail: string;
  duration: number;
  createdAt: string;
  title: string;
  description?: string;
  startTime: number;
  endTime: number;
  categoryId: string;
}

interface VideoState {
  videos: VideoEntry[];
  isLoading: boolean;
  error: string | null;
  loadVideos: () => Promise<void>;
  addVideo: (video: VideoEntry) => Promise<string>;
  deleteVideo: (id: string, videoUri: string, thumbnailUri: string) => Promise<void>;
  updateVideo: (id: string, updates: Partial<VideoEntry>) => Promise<void>;
}

export const useVideoStore = create<VideoState>()((set, get) => ({
  videos: [],
  isLoading: false,
  error: null,

  loadVideos: async () => {
    set({ isLoading: true, error: null });
    try {
      const videos = await DatabaseService.getVideos();
      set({ videos, isLoading: false });
    } catch (error) {
      console.error('Failed to load videos:', error);
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  addVideo: async (video) => {
    set({ isLoading: true, error: null });
    try {
      // Add to database first
      const finalId = await DatabaseService.addVideo(video);
      
      // Get the updated video list
      const videos = await DatabaseService.getVideos();
      
      // Update state
      set({ 
        videos,
        isLoading: false,
        error: null
      });

      // Return the final ID for reference
      return finalId;
    } catch (error) {
      console.error('Failed to add video:', error);
      set({ 
        error: (error as Error).message, 
        isLoading: false 
      });
      throw error;
    }
  },

  deleteVideo: async (id, videoUri, thumbnailUri) => {
    set({ isLoading: true, error: null });
    try {
      // Delete from database first
      await DatabaseService.deleteVideo(id);
      
      // Then delete files
      await FileManager.deleteVideo(videoUri, thumbnailUri);
      
      // Get updated video list
      const videos = await DatabaseService.getVideos();
      
      // Update state
      set({ 
        videos,
        isLoading: false,
        error: null
      });
    } catch (error) {
      console.error('Failed to delete video:', error);
      set({ 
        error: (error as Error).message ?? 'Unknown error', 
        isLoading: false 
      });
      throw error;
    }
  },

  updateVideo: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      // Update in database
      await DatabaseService.updateVideo(id, updates);
      
      // Get updated video list
      const videos = await DatabaseService.getVideos();
      
      // Update state
      set({ 
        videos,
        isLoading: false,
        error: null
      });
    } catch (error) {
      console.error('Failed to update video:', error);
      set({ 
        error: (error as Error).message, 
        isLoading: false 
      });
      throw error;
    }
  },
})); 