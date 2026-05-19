import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image,
  TouchableOpacity, Alert, ActivityIndicator,
  Dimensions, Modal, Platform, Linking,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');
const COLS = 3;
const ITEM_SIZE = (width - 6) / COLS;

export default function GalleryScreen() {
  const { theme: T } = useTheme();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);

  // R6: Load sorted newest-first
  useFocusEffect(useCallback(() => { loadPhotos(); }, []));

  const loadPhotos = async () => {
    setLoading(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (perm.status !== 'granted') { setHasPermission(false); setLoading(false); return; }
      setHasPermission(true);
      const album = await MediaLibrary.getAlbumAsync('GeoSnap');
      if (!album) { setPhotos([]); setLoading(false); return; }
      // R6: sortBy creationTime descending = latest first
      const result = await MediaLibrary.getAssetsAsync({
        album,
        mediaType: 'photo',
        sortBy: [[MediaLibrary.SortBy.creationTime, false]], // false = descending
        first: 200,
      });
      setPhotos(result.assets);
    } catch (err) {
      console.error('Gallery load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const deletePhoto = async (photo) => {
    Alert.alert('Delete Photo', 'Remove this photo from your GeoSnap gallery?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await MediaLibrary.deleteAssetsAsync([photo]);
          setSelected(null);
          loadPhotos();
        } catch { Alert.alert('Error', 'Could not delete photo.'); }
      }},
    ]);
  };

  const sharePhoto = async (photo) => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(photo.uri, { mimeType: 'image/jpeg', dialogTitle: 'Share GeoSnap photo' });
      }
    } catch (err) { Alert.alert('Error', err.message); }
  };

  const formatDate = (ts) => {
    const d = new Date(ts * 1000);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const renderPhoto = ({ item, index }) => (
    <TouchableOpacity style={[styles.photoItem, { borderColor: T.border }]} activeOpacity={0.8} onPress={() => setSelected(item)}>
      <Image source={{ uri: item.uri }} style={styles.photo} />
      {/* R6: show number in order (1 = newest) */}
      <View style={[styles.photoNum, { backgroundColor: T.accent }]}>
        <Text style={[styles.photoNumText, { color: T.mode === 'dark' ? '#000' : '#FFF' }]}>{index + 1}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) return (
    <View style={[styles.centered, { backgroundColor: T.bg }]}>
      <ActivityIndicator size="large" color={T.accent} />
      <Text style={[styles.loadingText, { color: T.textMuted }]}>Loading gallery...</Text>
    </View>
  );

  if (!hasPermission) return (
    <View style={[styles.centered, { backgroundColor: T.bg }]}>
      <Ionicons name="lock-closed-outline" size={52} color={T.accent} />
      <Text style={[styles.emptyTitle, { color: T.text }]}>Permission Needed</Text>
      <Text style={[styles.emptySubtitle, { color: T.textMuted }]}>Grant Photos access to view your GeoSnap gallery</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: T.surface }}>
        <View style={[styles.headerContent, { borderBottomColor: T.border }]}>
          <View>
            <Text style={[styles.headerTitle, { color: T.text }]}>GEOSNAP</Text>
            <Text style={[styles.headerSub, { color: T.accent }]}>GALLERY</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={loadPhotos} style={styles.refreshBtn}>
              <Ionicons name="refresh-outline" size={20} color={T.accent} />
            </TouchableOpacity>
            <View style={[styles.countBadge, { backgroundColor: T.accent }]}>
              <Text style={[styles.countText, { color: T.mode === 'dark' ? '#000' : '#FFF' }]}>{photos.length}</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {photos.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: T.surface2, borderColor: T.border }]}>
            <Ionicons name="camera-outline" size={44} color={T.border} />
          </View>
          <Text style={[styles.emptyTitle, { color: T.text }]}>No photos yet</Text>
          <Text style={[styles.emptySubtitle, { color: T.textMuted }]}>Take your first GPS-tagged photo with the Camera tab</Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={item => item.id}
          renderItem={renderPhoto}
          numColumns={COLS}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Full-screen viewer */}
      <Modal visible={!!selected} transparent={false} animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={[styles.modalContainer, { backgroundColor: T.bg }]}>
          <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
            {/* Modal header */}
            <View style={[styles.modalHeader, { borderBottomColor: T.border }]}>
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.iconBtn}>
                <Ionicons name="arrow-back" size={22} color={T.text} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: T.accent }]}>GPS PHOTO</Text>
              <View style={styles.modalActions}>
                {/* R5: Share from viewer */}
                <TouchableOpacity onPress={() => selected && sharePhoto(selected)} style={styles.iconBtn}>
                  <Ionicons name="share-social-outline" size={22} color={T.accent} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => selected && deletePhoto(selected)} style={styles.iconBtn}>
                  <Ionicons name="trash-outline" size={22} color={T.danger} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Full image */}
            {selected && <Image source={{ uri: selected.uri }} style={styles.fullImage} resizeMode="contain" />}

            {/* Photo metadata */}
            {selected && (
              <View style={[styles.photoInfo, { backgroundColor: T.surface, borderTopColor: T.border }]}>
                <InfoRow icon="calendar-outline" color={T.textMuted} text={formatDate(selected.creationTime)} T={T} />
                <InfoRow icon="image-outline" color={T.textMuted} text={`${selected.width} × ${selected.height} px`} T={T} />
                <InfoRow icon="folder-outline" color={T.textMuted} text="GeoSnap Album" T={T} />
              </View>
            )}
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ icon, color, text, T }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[styles.infoText, { color: T.textSub, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 10, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontWeight: '800', letterSpacing: 3 },
  headerSub: { fontSize: 10, fontWeight: '700', letterSpacing: 2, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  refreshBtn: { padding: 4 },
  countBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, minWidth: 26, alignItems: 'center' },
  countText: { fontSize: 12, fontWeight: '800' },
  grid: { padding: 1, gap: 2 },
  photoItem: { width: ITEM_SIZE, height: ITEM_SIZE, margin: 1, overflow: 'hidden', borderRadius: 5, borderWidth: StyleSheet.hairlineWidth },
  photo: { width: '100%', height: '100%' },
  photoNum: { position: 'absolute', top: 5, right: 5, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2 },
  photoNumText: { fontSize: 9, fontWeight: '800' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 1 },
  emptyTitle: { fontSize: 21, fontWeight: '700' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 21 },
  loadingText: { marginTop: 10, fontSize: 14 },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  iconBtn: { padding: 4 },
  modalTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  modalActions: { flexDirection: 'row', gap: 8 },
  fullImage: { flex: 1, width: '100%' },
  photoInfo: { padding: 14, gap: 9, borderTopWidth: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontSize: 12 },
});
