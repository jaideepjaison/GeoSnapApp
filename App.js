import React, { useState, useRef, useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Vibration } from 'react-native';
import { BlurView } from 'expo-blur';

import CameraScreen from './src/screens/CameraScreen';
import GalleryScreen from './src/screens/GalleryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SplashScreen from './src/components/SplashScreen';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AlertProvider } from './src/context/AlertContext';
import { CameraProvider, useCameraContext } from './src/context/CameraContext';

const Tab = createBottomTabNavigator();
const { width: SCREEN_WIDTH } = Dimensions.get('window');

function ModernTabBar({ state, descriptors, navigation }) {
  const { theme: T } = useTheme();
  const { isPreview } = useCameraContext();
  const insets = useSafeAreaInsets();
  const isDark = T?.mode === 'dark';
  const accentColor = T?.accent || '#1877F2';

  if (isPreview) return null;

  // 16px padding on each side -> total width = SCREEN_WIDTH - 32
  const dockWidth = SCREEN_WIDTH - 32;
  const tabWidth = dockWidth / 3;
  const sliderTranslateX = useRef(new Animated.Value(state.index * tabWidth)).current;
  const sliderScaleX = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(sliderTranslateX, {
        toValue: state.index * tabWidth,
        tension: 100,
        friction: 11,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(sliderScaleX, { toValue: 1.12, duration: 110, useNativeDriver: true }),
        Animated.spring(sliderScaleX, { toValue: 1.0, tension: 120, friction: 8, useNativeDriver: true }),
      ])
    ]).start();
  }, [state.index]);

  const TABS_CONFIG = {
    Camera:   { label: 'Camera',   icon: 'aperture',   outline: 'aperture-outline' },
    Gallery:  { label: 'Gallery',  icon: 'albums',     outline: 'albums-outline' },
    Settings: { label: 'Settings', icon: 'options',    outline: 'options-outline' },
  };

  return (
    <View style={[styles.navDockWrap, { bottom: Math.max(insets.bottom + 6, 16) }]}>
      <BlurView
        intensity={isDark ? 88 : 96}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.navDockContainer,
          {
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.88)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.95)',
          }
        ]}
      >
        {/* Animated Active Pill Slider */}
        <Animated.View
          style={[
            styles.activeSliderPill,
            {
              width: tabWidth - 12,
              backgroundColor: isDark ? 'rgba(24, 119, 242, 0.22)' : 'rgba(24, 119, 242, 0.14)',
              borderColor: `${accentColor}40`,
              transform: [{ translateX: sliderTranslateX }, { scaleX: sliderScaleX }],
            }
          ]}
        />

        {/* Tab Items */}
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const config = TABS_CONFIG[route.name] || { label: route.name, icon: 'square', outline: 'square-outline' };

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              try { Vibration.vibrate(30); } catch {}
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={styles.tabItem}
            >
              <Ionicons
                name={isFocused ? config.icon : config.outline}
                size={isFocused ? 22 : 20}
                color={isFocused ? accentColor : (isDark ? '#7E8CA7' : '#64748B')}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isFocused ? accentColor : (isDark ? '#7E8CA7' : '#64748B'),
                    fontWeight: isFocused ? '800' : '600',
                  }
                ]}
              >
                {config.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </BlurView>
    </View>
  );
}

function AppTabs() {
  const { theme: T } = useTheme();
  const isDark = T?.mode === 'dark';
  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: T?.bg || '#0B1220', card: T?.surface || '#121D2E', border: T?.border || '#243352', text: T?.text || '#F0F2FF',
    },
  };

  return (
    <NavigationContainer theme={navTheme} key={T?.mode || 'dark'}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Tab.Navigator
        initialRouteName="Camera"
        tabBar={(props) => <ModernTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="Camera" component={CameraScreen} />
        <Tab.Screen name="Gallery" component={GalleryScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

function AppContent() {
  const [splashDone, setSplashDone] = useState(false);
  if (!splashDone) return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <SplashScreen onFinish={() => setSplashDone(true)} />
    </View>
  );
  return <AppTabs />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AlertProvider>
          <CameraProvider>
            <AppContent />
          </CameraProvider>
        </AlertProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  navDockWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 64,
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 16,
    zIndex: 100,
  },
  navDockContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1.5,
    position: 'relative',
  },
  activeSliderPill: {
    position: 'absolute',
    left: 6,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    gap: 3,
  },
  tabLabel: {
    fontSize: 11,
    letterSpacing: 0.3,
  },
});
