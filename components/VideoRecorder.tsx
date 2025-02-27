import { View, StyleSheet } from 'react-native';
import { useVideoStore, VideoEntry } from '../stores/useVideoStore';
import { generateUUID } from '../utils/helpers';
import { processVideo, generateThumbnail } from '../utils/videoProcessor';


export const VideoRecorder = () => {
  const { addVideo } = useVideoStore();

  const handleRecordingFinished = async (uri: string) => {
    try {
      const videoId = generateUUID();
      const { uri: processedUri } = await processVideo(uri, 0, 60, videoId);
      const thumbnailUri = await generateThumbnail(processedUri, 0);
      
      const newVideo: VideoEntry = {
        id: videoId,
        uri: processedUri,
        thumbnail: thumbnailUri,
        duration: 60,
        createdAt: new Date().toISOString(),
        title: `Recording ${new Date().toLocaleDateString()}`,
        description: '',
        startTime: 0,
        endTime: 60,
        categoryId: 'default'
      };

      await addVideo(newVideo);
    } catch (error) {
      console.error('Failed to save recording:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Recording UI */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
}); 