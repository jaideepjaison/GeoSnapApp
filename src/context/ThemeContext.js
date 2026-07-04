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
const STORAGE_KEY_HORIZONTAL     = '@geosnap_horizontal_mode';
const STORAGE_KEY_WATERMARK      = '@geosnap_watermark_enabled';

let _savedPref = 'auto';
const ThemeContext = createContext();

/* ── GEO SNAP LIQUID GLASS PALETTE ── */
export const LIGHT = {
  mode: 'light',
  bg: '#F6F8FC',
  surface: '#FFFFFF',
  surface2: '#EEF1F8',
  border: '#D5DAE8',
  text: '#0C0D1A',
  textSub: '#4A4C6A',
  textMuted: '#8E90B0',
  accent: '#1877F2',
  accentSecondary: '#4F46E5',
  accentCyan: '#06B6D4',
  accentGreen: '#22C55E',
  danger: '#EF4444',
  warn: '#F59E0B',
  tabBar: 'rgba(255,255,255,0.75)',
  tabBarBorder: 'rgba(255,255,255,0.5)',
  controlBg: 'rgba(255,255,255,0.75)',
  overlay: 'rgba(255,255,255,0.92)',
  panelBg: 'rgba(255,255,255,0.75)',
  panelBorder: 'rgba(24,119,242,0.2)',
  panelAccent: '#1877F2',
  coordColor: '#0C0D1A',
  coordDecimal: '#1877F2',
  shutterBorder: '#1877F2',
  shutterGlow: '#1877F2',
  glassBg: 'rgba(255,255,255,0.75)', // White 75% for Light Mode cards
  glassBorder: 'rgba(255,255,255,0.8)',
  headerGradient: ['#FAFBFF', '#F0F2FA'],
};

export const DARK = {
  mode: 'dark',
  bg: '#0B1220',
  surface: '#121D2E',
  surface2: '#1A2233', // #1A2233 for Dark mode cards as per spec
  border: '#243352',
  text: '#F0F2FF',
  textSub: '#A0B0D0',
  textMuted: '#5A6A8A',
  accent: '#1877F2',
  accentSecondary: '#4F46E5',
  accentCyan: '#06B6D4',
  accentGreen: '#22C55E',
  danger: '#FF6B6B',
  warn: '#F59E0B',
  tabBar: 'rgba(18,29,46,0.85)',
  tabBarBorder: 'rgba(255,255,255,0.06)',
  controlBg: 'rgba(26,34,51,0.8)',
  overlay: 'rgba(11,18,32,0.88)',
  panelBg: 'rgba(26,34,51,0.75)', // 1A2233 with opacity
  panelBorder: 'rgba(24,119,242,0.3)',
  panelAccent: '#1877F2',
  coordColor: '#F0F2FF',
  coordDecimal: '#06B6D4',
  shutterBorder: '#1877F2',
  shutterGlow: '#1877F2',
  glassBg: 'rgba(26,34,51,0.75)', // #1A2233 with 75% opacity for Dark Mode
  glassBorder: 'rgba(255,255,255,0.08)',
  headerGradient: ['#121D2E', '#0E1828'],
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
  const [horizontalMode, setHorizontalMode] = useState(false);
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [savedTheme, savedAccent, savedStampPos, savedStampSize, savedMapStyle, savedGpsDeep, savedHorizontal, savedWatermark] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_THEME),
          AsyncStorage.getItem(STORAGE_KEY_ACCENT),
          AsyncStorage.getItem(STORAGE_KEY_STAMP_POSITION),
          AsyncStorage.getItem(STORAGE_KEY_STAMP_MAP_SIZE),
          AsyncStorage.getItem(STORAGE_KEY_MAP_STYLE),
          AsyncStorage.getItem(STORAGE_KEY_GPS_DEEPLINK),
          AsyncStorage.getItem(STORAGE_KEY_HORIZONTAL),
          AsyncStorage.getItem(STORAGE_KEY_WATERMARK),
        ]);
        if (savedTheme) { _savedPref = savedTheme; setThemePref(savedTheme); }
        if (savedAccent) setAccentOverride(savedAccent);
        if (savedStampPos) setStampPosition(savedStampPos);
        if (savedStampSize) setStampMapSize(savedStampSize);
        if (savedMapStyle) setMapStyle(savedMapStyle);
        if (savedGpsDeep === 'true') setGpsDeeplink(true);
        if (savedHorizontal === 'true') setHorizontalMode(true);
        if (savedWatermark === 'false') setWatermarkEnabled(false);
        setAutoSave(true);
      } catch {}
      setReady(true);
    })();
  }, []);

  const saveThemePref = (pref) => { _savedPref = pref; setThemePref(pref); AsyncStorage.setItem(STORAGE_KEY_THEME, pref).catch(() => {}); };
  const saveAccentOverride = (color) => { setAccentOverride(color); color ? AsyncStorage.setItem(STORAGE_KEY_ACCENT, color).catch(() => {}) : AsyncStorage.removeItem(STORAGE_KEY_ACCENT).catch(() => {}); };
  const saveStampPosition = (pos) => { setStampPosition(pos); AsyncStorage.setItem(STORAGE_KEY_STAMP_POSITION, pos).catch(() => {}); };
  const saveStampMapSize = (size) => { setStampMapSize(size); AsyncStorage.setItem(STORAGE_KEY_STAMP_MAP_SIZE, size).catch(() => {}); };
  const saveMapStyle = (style) => { setMapStyle(style); AsyncStorage.setItem(STORAGE_KEY_MAP_STYLE, style).catch(() => {}); };
  const saveGpsDeeplink = (val) => { setGpsDeeplink(val); AsyncStorage.setItem(STORAGE_KEY_GPS_DEEPLINK, val ? 'true' : 'false').catch(() => {}); };
  const saveAutoSave = (val) => { setAutoSave(val); AsyncStorage.setItem(STORAGE_KEY_AUTOSAVE, val ? 'true' : 'false').catch(() => {}); };
  const saveHorizontalMode = (val) => { setHorizontalMode(val); AsyncStorage.setItem(STORAGE_KEY_HORIZONTAL, val ? 'true' : 'false').catch(() => {}); };
  const saveWatermarkEnabled = (val) => { setWatermarkEnabled(val); AsyncStorage.setItem(STORAGE_KEY_WATERMARK, val ? 'true' : 'false').catch(() => {}); };

  const resolvedMode = themePref === 'auto' ? (systemScheme === 'dark' ? 'dark' : 'light') : themePref;
  const baseTheme = resolvedMode === 'dark' ? DARK : LIGHT;

  const theme = accentOverride
    ? { ...baseTheme, accent: accentOverride, accentGreen: accentOverride, shutterBorder: accentOverride, shutterGlow: accentOverride, panelAccent: accentOverride, coordDecimal: accentOverride, panelBorder: `${accentOverride}66` }
    : baseTheme;

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
      horizontalMode, saveHorizontalMode,
      watermarkEnabled, saveWatermarkEnabled,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
