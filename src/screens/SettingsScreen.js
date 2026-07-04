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
    watermarkEnabled, saveWatermarkEnabled
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

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>        {/* Camera Section */}
        <Text style={[styles.sectionLabel, { color: T.accent }]}>Camera</Text>
        <View style={[styles.listCard, { backgroundColor: T.surface }]}>
          <SettingRow icon="location-outline" iconBg="#E3F2FD" iconColor="#1E88E5" label="Save location" T={T}
            right={<Switch value={autoSave} onValueChange={saveAutoSave} trackColor={{ false: T.border, true: T.accent }} />} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <SettingRow icon="time-outline" iconBg="#FFF3E0" iconColor="#FB8C00" label="Auto timestamp" T={T}
            right={<Switch value={true} trackColor={{ false: T.border, true: T.accent }} />} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <SettingRow icon="grid-outline" iconBg="#E8F5E9" iconColor="#43A047" label="Grid" T={T}
            right={<Switch value={true} trackColor={{ false: T.border, true: T.accent }} />} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <SettingRow icon="hdr-outline" iconBg="#F3E5F5" iconColor="#8E24AA" label="HDR" T={T}
            right={<Switch value={true} trackColor={{ false: T.border, true: T.accent }} />} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <SettingRow icon="flash-outline" iconBg="#FFF8E1" iconColor="#FBC02D" label="Flash" T={T}
            right={<Text style={[styles.settingValue, { color: T.textSub }]}>Auto</Text>} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <SettingRow icon="water-outline" iconBg="#E0F7FA" iconColor="#00ACC1" label="Watermark" T={T}
            right={<Switch value={watermarkEnabled} onValueChange={saveWatermarkEnabled} trackColor={{ false: T.border, true: T.accent }} />} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <SettingRow icon="image-outline" iconBg="#FCE4EC" iconColor="#D81B60" label="Image quality" T={T}
            right={<Text style={[styles.settingValue, { color: T.textSub }]}>High</Text>} />
        </View>

        {/* GPS Section */}
        <Text style={[styles.sectionLabel, { color: T.accent }]}>GPS</Text>
        <View style={[styles.listCard, { backgroundColor: T.surface }]}>
          <SettingRow icon="navigate-circle-outline" iconBg="#E8F5E9" iconColor="#43A047" label="Accuracy" T={T}
            right={<Text style={[styles.settingBadge, { backgroundColor: T.accentGreen + '20', color: T.accentGreen }]}>High</Text>} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <SettingRow icon="sync-outline" iconBg="#E3F2FD" iconColor="#1E88E5" label="Update interval" T={T}
            right={<Text style={[styles.settingValue, { color: T.textSub }]}>Real-time</Text>} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <SettingRow icon="earth-outline" iconBg="#F3E5F5" iconColor="#8E24AA" label="Satellite mode" T={T}
            right={<Switch value={mapStyle === 'satellite'} onValueChange={() => saveMapStyle(mapStyle === 'satellite' ? 'roadmap' : 'satellite')} trackColor={{ false: T.border, true: T.accent }} />} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <SettingRow icon="phone-landscape-outline" iconBg="#E0F7FA" iconColor="#00ACC1" label="Horizontal mode" T={T}
            right={<Switch value={horizontalMode} onValueChange={saveHorizontalMode} trackColor={{ false: T.border, true: T.accent }} />} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <SettingRow icon="compass-outline" iconBg="#FFF3E0" iconColor="#FB8C00" label="Compass" T={T}
            right={<Switch value={true} trackColor={{ false: T.border, true: T.accent }} />} />
        </View>

        {/* Appearance Section */}
        <Text style={[styles.sectionLabel, { color: T.accent }]}>Appearance</Text>
        <View style={[styles.listCard, { backgroundColor: T.surface }]}>
          <SettingRow icon="moon-outline" iconBg="#EDE7F6" iconColor="#5E35B1" label="Theme" T={T}
            right={<Switch value={themePref === 'dark'} onValueChange={(val) => setThemePref(val ? 'dark' : 'light')} trackColor={{ false: T.border, true: T.accent }} />} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <SettingRow icon="color-palette-outline" iconBg="#E0F2F1" iconColor="#00897B" label="Dynamic colors" T={T}
            right={<Switch value={true} trackColor={{ false: T.border, true: T.accent }} />} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <View style={{ padding: 16 }}>
            <Text style={[styles.subsectionTitle, { color: T.text }]}>Accent color</Text>
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

        {/* Backup Section */}
        <Text style={[styles.sectionLabel, { color: T.accent }]}>Backup</Text>
        <View style={[styles.listCard, { backgroundColor: T.surface }]}>
          <SettingRow icon="logo-google" iconBg="#FFF3E0" iconColor="#FB8C00" label="Google Drive" T={T}
            right={<Ionicons name="cloud-offline-outline" size={20} color={T.textMuted} />} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <SettingRow icon="cloud-outline" iconBg="#E3F2FD" iconColor="#1E88E5" label="OneDrive" T={T}
            right={<Ionicons name="cloud-offline-outline" size={20} color={T.textMuted} />} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <SettingRow icon="save-outline" iconBg="#E8F5E9" iconColor="#43A047" label="Local" T={T}
            right={<Ionicons name="checkmark-circle" size={20} color={T.accentGreen} />} />
        </View>

        {/* About Section */}
        <Text style={[styles.sectionLabel, { color: T.accent }]}>About</Text>
        <View style={[styles.listCard, { backgroundColor: T.surface, marginBottom: 100 }]}>
          <SettingRow icon="information-circle-outline" iconBg="#EDE7F6" iconColor="#5E35B1" label="Version" T={T}
            right={<Text style={[styles.settingValue, { color: T.textSub }]}>2.0.0 (Liquid Glass)</Text>} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <SettingRow icon="shield-checkmark-outline" iconBg="#E0F7FA" iconColor="#00ACC1" label="Privacy Policy" T={T}
            right={<Ionicons name="chevron-forward" size={16} color={T.textMuted} />} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <SettingRow icon="chatbubble-ellipses-outline" iconBg="#FCE4EC" iconColor="#D81B60" label="Feedback" T={T}
            right={<Ionicons name="chevron-forward" size={16} color={T.textMuted} />} />
          <View style={[styles.divider, { backgroundColor: T.border }]} />
          <View style={{ padding: 16, alignItems: 'center' }}>
            <Text style={{ color: T.textMuted, fontSize: 11, marginBottom: 4 }}>© {new Date().getFullYear()} GeoSnap. All rights reserved.</Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://jaisonlobo.netlify.app/')}>
              <Text style={{ color: T.accent, fontSize: 11, fontWeight: '700' }}>Developer Portfolio</Text>
            </TouchableOpacity>
          </View>
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
  headerTitle: { fontSize: 20, fontWeight: '800' },
  scroll: { padding: 16, gap: 12 },

  // Banner
  bannerCard: { borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  bannerTextCol: { flex: 1 },
  bannerTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', lineHeight: 26 },
  bannerIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  // Section labels
  sectionLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5, marginTop: 8, marginBottom: 4 },

  // List cards
  listCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 4 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 56 },

  // Setting rows
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  settingIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  settingValue: { fontSize: 14, fontWeight: '600' },
  settingBadge: { fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },

  // Option grids
  subsectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  subsectionDesc: { fontSize: 12, lineHeight: 18, marginBottom: 10 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  optionChipText: { fontSize: 13, fontWeight: '600' },

  // Colors
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  colorDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  colorDotActive: { borderWidth: 3, borderColor: '#000', transform: [{ scale: 1.1 }] },

  // About
  aboutRow: { flexDirection: 'row', alignItems: 'center' },
  aboutTitle: { fontSize: 16, fontWeight: '800' },
  aboutSub: { fontSize: 11, marginTop: 2 },
  aboutFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
