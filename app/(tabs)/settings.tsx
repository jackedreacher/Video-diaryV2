import { View, Text, TouchableOpacity, Switch, ScrollView, TextInput, Alert, StyleSheet, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useThemeStore,
  themeColors,
  themeTemplates,
  ThemeTemplate,
} from "../../stores/useThemeStore";
import { useLanguageStore, translations } from "../../stores/useLanguageStore";
import { ColorOption } from "../../components/ColorOption";
import { useVideoStore } from "@/stores/useVideoStore";
import { DatabaseService } from "@/services/database";
import { useState, useEffect } from "react";
import { MotiView, AnimatePresence } from "moti";

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface CustomMemoryType {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export default function SettingsScreen() {
  const {
    isDarkMode,
    accentColor,
    template,
    setDarkMode,
    setAccentColor,
    setTemplate,
  } = useThemeStore();
  
  const { language, setLanguage } = useLanguageStore();
  const t = translations[language];
  
  const currentTheme = themeTemplates[template][isDarkMode ? "dark" : "light"];
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [customMemoryTypes, setCustomMemoryTypes] = useState<CustomMemoryType[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Load all data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([
        loadCategories(),
        loadCustomMemoryTypes()
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
      // Also refresh videos from store
      await useVideoStore.getState().loadVideos();
      console.log('✅ Settings data refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh data:', error);
      Alert.alert('Error', 'Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  const loadCategories = async () => {
    const dbCategories = await DatabaseService.getCategories() as Category[];
    setCategories(dbCategories);
  };

  const loadCustomMemoryTypes = async () => {
    const types = await DatabaseService.getCustomMemoryTypes() as CustomMemoryType[];
    setCustomMemoryTypes(types);
  };

  const handleDeleteCustomMemoryType = async (type: CustomMemoryType) => {
    Alert.alert(
      'Delete Memory Type',
      `Are you sure you want to delete "${type.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.deleteCustomMemoryType(type.id);
              await loadCustomMemoryTypes();
              Alert.alert('Success', 'Memory type deleted successfully');
            } catch (error) {
              console.error('Failed to delete memory type:', error);
              Alert.alert('Error', 'Failed to delete memory type');
            }
          }
        }
      ]
    );
  };

  const handleDeleteCategory = async (category: Category) => {
    if (category.id === 'all') {
      Alert.alert('Error', 'Cannot delete the default "All" category');
      return;
    }

    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category.name}"? Videos in this category will be moved to "All".`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.deleteCategory(category.id);
              await loadCategories();
              Alert.alert('Success', 'Category deleted successfully');
            } catch (error) {
              console.error('Failed to delete category:', error);
              Alert.alert('Error', 'Failed to delete category');
            }
          }
        }
      ]
    );
  };

  const handleEditCategory = async (updates: Partial<Category>) => {
    if (!editingCategory) return;

    try {
      await DatabaseService.updateCategory(editingCategory.id, updates);
      await loadCategories();
      setShowEditModal(false);
      setEditingCategory(null);
      Alert.alert('Success', 'Category updated successfully');
    } catch (error) {
      console.error('Failed to update category:', error);
      Alert.alert('Error', 'Failed to update category');
    }
  };

  const handleDeleteDiary = async () => {
    Alert.alert(
      t.deleteConfirmation,
      t.cannotBeUndone,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              // Get all core memories
              const memories = await DatabaseService.getCoreMemories();
              if (memories.length === 0) {
                Alert.alert('Info', 'No core memories to delete');
                return;
              }

              // Delete each core memory
              for (const memory of memories) {
                await DatabaseService.deleteCoreMemory(memory.videoId);
              }
              await loadData();
              Alert.alert(t.success, t.deleteSuccess);
            } catch (error) {
              console.error('Failed to delete core memories:', error);
              Alert.alert(t.error, t.error);
            }
          }
        }
      ]
    );
  };

  const handleDeleteSingleDiary = async () => {
    try {
      const videos = await useVideoStore.getState().videos;
      if (videos.length === 0) {
        Alert.alert('Info', 'No videos to delete');
        return;
      }

      // Show list of videos to delete
      Alert.alert(
        'Select Video to Delete',
        'Choose a video to delete:',
        [
          { text: 'Cancel', style: 'cancel' },
          ...videos.map(video => ({
            text: `${video.title} (${new Date(video.createdAt).toLocaleDateString()})`,
            onPress: async () => {
              Alert.alert(
                'Confirm Delete',
                `Are you sure you want to delete "${video.title}"? This will also delete any associated core memory.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await DatabaseService.deleteVideo(video.id);
                        await useVideoStore.getState().loadVideos();
                        await loadData();
                        Alert.alert('Success', 'Video deleted successfully');
                      } catch (error) {
                        console.error('Failed to delete video:', error);
                        Alert.alert('Error', 'Failed to delete video');
                      }
                    }
                  }
                ]
              );
            }
          }))
        ]
      );
    } catch (error) {
      console.error('Failed to get videos:', error);
      Alert.alert('Error', 'Failed to get videos');
    }
  };

  const handleClearDatabase = async () => {
    try {
      await DatabaseService.clearDatabase();
      useVideoStore.getState().loadVideos();
      await loadData();
      Alert.alert(t.success, t.clearAllData);
    } catch (error) {
      console.error('Failed to clear database:', error);
      Alert.alert(t.error, 'Failed to clear database');
    }
  };

  const CategoryItem = ({ category }: { category: Category }) => (
    <View
      style={[
        styles.categoryItem,
        { backgroundColor: currentTheme.card }
      ]}
    >
      <View style={styles.categoryInfo}>
        <View style={styles.categoryIcon}>
          <Ionicons name={category.icon as any} size={24} color={category.color} />
        </View>
        <Text style={[styles.categoryName, { color: currentTheme.text }]}>
          {category.name}
        </Text>
      </View>
      <View style={styles.categoryActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: currentTheme.bg }]}
          onPress={() => {
            setEditingCategory(category);
            setShowEditModal(true);
          }}
          disabled={category.id === 'all'}
        >
          <Ionicons name="pencil" size={20} color={currentTheme.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#ff4444' }]}
          onPress={() => handleDeleteCategory(category)}
          disabled={category.id === 'all'}
        >
          <Ionicons name="trash" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const EditCategoryModal = () => {
    if (!editingCategory) return null;

    const [name, setName] = useState(editingCategory.name);
    const [selectedColor, setSelectedColor] = useState(editingCategory.color);
    const [selectedIcon, setSelectedIcon] = useState(editingCategory.icon);

    const iconOptions = [
      'bookmark-outline',
      'heart-outline',
      'star-outline',
      'flag-outline',
      'flame-outline',
      'flower-outline',
      'leaf-outline',
      'planet-outline',
    ];

    const colorOptions = [
      '#FFB6C1', '#ADD8E6', '#98FB98', '#DDA0DD', 
      '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1'
    ];

    return (
      <AnimatePresence>
        {showEditModal && (
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={[
              styles.modalContainer,
              { backgroundColor: currentTheme.card }
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: currentTheme.text }]}>
                Edit Category
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowEditModal(false);
                  setEditingCategory(null);
                }}
              >
                <Ionicons name="close" size={24} color={currentTheme.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: currentTheme.bg,
                    color: currentTheme.text,
                  }
                ]}
                value={name}
                onChangeText={setName}
                placeholder="Category Name"
                placeholderTextColor={currentTheme.textSecondary}
              />

              <Text style={[styles.sectionLabel, { color: currentTheme.text }]}>
                Color
              </Text>
              <View style={styles.colorGrid}>
                {colorOptions.map(color => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      selectedColor === color && styles.selectedColor
                    ]}
                    onPress={() => setSelectedColor(color)}
                  />
                ))}
              </View>

              <Text style={[styles.sectionLabel, { color: currentTheme.text }]}>
                Icon
              </Text>
              <View style={styles.iconGrid}>
                {iconOptions.map(icon => (
                  <TouchableOpacity
                    key={icon}
                    style={[
                      styles.iconOption,
                      {
                        backgroundColor: currentTheme.bg,
                        borderColor: selectedIcon === icon ? selectedColor : 'transparent'
                      }
                    ]}
                    onPress={() => setSelectedIcon(icon)}
                  >
                    <Ionicons
                      name={icon as any}
                      size={24}
                      color={selectedIcon === icon ? selectedColor : currentTheme.text}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: selectedColor }]}
                onPress={() => handleEditCategory({ name, color: selectedColor, icon: selectedIcon })}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </MotiView>
        )}
      </AnimatePresence>
    );
  };

  const styles = StyleSheet.create({
    categoryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
    },
    categoryInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    categoryIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      backgroundColor: 'rgba(0,0,0,0.05)',
    },
    categoryName: {
      fontSize: 16,
      fontWeight: '500',
    },
    categoryActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalContainer: {
      position: 'absolute',
      top: '20%',
      left: 20,
      right: 20,
      borderRadius: 16,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 5,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
    },
    modalContent: {
      gap: 16,
    },
    input: {
      height: 48,
      borderRadius: 8,
      paddingHorizontal: 12,
      fontSize: 16,
    },
    sectionLabel: {
      fontSize: 16,
      fontWeight: '500',
      marginBottom: 8,
    },
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    colorOption: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    selectedColor: {
      borderWidth: 3,
      borderColor: '#fff',
    },
    iconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    iconOption: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
    },
    saveButton: {
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    saveButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    emptyState: {
      padding: 20,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    emptyStateText: {
      fontSize: 16,
      textAlign: 'center',
      lineHeight: 24,
    },
    notFeatureContainer: {
      borderRadius: 12,
      padding: 16,
      gap: 16,
    },
    notFeatureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    notFeatureText: {
      fontSize: 16,
    },
    dangerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ff6b6b',
      padding: 12,
      borderRadius: 12,
      gap: 8,
    },
    dangerButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  const TemplateOption = ({
    name,
    template: templateName,
  }: {
    name: string;
    template: ThemeTemplate;
  }) => (
    <TouchableOpacity
      onPress={() => setTemplate(templateName)}
      className={`bg-[#2c2c2e] p-4 rounded-lg mb-4 flex-row justify-between items-center`}
      style={{
        backgroundColor:
          themeTemplates[templateName][isDarkMode ? "dark" : "light"].card,
      }}
    >
      <View className="flex-row items-center">
        <Ionicons name="color-palette" size={24} color={currentTheme.text} />
        <Text className="ml-3" style={{ color: currentTheme.text }}>
          {name}
        </Text>
      </View>
      {template === templateName && (
        <Ionicons
          name="checkmark-circle"
          size={24}
          color={themeColors[accentColor].primary}
        />
      )}
    </TouchableOpacity>
  );

  const LanguageSelector = () => (
    <View
      className="flex-row items-center justify-between p-4 rounded-lg mb-4"
      style={{ backgroundColor: currentTheme.card }}
    >
      <View className="flex-row items-center">
        <Ionicons name="language" size={24} color={currentTheme.text} />
        <Text className="ml-3" style={{ color: currentTheme.text }}>
          {t.language}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => {
          Alert.alert(
            t.selectLanguage,
            '',
            [
              {
                text: t.english,
                onPress: () => setLanguage('en'),
                style: language === 'en' ? 'destructive' : 'default'
              },
              {
                text: t.turkish,
                onPress: () => setLanguage('tr'),
                style: language === 'tr' ? 'destructive' : 'default'
              },
              {
                text: t.cancel,
                style: 'cancel'
              }
            ]
          );
        }}
      >
        <Text style={{ color: themeColors[accentColor].primary }}>
          {language === 'en' ? t.english : t.turkish}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView 
      style={{ backgroundColor: currentTheme.bg }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={currentTheme.text}
          colors={[themeColors[accentColor].primary]}
          progressBackgroundColor={currentTheme.card}
        />
      }
    >
      <View className="p-4">
        {/* Theme Settings */}
        <View className="mb-8">
          <Text
            className="text-xl font-semibold mb-4"
            style={{ color: currentTheme.text }}
          >
            {t.themeSettings}
          </Text>

          {/* Language Selector */}
          <LanguageSelector />

          {/* Dark Mode Toggle */}
          <View
            className="flex-row items-center justify-between p-4 rounded-lg mb-4"
            style={{ backgroundColor: currentTheme.card }}
          >
            <View className="flex-row items-center">
              <Ionicons name="moon" size={24} color={currentTheme.text} />
              <Text className="ml-3" style={{ color: currentTheme.text }}>
                {t.darkMode}
              </Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={setDarkMode}
              trackColor={{
                false: "#767577",
                true: themeColors[accentColor].primary,
              }}
            />
          </View>

          {/* Theme Templates */}
          <Text className="text-base mb-3" style={{ color: currentTheme.text }}>
            {t.themeTemplate}
          </Text>
          <TemplateOption name="Default" template="default" />
          <TemplateOption name="Minimal" template="minimal" />
          <TemplateOption name="Pink" template="pink" />
          <TemplateOption name="Classic" template="classic" />

          {/* Accent Colors */}
          <Text
            className="text-base mb-3"
            style={{ color: currentTheme.text }}
          ></Text>
          <View className="flex-row mb-4">
            <ColorOption
              color="blue"
              selectedColor={accentColor}
              onSelect={setAccentColor}
            />
            <ColorOption
              color="purple"
              selectedColor={accentColor}
              onSelect={setAccentColor}
            />
            <ColorOption
              color="green"
              selectedColor={accentColor}
              onSelect={setAccentColor}
            />
            <ColorOption
              color="orange"
              selectedColor={accentColor}
              onSelect={setAccentColor}
            />
          </View>
          
        </View>

        {/* Category Management */}
        <View className="mb-8">
          <Text
            className="text-xl font-semibold mb-4"
            style={{ color: currentTheme.text }}
          >
            {t.categoryManagement}
          </Text>
          {categories.map(category => (
            <CategoryItem key={category.id} category={category} />
          ))}
        </View>

        {/* Core Memory Types */}
        <View className="mb-8">
          <Text
            className="text-xl font-semibold mb-4"
            style={{ color: currentTheme.text }}
          >
            {t.coreMemoryTypes}
          </Text>
          {customMemoryTypes.map(type => (
            <View
              key={type.id}
              style={[
                styles.categoryItem,
                { backgroundColor: currentTheme.card }
              ]}
            >
              <View style={styles.categoryInfo}>
                <View style={[styles.categoryIcon, { backgroundColor: type.color + '20' }]}>
                  <Ionicons name={type.icon as any} size={24} color={type.color} />
                </View>
                <Text style={[styles.categoryName, { color: currentTheme.text }]}>
                  {type.name}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#ff4444' }]}
                onPress={() => handleDeleteCustomMemoryType(type)}
              >
                <Ionicons name="trash" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
          {customMemoryTypes.length === 0 && (
            <View
              style={[
                styles.emptyState,
                { backgroundColor: currentTheme.card }
              ]}
            >
              <Ionicons name="bookmark-outline" size={32} color={currentTheme.textSecondary} />
              <Text style={[styles.emptyStateText, { color: currentTheme.textSecondary }]}>
                {t.noCustomMemoryTypes}{'\n'}{t.createInCoreMemory}
              </Text>
            </View>
          )}
        </View>

        {/* Not Feature */}
        <View className="mb-8">
          <Text
            className="text-xl font-semibold mb-4"
            style={{ color: currentTheme.text }}
          >
            {t.comingSoon}
          </Text>
          <View style={[styles.notFeatureContainer, { backgroundColor: currentTheme.card }]}>
            <View style={styles.notFeatureItem}>
              <Ionicons name="cloud-outline" size={24} color={currentTheme.textSecondary} />
              <Text style={[styles.notFeatureText, { color: currentTheme.textSecondary }]}>
                {t.cloudBackup}
              </Text>
            </View>
            <View style={styles.notFeatureItem}>
              <Ionicons name="share-outline" size={24} color={currentTheme.textSecondary} />
              <Text style={[styles.notFeatureText, { color: currentTheme.textSecondary }]}>
                {t.shareVideos}
              </Text>
            </View>
            <View style={styles.notFeatureItem}>
              <Ionicons name="bookmark-outline" size={24} color={currentTheme.textSecondary} />
              <Text style={[styles.notFeatureText, { color: currentTheme.textSecondary }]}>
                {t.coreMemoryEditor}
              </Text>
            </View>
          </View>
        </View>

        {/* Database Management */}
        <View className="mb-8">
          <Text
            className="text-xl font-semibold mb-4"
            style={{ color: currentTheme.text }}
          >
            {t.databaseManagement}
          </Text>
          <View style={{ gap: 12 }}>
            <TouchableOpacity
              style={[styles.dangerButton]}
              onPress={handleDeleteDiary}
            >
              <Ionicons name="trash-outline" size={24} color="#fff" />
              <Text style={styles.dangerButtonText}>
                {t.deleteAllDiaryContent}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dangerButton, { backgroundColor: '#ff6b6b' }]}
              onPress={handleDeleteSingleDiary}
            >
              <Ionicons name="trash-bin-outline" size={24} color="#fff" />
              <Text style={styles.dangerButtonText}>
                {t.deleteSingleDiary}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dangerButton, { backgroundColor: '#ff4444' }]}
              onPress={handleClearDatabase}
            >
              <Ionicons name="alert-circle-outline" size={24} color="#fff" />
              <Text style={styles.dangerButtonText}>
                {t.clearAllData}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Edit Category Modal */}
      <EditCategoryModal />
    </ScrollView>
  );
}