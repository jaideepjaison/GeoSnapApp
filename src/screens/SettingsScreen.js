import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Switch, TouchableOpacity,
  ScrollView, Platform, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// R8: Module-level toggle for deep-link GPS feature
let _gpsDeeplinkEnabled = false;
export const isGpsDeeplinkEnabled = () => _gpsDeeplinkEnabled;

// Map style setting (satellite | roadmap | terrain | hybrid)
let _mapStyle = 'satellite';
export const getMapStyle = () => _mapStyle;


export default function SettingsScreen() {
  const { theme: T, themePref, setThemePref, accentOverride, setAccentOverride } = useTheme();
  const [gpsDeeplink, setGpsDeeplink] = useState(_gpsDeeplinkEnabled);
  const [mapStyle, setMapStyle] = useState(_mapStyle);
  const overlayColor = accentOverride || T.accent;

  const toggleGpsDeeplink = (val) => {
    _gpsDeeplinkEnabled = val;
    setGpsDeeplink(val);
  };

  const updateOverlayColor = (val) => {
    setAccentOverride(val);
  };

  const OVERLAY_COLORS = [
    { label: 'Cyan',    value: '#00F5C4' },
    { label: 'Blue',    value: '#4D9FFF' },
    { label: 'Gold',    value: '#FFD700' },
    { label: 'White',   value: '#600cf1ff' },
    { label: 'Orange',  value: '#FF7A00' },
    { label: 'Pink',    value: '#FF5FA0' },
    { label: 'Lime',    value: '#A8FF3E' },
    { label: 'Red',     value: '#FF4444' },
  ];

  const updateMapStyle = (val) => {
    _mapStyle = val;
    setMapStyle(val);
  };

  const MAP_OPTIONS = [
    { label: 'Satellite', value: 'satellite', icon: 'earth' },
    { label: 'Roadmap',   value: 'roadmap',   icon: 'map' },
    { label: 'Terrain',   value: 'terrain',   icon: 'layers' },
    { label: 'Hybrid',    value: 'hybrid',    icon: 'git-merge' },
  ];

  const MapOption = ({ label, value, icon }) => {
    const active = mapStyle === value;
    return (
      <TouchableOpacity
        style={[styles.themeOption, { backgroundColor: T.surface2, borderColor: active ? T.accent : T.border }, active && { borderWidth: 2 }]}
        onPress={() => updateMapStyle(value)}
        activeOpacity={0.8}
      >
        <Ionicons name={icon} size={22} color={active ? T.accent : T.textSub} />
        <Text style={[styles.themeLabel, { color: active ? T.accent : T.textSub }]}>{label}</Text>
        {active && <Ionicons name="checkmark-circle" size={16} color={T.accent} style={styles.check} />}
      </TouchableOpacity>
    );
  };

  const ThemeOption = ({ label, value, icon }) => {
    const active = themePref === value;
    return (
      <TouchableOpacity
        style={[styles.themeOption, { backgroundColor: T.surface2, borderColor: active ? T.accent : T.border }, active && { borderWidth: 2 }]}
        onPress={() => setThemePref(value)}
        activeOpacity={0.8}
      >
        <Ionicons name={icon} size={22} color={active ? T.accent : T.textSub} />
        <Text style={[styles.themeLabel, { color: active ? T.accent : T.textSub }]}>{label}</Text>
        {active && <Ionicons name="checkmark-circle" size={16} color={T.accent} style={styles.check} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: T.surface }}>
        <View style={[styles.headerContent, { borderBottomColor: T.border }]}>
          <Text style={[styles.headerTitle, { color: T.text }]}>SETTINGS</Text>
          <Text style={[styles.headerSub, { color: T.accent }]}>GEOSNAP</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* R1: Theme */}
        <Section title="APPEARANCE" T={T}>
          <Text style={[styles.sectionDesc, { color: T.textMuted }]}>
            Default is Light. Choosing Auto follows your system setting.
          </Text>
          <View style={styles.themeRow}>
            <ThemeOption label="Light" value="light" icon="sunny-outline" />
            <ThemeOption label="Dark" value="dark" icon="moon-outline" />
            <ThemeOption label="Auto" value="auto" icon="phone-portrait-outline" />
          </View>
        </Section>

        {/* Map Style */}
        <Section title="MAP STYLE" T={T}>
          <Text style={[styles.sectionDesc, { color: T.textMuted }]}>
            Choose how the map thumbnail looks on your stamped photos. Default is Satellite.
          </Text>
          <View style={styles.themeRow}>
            {MAP_OPTIONS.map(opt => (
              <MapOption key={opt.value} label={opt.label} value={opt.value} icon={opt.icon} />
            ))}
          </View>
        </Section>

        {/* R8: GPS Deep Link feature */}
        <Section title="GPS DEEP LINK" T={T}>
          <View style={[styles.row, { borderColor: T.border }]}>
            <View style={styles.rowLeft}>
              <Ionicons name="navigate-circle-outline" size={22} color={T.accent} />
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: T.text }]}>Tappable GPS in Shared Photos</Text>
                <Text style={[styles.rowDesc, { color: T.textMuted }]}>
                  When enabled, shared images include a note with GPS coordinates. Anyone who opens the image and taps the coordinates can navigate to Google Maps.
                </Text>
              </View>
            </View>
            <Switch
              value={gpsDeeplink}
              onValueChange={toggleGpsDeeplink}
              trackColor={{ false: T.border, true: T.accent }}
              thumbColor={Platform.OS === 'android' ? (gpsDeeplink ? T.accent : '#f4f3f4') : undefined}
            />
          </View>
          {gpsDeeplink && (
            <View style={[styles.infoBox, { backgroundColor: T.surface2, borderColor: T.border }]}>
              <Ionicons name="information-circle-outline" size={16} color={T.accent} />
              <Text style={[styles.infoText, { color: T.textSub }]}>
                When you share a photo, GPS coordinates are included in the caption. The recipient can tap the maps.google.com link in the caption to open Google Maps.
              </Text>
            </View>
          )}
          <View style={[styles.infoBox, { backgroundColor: T.surface2, borderColor: T.border, marginTop: 8 }]}>
            <Ionicons name="alert-circle-outline" size={16} color={T.warn || '#FF9500'} />
            <Text style={[styles.infoText, { color: T.textSub }]}>
              Note: Embedding clickable links directly inside JPEG images is not supported by WhatsApp or the gallery system. The GPS coordinates are burned visually into the photo and a Google Maps link is included in the share caption.
            </Text>
          </View>
        </Section>

        {/* Stamp Accent Color */}
        <Section title="STAMP ACCENT COLOR" T={T}>
          <Text style={[styles.sectionDesc, { color: T.textMuted }]}>
            Changes the highlight color across the app and on the photo stamp.
          </Text>
          <View style={styles.colorGrid}>
            {OVERLAY_COLORS.map(c => (
              <TouchableOpacity
                key={c.value}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: c.value },
                  overlayColor === c.value && styles.colorSwatchActive,
                ]}
                onPress={() => updateOverlayColor(c.value)}
                activeOpacity={0.8}
              >
                {overlayColor === c.value && (
                  <Ionicons name="checkmark" size={18} color="#000" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* About & Developer — always last */}
        <View style={[styles.aboutBlock, { backgroundColor: T.surface2, borderColor: T.border }]}>
          {/* App info row */}
          <View style={styles.aboutAppRow}>
            <View style={[styles.aboutIcon, { backgroundColor: T.accent + '22', borderColor: T.accent + '44' }]}>
              <Ionicons name="camera" size={22} color={T.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.aboutAppName, { color: T.text }]}>GeoSnap</Text>
              <Text style={[styles.aboutAppVersion, { color: T.textMuted }]}>GPS Map Camera  •  v2.0.0</Text>
            </View>
          </View>

          <View style={[styles.aboutDivider, { backgroundColor: T.border }]} />

          {/* Portfolio + copyright */}
          <View style={styles.aboutDevRow}>
            <Text style={[styles.aboutCopyright, { color: T.textMuted, flex: 1 }]}>
              © {new Date().getFullYear()} GeoSnap. All rights reserved.
            </Text>
            <TouchableOpacity
              style={[styles.aboutWebBtn, { backgroundColor: T.accent + '18', borderColor: T.accent + '55' }]}
              onPress={() => Linking.openURL('https://jaisonlobo.netlify.app/')}
              activeOpacity={0.7}
            >
              <Ionicons name="globe-outline" size={14} color={T.accent} />
              <Text style={[styles.aboutWebBtnText, { color: T.accent }]}>Portfolio</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

function Section({ title, children, T }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: T.accent }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContent: { paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontWeight: '800', letterSpacing: 3 },
  headerSub: { fontSize: 10, fontWeight: '700', letterSpacing: 2, marginTop: 1 },
  scroll: { padding: 16, gap: 8 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 10 },
  sectionDesc: { fontSize: 12, marginBottom: 12, lineHeight: 18 },
  themeRow: { flexDirection: 'row', gap: 8 },
  themeOption: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1, gap: 6 },
  themeLabel: { fontSize: 12, fontWeight: '600' },
  check: { position: 'absolute', top: 6, right: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLeft: { flex: 1, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowDesc: { fontSize: 12, lineHeight: 18 },
  infoBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 10, borderRadius: 10, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 11, lineHeight: 17 },
  aboutCard: { borderRadius: 12, padding: 16, borderWidth: 1, gap: 4 },
  aboutName: { fontSize: 18, fontWeight: '800' },
  aboutVersion: { fontSize: 12 },
  aboutDesc: { fontSize: 13, lineHeight: 20, marginTop: 4 },
  // Color picker
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorSwatch: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  colorSwatchActive: { borderWidth: 3, borderColor: '#000', transform: [{ scale: 1.15 }] },
  // About block (bottom of settings)
  aboutBlock: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12, marginBottom: 8 },
  aboutAppRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  aboutIcon: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  aboutAppName: { fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  aboutAppVersion: { fontSize: 11, marginTop: 2 },
  aboutDivider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  aboutDevRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aboutDevLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 2 },
  aboutDevName: { fontSize: 15, fontWeight: '700' },
  aboutWebBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  aboutWebBtnText: { fontSize: 12, fontWeight: '700' },
  aboutCopyright: { fontSize: 10, textAlign: 'center', marginTop: 4 },
});

