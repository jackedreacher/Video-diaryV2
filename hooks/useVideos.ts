import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FileManager } from '../utils/fileManager';

export interface Video {
  id: string;
  uri: string;
  thumbnail: string;
  duration: number;
  createdAt: string;
  title: string;
  description?: string;
  startTime: number;
  endTime: number;
}

const VIDEOS_KEY = 'videos';

// Fetch videos
const fetchVideos = async (): Promise<Video[]> => {
  const data = await AsyncStorage.getItem(VIDEOS_KEY);
  return data ? JSON.parse(data) : [];
};

// Save videos
const saveVideos = async (videos: Video[]) => {
  await AsyncStorage.setItem(VIDEOS_KEY, JSON.stringify(videos));
  return videos;
};

export function useVideos() {
  const queryClient = useQueryClient();

  // Query for fetching videos
  const { data: videos = [], isLoading, error, refetch } = useQuery({
    queryKey: ['videos'],
    queryFn: fetchVideos,
  });

  // Add video with optimistic update
  const addVideo = useMutation({
    mutationFn: async (newVideo: Video) => {
      const currentVideos = await fetchVideos();
      const updatedVideos = [newVideo, ...currentVideos];
      await FileManager.cleanupCache();
      return saveVideos(updatedVideos);
    },
    onMutate: async (newVideo) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['videos'] });
      // Snapshot the previous value
      const previousVideos = queryClient.getQueryData(['videos']);
      // Optimistically update
      queryClient.setQueryData(['videos'], (old: Video[] = []) => [newVideo, ...old]);
      return { previousVideos };
    },
    onError: (err, newVideo, context) => {
      // Rollback on error
      queryClient.setQueryData(['videos'], context?.previousVideos);
    },
    onSettled: () => {
      // Refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });

  // Mutation for updating a video
  const updateVideo = useMutation({
    mutationFn: async (updatedVideo: Video) => {
      const currentVideos = await fetchVideos();
      const updatedVideos = currentVideos.map(video => 
        video.id === updatedVideo.id ? updatedVideo : video
      );
      return saveVideos(updatedVideos);
    },
    onMutate: async (updatedVideo) => {
      await queryClient.cancelQueries({ queryKey: ['videos'] });
      const previousVideos = queryClient.getQueryData(['videos']);
      queryClient.setQueryData(['videos'], (old: Video[] = []) => 
        old.map(video => video.id === updatedVideo.id ? updatedVideo : video)
      );
      return { previousVideos };
    },
    onError: (err, _, context) => {
      queryClient.setQueryData(['videos'], context?.previousVideos);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });

  // Mutation for deleting a video
  const deleteVideo = useMutation({
    mutationFn: async (videoId: string) => {
      const currentVideos = await fetchVideos();
      const video = currentVideos.find(v => v.id === videoId);
      if (video) {
        await FileManager.deleteVideo(video.uri, video.thumbnail);
      }
      const updatedVideos = currentVideos.filter(v => v.id !== videoId);
      return saveVideos(updatedVideos);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['videos'], data);
    },
  });

  return {
    videos,
    isLoading,
    error,
    refetch,
    addVideo: addVideo.mutate,
    updateVideo: updateVideo.mutate,
    deleteVideo: deleteVideo.mutate,
    isAddingVideo: addVideo.isPending,
    isUpdatingVideo: updateVideo.isPending,
    isDeletingVideo: deleteVideo.isPending,
    addVideoError: addVideo.error,
    updateVideoError: updateVideo.error,
    deleteVideoError: deleteVideo.error,
  };
} 