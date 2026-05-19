import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_THEME  = '@geosnap_theme_pref';
const STORAGE_KEY_ACCENT = '@geosnap_accent_color';

let _savedPref = 'auto';
const ThemeContext = createContext();

export const LIGHT = {
  mode: 'light',
  bg: '#F7F8FC',
  surface: '#FFFFFF',
  surface2: '#EEF0F7',
  border: '#DDE1ED',
  text: '#0D0E1A',
  textSub: '#525470',
  textMuted: '#9999BB',
  accent: '#0066FF',
  accentGreen: '#00B087',
  danger: '#FF3B30',
  warn: '#FF9500',
  tabBar: '#FFFFFF',
  tabBarBorder: '#DDE1ED',
  controlBg: '#EEF0F7',
  overlay: 'rgba(255,255,255,0.88)',
  panelBg: 'rgba(255,255,255,0.92)',
  panelBorder: 'rgba(0,102,255,0.25)',
  panelAccent: '#0066FF',
  coordColor: '#0D0E1A',
  coordDecimal: '#0066FF',
  shutterBorder: '#0066FF',
  shutterGlow: '#0066FF',
};

export const DARK = {
  mode: 'dark',
  bg: '#0A0A0F',
  surface: '#12121E',
  surface2: '#1A1A2E',
  border: '#2A2A3E',
  text: '#FFFFFF',
  textSub: '#AAAACC',
  textMuted: '#666688',
  accent: '#00F5C4',
  accentGreen: '#00F5C4',
  danger: '#FF6B6B',
  warn: '#FFD700',
  tabBar: '#0A0A0F',
  tabBarBorder: '#1E1E2E',
  controlBg: '#1A1A2E',
  overlay: 'rgba(0,0,0,0.75)',
  panelBg: 'rgba(0,0,0,0.78)',
  panelBorder: 'rgba(0,245,196,0.4)',
  panelAccent: '#00F5C4',
  coordColor: '#FFFFFF',
  coordDecimal: 'rgba(0,245,196,0.85)',
  shutterBorder: '#00F5C4',
  shutterGlow: '#00F5C4',
};

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [themePref, setThemePref] = useState(_savedPref);
  const [accentOverride, setAccentOverride] = useState(null);
  const [ready, setReady] = useState(false);

  // Load persisted values on first mount
  useEffect(() => {
    (async () => {
      try {
        const [savedTheme, savedAccent] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_THEME),
          AsyncStorage.getItem(STORAGE_KEY_ACCENT),
        ]);
        if (savedTheme) { _savedPref = savedTheme; setThemePref(savedTheme); }
        if (savedAccent) setAccentOverride(savedAccent);
      } catch {}
      setReady(true);
    })();
  }, []);

  const saveThemePref = (pref) => {
    _savedPref = pref;
    setThemePref(pref);
    AsyncStorage.setItem(STORAGE_KEY_THEME, pref).catch(() => {});
  };

  const saveAccentOverride = (color) => {
    setAccentOverride(color);
    if (color) {
      AsyncStorage.setItem(STORAGE_KEY_ACCENT, color).catch(() => {});
    } else {
      AsyncStorage.removeItem(STORAGE_KEY_ACCENT).catch(() => {});
    }
  };

  const resolvedMode = themePref === 'auto'
    ? (systemScheme === 'dark' ? 'dark' : 'light')
    : themePref;

  const baseTheme = resolvedMode === 'dark' ? DARK : LIGHT;

  const theme = accentOverride
    ? {
        ...baseTheme,
        accent:        accentOverride,
        accentGreen:   accentOverride,
        shutterBorder: accentOverride,
        shutterGlow:   accentOverride,
        panelAccent:   accentOverride,
        coordDecimal:  accentOverride,
        panelBorder:   `${accentOverride}66`,
      }
    : baseTheme;

  // Don't render children until prefs are loaded (avoids flash)
  if (!ready) return null;

  return (
    <ThemeContext.Provider value={{ theme, themePref, setThemePref: saveThemePref, accentOverride, setAccentOverride: saveAccentOverride }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
