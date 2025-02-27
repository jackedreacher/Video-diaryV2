import { Ionicons } from '@expo/vector-icons';

type TabBarIconProps = {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
};

export const TabBarIcon = (props: TabBarIconProps) => (
  <Ionicons size={24} {...props} />
); 