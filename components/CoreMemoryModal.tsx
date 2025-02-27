import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, themeTemplates, themeColors } from '../stores/useThemeStore';
import { MotiView } from 'moti';

interface Props {
  isVisible: boolean;
  onClose: () => void;
  onSave: (note: string) => void;
  initialNote?: string;
  videoTitle: string;
}

const STICKY_NOTE_COLORS = [
  '#FFB6C1', // Light pink
  '#98FB98', // Light green
  '#87CEFA', // Light blue
  '#DDA0DD', // Light purple
  '#F0E68C', // Khaki
  '#FFD700', // Gold
  '#FFA07A', // Salmon
  '#90EE90', // Light green
  '#87CEEB', // Light blue
  '#DDA0DD', // Light purple
  '#F0E68C', // Khaki
  '#000000', // black
  '#FFFFFF', // white
  '#FF0000', // red
  '#00FF00', // green
  '#0000FF', // blue
  '#FFFF00', // yellow
  '#FF00FF', // magenta
  '#00FFFF', // cyan
];

export const CoreMemoryModal: React.FC<Props> = ({
  isVisible,
  onClose,
  onSave,
  initialNote = '',
  videoTitle,
}) => {
  const { isDarkMode, template, accentColor } = useThemeStore();
  const theme = themeTemplates[template][isDarkMode ? 'dark' : 'light'];
  const accent = themeColors[accentColor].primary;
  const [note, setNote] = useState(initialNote);

  useEffect(() => {
    if (isVisible) {
      setNote(initialNote);
    }
  }, [isVisible, initialNote]);

  const handleSave = () => {
    onSave(note.trim());
    onClose();
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <BlurView
          intensity={isDarkMode ? 45 : 65}
          tint={isDarkMode ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'timing', duration: 250 }}
          style={[styles.content, { backgroundColor: theme.card }]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              Core Memory
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {videoTitle}
          </Text>

          <View style={[styles.noteContainer, { backgroundColor: STICKY_NOTE_COLORS[12] }]}>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Write your memory here..."
              placeholderTextColor="rgba(0,0,0,0.4)"
              multiline
              maxLength={200}
              autoFocus
              
            />
          </View>

          <Text style={[styles.charCount, { color: theme.textSecondary }]}>
            {note.length}/200
          </Text>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: accent }]}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>Save Memory</Text>
          </TouchableOpacity>
        </MotiView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
  },
  noteContainer: {
    minHeight: 150,
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  noteInput: {
    fontSize: 16,
    color: '#1a1a1a',
    fontFamily: Platform.OS === 'ios' ? 'Noteworthy' : 'normal',
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 20,
  },
  saveButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
}); 