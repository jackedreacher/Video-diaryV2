import { useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

export const useNotebookAnimation = () => {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const openNotebook = () => {
    rotation.value = withSpring(180, { damping: 12 });
    scale.value = withSpring(1.05);
    opacity.value = withTiming(0.8);
  };

  const closeNotebook = () => {
    rotation.value = withSpring(0);
    scale.value = withSpring(1);
    opacity.value = withTiming(1);
  };

  return {
    rotation,
    scale,
    opacity,
    openNotebook,
    closeNotebook,
  };
}; 