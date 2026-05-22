import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Switch, TouchableOpacity,
  ScrollView, Platform, Linking, Alert, Image, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

// Backward-compat stub
export function getMapStyle() { return 'satellite'; }

export default function SettingsScreen() {
  const [activeTab, setActiveTab] = useState('general');
  const {
    theme: T, themePref, setThemePref, accentOverride, setAccentOverride,
    stampPosition, saveStampPosition, stampMapSize, saveStampMapSize,
    mapStyle, saveMapStyle, gpsDeeplink, saveGpsDeeplink,
    autoSave, saveAutoSave,
  } = useTheme();
  const overlayColor = accentOverride || T.accent;

  const toggleGpsDeeplink = (val) => {
    saveGpsDeeplink(val);
  };

  const toggleAutoSave = (val) => {
    saveAutoSave(val);
  };

  const updateOverlayColor = (val) => {
    setAccentOverride(val);
  };

  const OVERLAY_COLORS = [
    { label: 'Cyan',    value: '#00F5C4' },
    { label: 'Blue',    value: '#4D9FFF' },
    { label: 'Gold',    value: '#FFD700' },
    { label: 'White',   value: '#FFFFFF' },
    { label: 'Orange',  value: '#FF7A00' },
    { label: 'Pink',    value: '#FF5FA0' },
    { label: 'Lime',    value: '#A8FF3E' },
    { label: 'Red',     value: '#FF4444' },
  ];

  const updateMapStyle = (val) => {
    saveMapStyle(val);
  };

  const MAP_OPTIONS = [
    { label: 'Satellite', value: 'satellite', icon: 'earth-outline' },
    { label: 'Roadmap',   value: 'roadmap',   icon: 'map-outline' },
    { label: 'Terrain',   value: 'terrain',   icon: 'layers-outline' },
    { label: 'Hybrid',    value: 'hybrid',    icon: 'git-merge-outline' },
  ];

  const MapOption = ({ label, value, icon }) => {
    const active = mapStyle === value;
    return (
      <TouchableOpacity
        style={[
          styles.cardOption,
          {
            backgroundColor: T.surface2,
            borderColor: active ? T.accent : T.border,
            borderWidth: active ? 2 : 1,
          }
        ]}
        onPress={() => updateMapStyle(value)}
        activeOpacity={0.8}
      >
        <View style={styles.cardOptionTop}>
          <Ionicons name={icon} size={20} color={active ? T.accent : T.textSub} />
          <View style={[styles.miniCheck, { backgroundColor: active ? T.accent + '20' : 'transparent' }]}>
            {active && <Ionicons name="checkmark" size={10} color={T.accent} />}
          </View>
        </View>
        <Text style={[styles.cardOptionLabel, { color: T.text }]}>{label}</Text>
        
        {/* Bottom solid slider bar matching the user design reference */}
        <View style={styles.sliderTrack}>
          <View
            style={[
              styles.sliderFill,
              {
                width: active ? '100%' : '15%',
                backgroundColor: active ? T.accent : T.border,
              }
            ]}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const ThemeOption = ({ label, value, icon }) => {
    const active = themePref === value;
    return (
      <TouchableOpacity
        style={[
          styles.cardOption,
          {
            backgroundColor: T.surface2,
            borderColor: active ? T.accent : T.border,
            borderWidth: active ? 2 : 1,
          }
        ]}
        onPress={() => setThemePref(value)}
        activeOpacity={0.8}
      >
        <View style={styles.cardOptionTop}>
          <Ionicons name={icon} size={20} color={active ? T.accent : T.textSub} />
          <View style={[styles.miniCheck, { backgroundColor: active ? T.accent + '20' : 'transparent' }]}>
            {active && <Ionicons name="checkmark" size={10} color={T.accent} />}
          </View>
        </View>
        <Text style={[styles.cardOptionLabel, { color: T.text }]}>{label}</Text>
        
        {/* Bottom solid slider bar matching the user design reference */}
        <View style={styles.sliderTrack}>
          <View
            style={[
              styles.sliderFill,
              {
                width: active ? '100%' : '15%',
                backgroundColor: active ? T.accent : T.border,
              }
            ]}
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      {/* Header — profile row */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: T.surface }}>
        <View style={[styles.headerContent, { borderBottomColor: T.border }]}>
          <View style={styles.headerProfileRow}>
            <View style={[styles.avatarWrap, { backgroundColor: T.accent + '15' }]}>
              <Ionicons name="camera" size={18} color={T.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.profileNameText, { color: T.text }]}>Settings</Text>
            </View>
            <TouchableOpacity 
              style={[styles.notificationBell, { backgroundColor: T.surface2, borderColor: T.border }]}
              onPress={() => Alert.alert('App Updates', 'Information about app. In future, new updates will appear here.')}
            >
              <Ionicons name="notifications-outline" size={18} color={T.text} />
              <View style={[styles.activeGpsBadge, { backgroundColor: T.accentGreen }]} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* Tab Switcher */}
        <View style={[styles.tabContainer, { backgroundColor: T.surface }]}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'general' && { backgroundColor: T.accent }]}
            onPress={() => setActiveTab('general')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'general' ? { color: '#000' } : { color: T.textSub }]}>General</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'customization' && { backgroundColor: T.accent }]}
            onPress={() => setActiveTab('customization')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'customization' ? { color: '#000' } : { color: T.textSub }]}>Customization</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'general' ? (
          <View>
            <SectionHeader title="Functional Settings" count="2" T={T} />
            
            {/* GPS Deep Link Switch Card */}
            <View style={[styles.groupListCard, { backgroundColor: T.surface, borderColor: T.border }]}>
              <View style={styles.groupListHeader}>
                <View style={[styles.groupIconBox, { backgroundColor: '#F3E5F5' }]}>
                  <Ionicons name="navigate-circle" size={22} color="#8E24AA" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.groupListTitle, { color: T.text }]}>GPS Deep Link</Text>
                  <Text style={[styles.groupListSubtitle, { color: T.textMuted }]}>Attach clickable maps in share caption</Text>
                </View>
                <Switch
                  value={gpsDeeplink}
                  onValueChange={toggleGpsDeeplink}
                  trackColor={{ false: T.border, true: T.accent }}
                  thumbColor={Platform.OS === 'android' ? (gpsDeeplink ? T.accent : '#f4f3f4') : undefined}
                />
              </View>
              {gpsDeeplink && (
                <View style={[styles.groupCardInnerInfo, { backgroundColor: T.surface2 }]}>
                  <Ionicons name="information-circle-outline" size={14} color="#8E24AA" />
                  <Text style={[styles.groupCardInnerInfoText, { color: T.textSub }]}>
                    A Google Maps coordinates link will automatically copy to your clipboard on capture and share, bypassing chat app restrictions.
                  </Text>
                </View>
              )}
            </View>

            {/* Auto Save Switch Card */}
            <View style={[styles.groupListCard, { backgroundColor: T.surface, borderColor: T.border }]}>
              <View style={styles.groupListHeader}>
                <View style={[styles.groupIconBox, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="sparkles" size={20} color="#2E7D32" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.groupListTitle, { color: T.text }]}>Auto-Save captures</Text>
                  <Text style={[styles.groupListSubtitle, { color: T.textMuted }]}>Skip reviews & trigger floating bubbles</Text>
                </View>
                <Switch
                  value={autoSave}
                  onValueChange={toggleAutoSave}
                  trackColor={{ false: T.border, true: T.accent }}
                  thumbColor={Platform.OS === 'android' ? (autoSave ? T.accent : '#f4f3f4') : undefined}
                />
              </View>
            </View>

            {/* About App Section */}
            <View style={[styles.aboutBlockCard, { backgroundColor: T.surface2, borderColor: T.border }]}>
              <View style={styles.aboutHeaderRow}>
                <View style={[styles.aboutIconBg, { backgroundColor: T.accent + '15', borderColor: T.accent + '33' }]}>
                  <Ionicons name="image" size={20} color={T.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.aboutTitleText, { color: T.text }]}>GeoSnap</Text>
                  <Text style={[styles.aboutSubtitleText, { color: T.textMuted }]}>GPS Map Camera  •  v2.0.0</Text>
                </View>
              </View>
              <View style={[styles.dividerLine, { backgroundColor: T.border }]} />
              <View style={styles.aboutFooterRow}>
                <Text style={[styles.copyrightLabel, { color: T.textMuted }]}>
                  © {new Date().getFullYear()} GeoSnap. All rights reserved.
                </Text>
                <TouchableOpacity onPress={() => Linking.openURL('https://jaisonlobo.netlify.app/')}>
                  <Text style={{ color: T.accent, fontSize: 11, fontWeight: '700' }}>Developer Portfolio</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <View>
            {/* Section: Appearance */}
        <SectionHeader title="Appearance" count="3" T={T} />
        <View style={styles.cardGrid}>
          <ThemeOption label="Light" value="light" icon="sunny-outline" />
          <ThemeOption label="Dark" value="dark" icon="moon-outline" />
          <ThemeOption label="Auto" value="auto" icon="phone-portrait-outline" />
        </View>

        {/* Section: Map Style */}
        <SectionHeader title="Map Style" count="4" T={T} />
        <View style={styles.cardGrid}>
          {MAP_OPTIONS.map(opt => (
            <MapOption key={opt.value} label={opt.label} value={opt.value} icon={opt.icon} />
          ))}
        </View>

        {/* Section: Stamp Layout */}
        <SectionHeader title="Stamp Position" count="2" T={T} />
        <View style={styles.cardGrid}>
          <TouchableOpacity
            style={[styles.cardOption, { backgroundColor: T.surface2, borderColor: stampPosition === 'top' ? T.accent : T.border, borderWidth: stampPosition === 'top' ? 2 : 1 }]}
            onPress={() => saveStampPosition('top')}
            activeOpacity={0.8}
          >
            <View style={styles.cardOptionTop}>
              <Ionicons name="arrow-up-outline" size={20} color={stampPosition === 'top' ? T.accent : T.textSub} />
              <View style={[styles.miniCheck, { backgroundColor: stampPosition === 'top' ? T.accent + '20' : 'transparent' }]}>
                {stampPosition === 'top' && <Ionicons name="checkmark" size={10} color={T.accent} />}
              </View>
            </View>
            <Text style={[styles.cardOptionLabel, { color: T.text }]}>Top Stamp</Text>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: stampPosition === 'top' ? '100%' : '15%', backgroundColor: stampPosition === 'top' ? T.accent : T.border }]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cardOption, { backgroundColor: T.surface2, borderColor: stampPosition === 'bottom' ? T.accent : T.border, borderWidth: stampPosition === 'bottom' ? 2 : 1 }]}
            onPress={() => saveStampPosition('bottom')}
            activeOpacity={0.8}
          >
            <View style={styles.cardOptionTop}>
              <Ionicons name="arrow-down-outline" size={20} color={stampPosition === 'bottom' ? T.accent : T.textSub} />
              <View style={[styles.miniCheck, { backgroundColor: stampPosition === 'bottom' ? T.accent + '20' : 'transparent' }]}>
                {stampPosition === 'bottom' && <Ionicons name="checkmark" size={10} color={T.accent} />}
              </View>
            </View>
            <Text style={[styles.cardOptionLabel, { color: T.text }]}>Bottom Stamp</Text>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: stampPosition === 'bottom' ? '100%' : '15%', backgroundColor: stampPosition === 'bottom' ? T.accent : T.border }]} />
            </View>
          </TouchableOpacity>
        </View>

        <SectionHeader title="Stamp Map Size" count="3" T={T} />
        <View style={styles.cardGrid}>
          {[{ label: 'Small', value: 'small' }, { label: 'Medium', value: 'medium' }, { label: 'Large', value: 'large' }].map(opt => {
            const active = stampMapSize === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.cardOption, { backgroundColor: T.surface2, borderColor: active ? T.accent : T.border, borderWidth: active ? 2 : 1 }]}
                onPress={() => saveStampMapSize(opt.value)}
                activeOpacity={0.8}
              >
                <View style={styles.cardOptionTop}>
                  <Ionicons name="resize-outline" size={20} color={active ? T.accent : T.textSub} />
                  <View style={[styles.miniCheck, { backgroundColor: active ? T.accent + '20' : 'transparent' }]}>
                    {active && <Ionicons name="checkmark" size={10} color={T.accent} />}
                  </View>
                </View>
                <Text style={[styles.cardOptionLabel, { color: T.text }]}>{opt.label}</Text>
                <View style={styles.sliderTrack}>
                  <View style={[styles.sliderFill, { width: active ? '100%' : '15%', backgroundColor: active ? T.accent : T.border }]} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Section: App Color Theme */}
        <SectionHeader title="App Color Theme" count="8" T={T} />
        <View style={[styles.groupListCard, { backgroundColor: T.surface, padding: 18 }]}>
          <Text style={[styles.sectionDescText, { color: T.textMuted }]}>
            Change the layout overlay highlights and physical photo stamps.
          </Text>
          <View style={styles.colorSwatchContainer}>
            {OVERLAY_COLORS.map(c => (
              <TouchableOpacity
                key={c.value}
                style={[
                  styles.colorSwatchRing,
                  { backgroundColor: c.value },
                  overlayColor === c.value && styles.colorSwatchActive,
                ]}
                onPress={() => updateOverlayColor(c.value)}
                activeOpacity={0.8}
              >
                {overlayColor === c.value && (
                  <Ionicons name="checkmark" size={16} color="#000" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SectionHeader({ title, count, T }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={[styles.sectionHeadingText, { color: T.text }]}>{title}</Text>
      <View style={[styles.countBadgeWrap, { backgroundColor: T.accent + '15' }]}>
        <Text style={[styles.countBadgeText, { color: T.accent }]}>{count}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContent: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerProfileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  greetingText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  profileNameText: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2, marginTop: 1 },
  notificationBell: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  activeGpsBadge: { position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 4 },
  
  scroll: { padding: 16, gap: 16 },

  // Section Headers
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 4 },
  sectionHeadingText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  countBadgeWrap: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countBadgeText: { fontSize: 10, fontWeight: '800' },

  // Options Card grid
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cardOption: {
    flex: 1,
    minWidth: '28%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  cardOptionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  miniCheck: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cardOptionLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.1 },
  sliderTrack: { height: 3, width: '100%', backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 1.5, marginTop: 4 },
  sliderFill: { height: '100%', borderRadius: 1.5 },

  // List Cards
  groupListCard: { borderRadius: 20, overflow: 'hidden', gap: 12, padding: 16, marginVertical: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  groupListHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  groupIconBox: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  groupListTitle: { fontSize: 15, fontWeight: '800' },
  groupListSubtitle: { fontSize: 11, marginTop: 2 },
  groupCardInnerInfo: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: 12, alignItems: 'flex-start' },
  groupCardInnerInfoText: { flex: 1, fontSize: 10.5, lineHeight: 16, fontWeight: '500' },

  // Colors Swatch
  sectionDescText: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  colorSwatchContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorSwatchRing: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  colorSwatchActive: { borderWidth: 3, borderColor: '#000', transform: [{ scale: 1.1 }] },

  // About Block Card
  aboutBlockCard: { borderRadius: 20, padding: 16, gap: 12, marginTop: 8, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  aboutHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aboutIconBg: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  aboutTitleText: { fontSize: 16, fontWeight: '800' },
  aboutSubtitleText: { fontSize: 11, marginTop: 2 },
  dividerLine: { height: StyleSheet.hairlineWidth },
  aboutFooterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copyrightLabel: { fontSize: 10, flex: 1 },
  
  // Tab Switcher
  tabContainer: { flexDirection: 'row', borderRadius: 16, padding: 4, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10 },
  tabText: { fontSize: 13, fontWeight: '700' },
});
