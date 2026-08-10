import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Switch, TouchableOpacity,
  ScrollView, Platform, Linking, Image, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';

const { width } = Dimensions.get('window');

// Backward-compat stub
export function getMapStyle() { return 'satellite'; }

export default function SettingsScreen() {
  const { showAlert } = useAlert();
  const {
    theme: T, themePref, setThemePref, accentOverride, setAccentOverride,
    stampPosition, saveStampPosition, stampMapSize, saveStampMapSize,
    mapStyle, saveMapStyle, gpsDeeplink, saveGpsDeeplink,
    autoSave, saveAutoSave, horizontalMode, saveHorizontalMode,
    watermarkEnabled, saveWatermarkEnabled,
    showLocation, saveShowLocation, showFlag, saveShowFlag,
    showLatLong, saveShowLatLong, showDate, saveShowDate,
    muteAudio, saveMuteAudio,
  } = useTheme();
  const overlayColor = accentOverride || T.accent;

  const OVERLAY_COLORS = [
    { label: 'Cyan',    value: '#00F5C4' },
    { label: 'Blue',    value: '#1877F2' },
    { label: 'Gold',    value: '#FFD700' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: T.surface }}>
        <View style={[styles.header, { borderBottomColor: T.border }]}>
          <Text style={[styles.headerTitle, { color: T.text }]}>Settings</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* Section 1: Camera & Recording */}
        <Text style={[styles.sectionLabel, { color: T.accent }]}>CAMERA & RECORDING</Text>
        <View style={[styles.listCard, { backgroundColor: T.surface }]}>
          <SettingRow icon="location-outline" iconBg="#E3F2FD" iconColor="#1E88E5" label="Save GPS location" T={T}
            right={<Switch value={autoSave} onValueChange={saveAutoSave} trackColor={{ false: T.border, true: T.accent }} />} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <SettingRow icon="mic-off-outline" iconBg="#FCE4EC" iconColor="#E91E63" label="Mute audio while recording" T={T}
            right={<Switch value={muteAudio} onValueChange={saveMuteAudio} trackColor={{ false: T.border, true: T.accent }} />} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <SettingRow icon="earth-outline" iconBg="#F3E5F5" iconColor="#8E24AA" label="Satellite map mode" T={T}
            right={<Switch value={mapStyle === 'satellite'} onValueChange={() => saveMapStyle(mapStyle === 'satellite' ? 'roadmap' : 'satellite')} trackColor={{ false: T.border, true: T.accent }} />} />
        </View>

        {/* Section 2: GPS Stamp Options */}
        <Text style={[styles.sectionLabel, { color: T.accent }]}>GPS STAMP OPTIONS</Text>
        <View style={[styles.listCard, { backgroundColor: T.surface }]}>
          <SettingRow icon="map-outline" iconBg="#E3F2FD" iconColor="#1E88E5" label="Location (Address)" T={T}
            right={<Switch value={showLocation} onValueChange={saveShowLocation} trackColor={{ false: T.border, true: T.accent }} />} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <SettingRow icon="flag-outline" iconBg="#FFF3E0" iconColor="#FB8C00" label="Country Flag Emoji" T={T}
            right={<Switch value={showFlag} onValueChange={saveShowFlag} trackColor={{ false: T.border, true: T.accent }} />} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <SettingRow icon="compass-outline" iconBg="#E8F5E9" iconColor="#43A047" label="Latitude & Longitude" T={T}
            right={<Switch value={showLatLong} onValueChange={saveShowLatLong} trackColor={{ false: T.border, true: T.accent }} />} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <SettingRow icon="calendar-outline" iconBg="#F3E5F5" iconColor="#8E24AA" label="Date & Time" T={T}
            right={<Switch value={showDate} onValueChange={saveShowDate} trackColor={{ false: T.border, true: T.accent }} />} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <SettingRow icon="water-outline" iconBg="#E0F7FA" iconColor="#00ACC1" label="Watermark Brand Logo" T={T}
            right={<Switch value={watermarkEnabled} onValueChange={saveWatermarkEnabled} trackColor={{ false: T.border, true: T.accent }} />} />
        </View>

        {/* Section 3: Theme & Appearance */}
        <Text style={[styles.sectionLabel, { color: T.accent }]}>THEME & APPEARANCE</Text>
        <View style={[styles.listCard, { backgroundColor: T.surface }]}>
          <SettingRow icon="moon-outline" iconBg="#EDE7F6" iconColor="#5E35B1" label="Dark Theme" T={T}
            right={<Switch value={themePref === 'dark'} onValueChange={(val) => setThemePref(val ? 'dark' : 'light')} trackColor={{ false: T.border, true: T.accent }} />} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <View style={{ padding: 16 }}>
            <Text style={[styles.subsectionTitle, { color: T.text }]}>Accent Color</Text>
            <View style={styles.colorRow}>
              {OVERLAY_COLORS.map(c => (
                <TouchableOpacity key={c.value}
                  style={[styles.colorDot, { backgroundColor: c.value }, overlayColor === c.value && styles.colorDotActive]}
                  onPress={() => setAccentOverride(c.value)}>
                  {overlayColor === c.value && <Ionicons name="checkmark" size={14} color="#000" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Section 4: About GeoSnap */}
        <Text style={[styles.sectionLabel, { color: T.accent }]}>ABOUT GEOSNAP</Text>
        <View style={[styles.listCard, { backgroundColor: T.surface, marginBottom: 120 }]}>
          <TouchableOpacity 
            style={{ padding: 18, alignItems: 'center', gap: 6 }}
            onPress={() => Linking.openURL('https://jaisonlobo.netlify.app/')}
            activeOpacity={0.75}
          >
            <Text style={{ color: T.text, fontSize: 13, fontWeight: '700' }}>
              © 2026 GeoSnap. All rights reserved.
            </Text>
            <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '600', marginTop: 2 }}>
              Version 1.0.0
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
              <Ionicons name="code-slash-outline" size={14} color={T.accent} />
              <Text style={{ color: T.accent, fontSize: 13, fontWeight: '700' }}>
                Developer Portfolio
              </Text>
              <Ionicons name="open-outline" size={12} color={T.accent} />
            </View>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

function SettingRow({ icon, iconBg, iconColor, label, right, T }) {
  return (
    <View style={styles.settingRow}>
      <View style={[styles.settingIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={[styles.settingLabel, { color: T.text }]}>{label}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  scroll: { padding: 16, gap: 12 },

  // Section labels
  sectionLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, marginTop: 10, marginBottom: 4 },

  // List cards
  listCard: { borderRadius: 18, overflow: 'hidden', marginBottom: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 56 },

  // Setting rows
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  settingIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  settingValue: { fontSize: 14, fontWeight: '700' },

  // Option grids
  subsectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },

  // Colors
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  colorDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  colorDotActive: { borderWidth: 3, borderColor: '#FFF', transform: [{ scale: 1.1 }] },
});
