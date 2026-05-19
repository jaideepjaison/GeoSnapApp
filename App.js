import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import CameraScreen from './src/screens/CameraScreen';
import GalleryScreen from './src/screens/GalleryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';

const Tab = createBottomTabNavigator();

function AppTabs() {
  const { theme: T } = useTheme();

  const navTheme = {
    ...(T.mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(T.mode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: T.bg,
      card: T.surface,
      border: T.border,
      text: T.text,
    },
  };

  return (
    <NavigationContainer theme={navTheme} key={T.mode}>
      <StatusBar style={T.mode === 'dark' ? 'light' : 'dark'} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: T.tabBar,
            borderTopColor: T.tabBarBorder,
            borderTopWidth: 1,
            paddingBottom: 6,
            paddingTop: 6,
            height: 64,
          },
          tabBarActiveTintColor: T.accent,
          tabBarInactiveTintColor: T.textMuted,
          tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
          tabBarIcon: ({ focused, color, size }) => {
            const icons = {
              Camera: focused ? 'camera' : 'camera-outline',
              Gallery: focused ? 'images' : 'images-outline',
              Settings: focused ? 'settings' : 'settings-outline',
            };
            return <Ionicons name={icons[route.name]} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Camera" component={CameraScreen} />
        <Tab.Screen name="Gallery" component={GalleryScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppTabs />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
