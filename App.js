import React, { useState } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

import CameraScreen from './src/screens/CameraScreen';
import GalleryScreen from './src/screens/GalleryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SplashScreen from './src/components/SplashScreen';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AlertProvider } from './src/context/AlertContext';
import { CameraProvider, useCameraContext } from './src/context/CameraContext';

const Tab = createBottomTabNavigator();

function AppTabs() {
  const { theme: T } = useTheme();
  const insets = useSafeAreaInsets();
  const { capture } = useCameraContext();

  const navTheme = {
    ...(T.mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(T.mode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: T.bg, card: T.surface, border: T.border, text: T.text,
    },
  };

  const TABS = {
    Camera:   { icon: 'camera',   outline: 'camera-outline' },
    Gallery:  { icon: 'images',   outline: 'images-outline' },
    Settings: { icon: 'settings', outline: 'settings-outline' },
  };

  return (
    <NavigationContainer theme={navTheme} key={T.mode}>
      <StatusBar style={T.mode === 'dark' ? 'light' : 'dark'} />
      <Tab.Navigator
        initialRouteName="Camera"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            position: 'absolute',
            bottom: Math.max(insets.bottom, 12),
            left: 20,
            right: 20,
            height: 64,
            borderRadius: 24,
            borderTopWidth: 0,
            elevation: 0,
            backgroundColor: 'transparent',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 24,
          },
          tabBarBackground: () => (
            <BlurView
              intensity={T.mode === 'dark' ? 60 : 90}
              tint={T.mode === 'dark' ? 'dark' : 'light'}
              style={{
                flex: 1, borderRadius: 24, overflow: 'hidden',
                backgroundColor: T.mode === 'dark' ? 'rgba(18,29,46,0.75)' : 'rgba(255,255,255,0.7)',
                borderWidth: 1,
                borderColor: T.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)',
              }}
            />
          ),
          tabBarActiveTintColor: T.accent,
          tabBarInactiveTintColor: T.textMuted,
          tabBarShowLabel: true,
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: -2, marginBottom: 6 },
          tabBarIcon: ({ focused, color }) => {
            const cfg = TABS[route.name];
            return (
              <View style={focused ? { shadowColor: T.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 8 } : undefined}>
                <Ionicons name={focused ? cfg.icon : cfg.outline} size={22} color={color} />
              </View>
            );
          },
        })}
      >
        <Tab.Screen name="Camera" component={CameraScreen}
          listeners={({ navigation }) => ({
            tabPress: (e) => { if (navigation.isFocused()) { e.preventDefault(); capture(); } },
          })}
        />
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
