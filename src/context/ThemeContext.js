import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_THEME  = '@geosnap_theme_pref';
const STORAGE_KEY_ACCENT = '@geosnap_accent_color';
const STORAGE_KEY_STAMP_POSITION = '@geosnap_stamp_position';
const STORAGE_KEY_STAMP_MAP_SIZE = '@geosnap_stamp_map_size';
const STORAGE_KEY_MAP_STYLE      = '@geosnap_map_style';
const STORAGE_KEY_GPS_DEEPLINK   = '@geosnap_gps_deeplink';
const STORAGE_KEY_AUTOSAVE       = '@geosnap_autosave';

let _savedPref = 'auto';
const ThemeContext = createContext();

export const LIGHT = {
  mode: 'light',
  bg: '#F5F6FA',
  surface: '#FFFFFF',
  surface2: '#ECEEF5',
  border: '#D5D9E8',
  text: '#0C0D1A',
  textSub: '#4A4C6A',
  textMuted: '#8E90B0',
  accent: '#0066FF',
  accentGreen: '#00B087',
  danger: '#FF3B30',
  warn: '#FF9500',
  tabBar: '#FAFBFF',
  tabBarBorder: '#E2E5F0',
  controlBg: '#ECEEF5',
  overlay: 'rgba(255,255,255,0.92)',
  panelBg: 'rgba(255,255,255,0.94)',
  panelBorder: 'rgba(0,102,255,0.18)',
  panelAccent: '#0066FF',
  coordColor: '#0C0D1A',
  coordDecimal: '#0066FF',
  shutterBorder: '#0066FF',
  shutterGlow: '#0066FF',
  headerGradient: ['#FAFBFF', '#F0F2FA'],
};

export const DARK = {
  mode: 'dark',
  bg: '#08080E',
  surface: '#101018',
  surface2: '#18182A',
  border: '#262640',
  text: '#F0F0FF',
  textSub: '#A0A0C8',
  textMuted: '#5A5A7A',
  accent: '#00F5C4',
  accentGreen: '#00F5C4',
  danger: '#FF6B6B',
  warn: '#FFD700',
  tabBar: '#08080E',
  tabBarBorder: '#1A1A30',
  controlBg: '#18182A',
  overlay: 'rgba(0,0,0,0.82)',
  panelBg: 'rgba(6,6,14,0.85)',
  panelBorder: 'rgba(0,245,196,0.3)',
  panelAccent: '#00F5C4',
  coordColor: '#F0F0FF',
  coordDecimal: 'rgba(0,245,196,0.85)',
  shutterBorder: '#00F5C4',
  shutterGlow: '#00F5C4',
  headerGradient: ['#101018', '#0C0C16'],
};

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [themePref, setThemePref] = useState(_savedPref);
  const [accentOverride, setAccentOverride] = useState(null);
  const [stampPosition, setStampPosition] = useState('bottom');
  const [stampMapSize, setStampMapSize] = useState('medium');
  const [mapStyle, setMapStyle] = useState('satellite');
  const [gpsDeeplink, setGpsDeeplink] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [ready, setReady] = useState(false);

  // Load persisted values on first mount
  useEffect(() => {
    (async () => {
      try {
        const [savedTheme, savedAccent, savedStampPos, savedStampSize, savedMapStyle, savedGpsDeep, savedAutoSave] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_THEME),
          AsyncStorage.getItem(STORAGE_KEY_ACCENT),
          AsyncStorage.getItem(STORAGE_KEY_STAMP_POSITION),
          AsyncStorage.getItem(STORAGE_KEY_STAMP_MAP_SIZE),
          AsyncStorage.getItem(STORAGE_KEY_MAP_STYLE),
          AsyncStorage.getItem(STORAGE_KEY_GPS_DEEPLINK),
          AsyncStorage.getItem(STORAGE_KEY_AUTOSAVE),
        ]);
        if (savedTheme) { _savedPref = savedTheme; setThemePref(savedTheme); }
        if (savedAccent) setAccentOverride(savedAccent);
        if (savedStampPos) setStampPosition(savedStampPos);
        if (savedStampSize) setStampMapSize(savedStampSize);
        if (savedMapStyle) setMapStyle(savedMapStyle);
        if (savedGpsDeep === 'true') setGpsDeeplink(true);
        if (savedAutoSave !== null) setAutoSave(savedAutoSave === 'true');
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

  const saveStampPosition = (pos) => {
    setStampPosition(pos);
    AsyncStorage.setItem(STORAGE_KEY_STAMP_POSITION, pos).catch(() => {});
  };

  const saveStampMapSize = (size) => {
    setStampMapSize(size);
    AsyncStorage.setItem(STORAGE_KEY_STAMP_MAP_SIZE, size).catch(() => {});
  };

  const saveMapStyle = (style) => {
    setMapStyle(style);
    AsyncStorage.setItem(STORAGE_KEY_MAP_STYLE, style).catch(() => {});
  };

  const saveGpsDeeplink = (val) => {
    setGpsDeeplink(val);
    AsyncStorage.setItem(STORAGE_KEY_GPS_DEEPLINK, val ? 'true' : 'false').catch(() => {});
  };

  const saveAutoSave = (val) => {
    setAutoSave(val);
    AsyncStorage.setItem(STORAGE_KEY_AUTOSAVE, val ? 'true' : 'false').catch(() => {});
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
    <ThemeContext.Provider value={{
      theme, themePref, setThemePref: saveThemePref,
      accentOverride, setAccentOverride: saveAccentOverride,
      stampPosition, saveStampPosition,
      stampMapSize, saveStampMapSize,
      mapStyle, saveMapStyle,
      gpsDeeplink, saveGpsDeeplink,
      autoSave, saveAutoSave,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
