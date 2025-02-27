import { TouchableOpacity } from 'react-native';
import { ThemeColor, themeColors } from '../stores/useThemeStore';

interface ColorOptionProps {
  color: ThemeColor;
  selectedColor: ThemeColor;
  onSelect: (color: ThemeColor) => void;
}

export const ColorOption = ({ color, selectedColor, onSelect }: ColorOptionProps) => (
  <TouchableOpacity
    onPress={() => onSelect(color)}
    className={`w-12 h-12 rounded-full mr-4 ${selectedColor === color ? 'border-2 border-white' : ''}`}
    style={{ backgroundColor: themeColors[color].primary }}
  />
); 