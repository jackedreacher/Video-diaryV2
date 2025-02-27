import React, { useEffect, useCallback, memo } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, themeTemplates, themeColors } from '../../stores/useThemeStore';
import { View, StyleSheet, Dimensions, Pressable, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  interpolate,
  Extrapolate,
  useSharedValue,
  withDelay,
  withRepeat,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useLanguageStore, translations } from '../../stores/useLanguageStore';

const { width } = Dimensions.get('window');
const TAB_BAR_HEIGHT = (Platform.select({ ios: 30, android: 30 }) ?? 55) as number;
const ICON_SIZE = (Platform.select({ ios: 24, android: 22 }) ?? 23) as number;
const SPRING_CONFIG = {
  damping: 12,
  stiffness: 150,
  mass: 0.5,
  overshootClamping: true,
} as const;

// Memoized tab icon component for performance
const TabIcon = memo(({ 
  name, 
  color, 
  size, 
  style 
}: { 
  name: keyof typeof Ionicons.glyphMap; 
  color: string; 
  size: number;
  style?: any;
}) => (
  <Ionicons name={name} size={size} color={color} style={style} />
));

// Memoized blur background component
const TabBarBackground = memo(({ 
  style, 
  intensity, 
  tint, 
  children 
}: { 
  style: any; 
  intensity: number; 
  tint: 'dark' | 'light';
  children: React.ReactNode;
}) => (
  <Animated.View style={style}>
    <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill}>
      {children}
    </BlurView>
  </Animated.View>
));

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { isDarkMode, template, accentColor } = useThemeStore();
  const { language } = useLanguageStore();
  const t = translations[language];
  const currentTheme = themeTemplates[template][isDarkMode ? 'dark' : 'light'];
  const accent = themeColors[accentColor].primary;
  const accentSecondary = themeColors[accentColor].secondary;

  // Animated values with error handling
  const tabBarScale = useSharedValue(1);
  const addButtonRotation = useSharedValue(0);
  const pulseAnimation = useSharedValue(1);

  // Error recovery function
  const resetAnimations = useCallback(() => {
    try {
      tabBarScale.value = 1;
      addButtonRotation.value = 0;
      pulseAnimation.value = 1;
    } catch (error) {
      console.error('Failed to reset animations:', error);
    }
  }, []);

  // Start pulse animation with error handling
  useEffect(() => {
    try {
      pulseAnimation.value = withRepeat(
        withSequence(
          withDelay(2000, withSpring(1.1, SPRING_CONFIG)),
          withSpring(1, SPRING_CONFIG)
        ),
        -1,
        true
      );
    } catch (error) {
      console.error('Failed to start pulse animation:', error);
      resetAnimations();
    }

    return () => {
      resetAnimations();
    };
  }, []);

  const styles = StyleSheet.create({
    tabBarContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: TAB_BAR_HEIGHT + insets.bottom,
      backgroundColor: currentTheme.card + (isDarkMode ? '95' : '98'),
      borderTopWidth: Platform.select({ ios: 0.5, android: 0 }),
      borderTopColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    blurEffect: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDarkMode 
        ? 'rgba(18, 18, 18, 0.85)' 
        : 'rgba(255, 255, 255, 0.85)',
    },
    blurInner: {
      ...StyleSheet.absoluteFillObject,
    },
    gradient: {
      ...StyleSheet.absoluteFillObject,
      opacity: isDarkMode ? 0.05 : 0.08,
    },
    iconContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      height: ICON_SIZE + 16,
      width: ICON_SIZE + 16,
      borderRadius: (ICON_SIZE + 16) / 2,
      marginTop: Platform.select({ ios: 6, android: 4 }),
    },
    activeIconContainer: {
      backgroundColor: accent + '20',
      transform: [{ scale: 1.05 }],
      ...Platform.select({
        ios: {
          shadowColor: accent,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    addButton: {
      height: 50,
      width: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -25,
      backgroundColor: accent,
      ...Platform.select({
        ios: {
          shadowColor: accent,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        },
        android: {
          elevation: 5,
        },
      }),
    },
    addButtonInner: {
      height: 46,
      width: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: accent,
    },
    labelContainer: {
      marginTop: 2,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    activeLabelContainer: {
      backgroundColor: accent + '15',
    },
    label: {
      fontSize: 11,
      fontFamily: Platform.select({ ios: 'System', android: 'normal' }),
      fontWeight: '500',
      opacity: 0.9,
      color: currentTheme.textSecondary,
    },
    activeLabel: {
      color: accent,
      fontWeight: '600',
      opacity: 1,
    },
  });

  // Optimized animated styles
  const tabBarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(tabBarScale.value, SPRING_CONFIG) }],
  }), []);

  const addButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(pulseAnimation.value, SPRING_CONFIG) },
      { rotate: `${addButtonRotation.value}deg` },
    ],
  }), []);

  // Memoized press handlers
  const handlePressIn = useCallback(() => {
    try {
      tabBarScale.value = withSpring(0.98, SPRING_CONFIG);
    } catch (error) {
      console.error('Press in animation failed:', error);
      resetAnimations();
    }
  }, []);

  const handlePressOut = useCallback(() => {
    try {
      tabBarScale.value = withSpring(1, SPRING_CONFIG);
    } catch (error) {
      console.error('Press out animation failed:', error);
      resetAnimations();
    }
  }, []);

  return (
    <ErrorBoundary>
      <Tabs
        screenOptions={{
          tabBarStyle: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: TAB_BAR_HEIGHT + insets.bottom,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
          },
          tabBarBackground: () => (
            <TabBarBackground
              style={[styles.tabBarContainer]}
              intensity={isDarkMode ? 45 : 65}
              tint={isDarkMode ? 'dark' : 'light'}
            >
              <View style={styles.blurInner} />
              <LinearGradient
                colors={[
                  accent + (isDarkMode ? '10' : '15'),
                  accent + (isDarkMode ? '05' : '08')
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
              />
            </TabBarBackground>
          ),
          tabBarActiveTintColor: accent,
          tabBarInactiveTintColor: currentTheme.textSecondary,
          headerShown: false,
          tabBarShowLabel: true,
          tabBarLabelStyle: styles.label,
          tabBarItemStyle: {
            paddingVertical: 4,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t.todaysMemories,
            tabBarIcon: ({  focused }) => (
              
                <Animated.View style={[
                  styles.iconContainer,
                  focused && styles.activeIconContainer,
                ]}>
                  
                    <MaterialCommunityIcons 
                      name={ "notebook-multiple"}
                      size={ICON_SIZE}
                      color={focused ? accent : currentTheme.textSecondary}
                      style={{ opacity: focused ? 1 : 0.85 }}
                    />
                  
                </Animated.View>
              
            ),
          }}
        />
        <Tabs.Screen
          name="diary"
          options={{
            title: t.title,
            tabBarIcon: ({ focused }) => (
              <Animated.View style={[
                styles.iconContainer,
                focused && styles.activeIconContainer
              ]}>
                <TabIcon 
                  name={focused ? "library" : "library-outline"}
                  size={ICON_SIZE}
                  color={focused ? accent : currentTheme.textSecondary}
                  style={{ opacity: focused ? 1 : 0.85 }}
                />
              </Animated.View>
            ),
          }}
        />
        <Tabs.Screen
          name="create-core"
          options={{
            title: '',
            tabBarIcon: ({ focused }) => (
              <Animated.View 
                style={[
                  styles.addButton,
                  addButtonAnimatedStyle
                ]}
              >
                <View style={styles.addButtonInner}>
                  <MaterialCommunityIcons 
                    name="heart-plus"
                    size={32}
                    color="#FFF"
                    style={{ 
                      transform: [{ rotate: focused ? '45deg' : '0deg' }],
                      opacity: focused ? 0.9 : 1
                    }}
                  />
                </View>
              </Animated.View>
            ),
          }}
        />
        <Tabs.Screen
          name="add"
          options={{
            title: t.createNewMemory,
            tabBarIcon: ({ focused }) => (
              <Animated.View style={[
                styles.iconContainer,
                focused && styles.activeIconContainer
              ]}>
                <MaterialCommunityIcons 
                  name="notebook-plus"
                  size={ICON_SIZE}
                  color={focused ? accent : currentTheme.textSecondary}
                  style={{ opacity: focused ? 1 : 0.85 }}
                />
              </Animated.View>
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t.themeSettings,
            tabBarIcon: ({ focused }) => (
              <Animated.View style={[
                styles.iconContainer,
                focused && styles.activeIconContainer
              ]}>
                <TabIcon 
                  name={focused ? "settings" : "settings-outline"}
                  size={ICON_SIZE}
                  color={focused ? accent : currentTheme.textSecondary}
                  style={{ opacity: focused ? 1 : 0.85 }}
                />
              </Animated.View>
            ),
          }}
        />
      </Tabs>
    </ErrorBoundary>
  );
}
