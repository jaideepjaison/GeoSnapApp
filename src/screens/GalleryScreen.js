import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, SectionList, Image,
  TouchableOpacity, Alert, ActivityIndicator,
  Dimensions, Modal, Platform, Animated, Clipboard,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');
const COLS = 3;
const ITEM_SIZE = (width - 24) / COLS; // Added perfect card margins

const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
};

const groupPhotosByDate = (photos) => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = {};
  photos.forEach(photo => {
    const ts = photo.creationTime > 100000000000 ? photo.creationTime : photo.creationTime * 1000;
    const d = new Date(ts);
    let label;
    if (d.toDateString() === today.toDateString()) label = 'Today';
    else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
    else label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    if (!groups[label]) groups[label] = { title: label, sortKey: d.getTime(), data: [] };
    groups[label].data.push(photo);
  });

  return Object.values(groups)
    .sort((a, b) => b.sortKey - a.sortKey)
    .map(g => ({
      title: g.title,
      count: g.data.length,
      data: chunkArray(g.data, 3),
    }));
};

function FadeInPhoto({ photo, onPress, T }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <TouchableOpacity style={[styles.photoItem, { borderColor: T.border }]} activeOpacity={0.85} onPress={onPress}>
      <Animated.View style={{ width: '100%', height: '100%', opacity }}>
        <Image source={{ uri: photo.uri }} style={styles.photo} />
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function GalleryScreen({ navigation }) {
  const { theme: T } = useTheme();
  const [photos, setPhotos] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);

  useFocusEffect(useCallback(() => { loadPhotos(); }, []));

  const loadPhotos = async () => {
    setLoading(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (perm.status !== 'granted') { setHasPermission(false); setLoading(false); return; }
      setHasPermission(true);
      const album = await MediaLibrary.getAlbumAsync('GeoSnap');
      if (!album) { setPhotos([]); setSections([]); setLoading(false); return; }
      
      const result = await MediaLibrary.getAssetsAsync({
        album,
        mediaType: 'photo',
        sortBy: [[MediaLibrary.SortBy.creationTime, false]], 
        first: 150,
      });
      setPhotos(result.assets);
      setSections(groupPhotosByDate(result.assets));
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
      let lat = null;
      let lon = null;
      
      try {
        const info = await MediaLibrary.getAssetInfoAsync(photo.id);
        if (info && info.location) {
          lat = info.location.latitude;
          lon = info.location.longitude;
        }
      } catch (e) {
        console.log('Could not extract location from asset exif:', e);
      }

      if (lat !== null && lon !== null) {
        const mapUrl = `https://maps.google.com/?q=${lat.toFixed(6)},${lon.toFixed(6)}`;
        const caption = `📍 GeoSnap Captured Location\nCoordinates: ${lat.toFixed(6)}, ${lon.toFixed(6)}\n🗺️ Open in Google Maps: ${mapUrl}\nCaptured with GeoSnap`;
        
        Clipboard.setString(caption);

        Alert.alert(
          'GPS Link Copied!',
          'Location coordinates & clickable Google Maps link copied! You can now share and long-press in WhatsApp to paste the caption.',
          [
            {
              text: 'OK & Share Photo',
              onPress: async () => {
                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(photo.uri, { mimeType: 'image/jpeg', dialogTitle: 'Share GeoSnap photo' });
                }
              }
            }
          ]
        );
      } else {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(photo.uri, { mimeType: 'image/jpeg', dialogTitle: 'Share GeoSnap photo' });
        }
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const shareAsPdf = async (photo) => {
    try {
      const html = `
        <html>
          <body style="display:flex; justify-content:center; align-items:center; height:100vh; margin:0; background-color:#fff;">
            <img src="${photo.uri}" style="max-width:100%; max-height:100%; object-fit:contain;" />
          </body>
        </html>
      `;
      const { uri } = await Print.printToFileAsync({ html, margins: { left: 0, top: 0, right: 0, bottom: 0 } });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share GeoSnap PDF' });
      }
    } catch (err) {
      Alert.alert('Error', 'Could not generate PDF: ' + err.message);
    }
  };

  const handleImport = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        navigation.navigate('Camera', { importedImageUri: result.assets[0].uri });
      }
    } catch (err) {
      Alert.alert('Import Error', err.message);
    }
  };

  const formatDate = (ts) => {
    const actualTs = ts > 100000000000 ? ts : ts * 1000;
    const d = new Date(actualTs);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const renderRow = ({ item: row }) => (
    <View style={styles.row}>
      {row.map(photo => (
        <FadeInPhoto key={photo.id} photo={photo} T={T} onPress={() => setSelected(photo)} />
      ))}
      {row.length < COLS && Array.from({ length: COLS - row.length }).map((_, i) => (
        <View key={`spacer-${i}`} style={styles.spacer} />
      ))}
    </View>
  );

  const renderSectionHeader = ({ section }) => (
    <View style={[styles.sectionHeader, { backgroundColor: T.bg + 'E6' }]}>
      <Text style={[styles.sectionTitle, { color: T.accent }]}>{section.title}</Text>
      <View style={[styles.sectionCountBadge, { backgroundColor: T.accent + '15' }]}>
        <Text style={[styles.sectionCountText, { color: T.accent }]}>
          {section.count} {section.count === 1 ? 'photo' : 'photos'}
        </Text>
      </View>
    </View>
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
      {/* Header — compact title bar */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: T.surface }}>
        <View style={[styles.headerContent, { borderBottomColor: T.border }]}>
          <View style={styles.headerProfileRow}>
            <View style={[styles.avatarWrap, { backgroundColor: T.accent + '15' }]}>
              <Ionicons name="images" size={18} color={T.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.greetingText, { color: T.textMuted }]}>Captured Memories</Text>
              <Text style={[styles.profileNameText, { color: T.text }]}>GeoSnap Gallery</Text>
            </View>
            <TouchableOpacity onPress={handleImport} style={[styles.refreshIconBtn, { backgroundColor: T.surface2, borderColor: T.border, marginRight: 8 }]}>
              <Ionicons name="folder-open-outline" size={18} color={T.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={loadPhotos} style={[styles.refreshIconBtn, { backgroundColor: T.surface2, borderColor: T.border }]}>
              <Ionicons name="refresh-outline" size={18} color={T.text} />
            </TouchableOpacity>
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
        <SectionList
          sections={sections}
          keyExtractor={(row, index) => `row-${index}-${row.map(p => p.id).join('-')}`}
          renderItem={renderRow}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={true}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.listHeaderWrap}>
              {/* Royal Purple memory diagnostic tracker card */}
              <View style={[styles.heroCard, { backgroundColor: '#5B42F3' }]}>
                <View style={styles.heroCardLeft}>
                  <Text style={styles.heroCardLabel}>Your Memory Vault</Text>
                  <Text style={styles.heroCardStatus}>
                    {photos.length === 1 ? '1 Photo Saved' : `${photos.length} Photos Saved`}
                  </Text>
                  <Text style={styles.heroCardSub}>GPS visual stamps applied seamlessly</Text>
                  <TouchableOpacity
                    style={styles.heroCardBtn}
                    onPress={loadPhotos}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.heroCardBtnText}>Sync Album</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.heroCardRight}>
                  <View style={styles.circularContainer}>
                    <View style={styles.circularOutline}>
                      <Text style={styles.circularText}>
                        {Math.min(100, Math.round((photos.length / 60) * 100))}%
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Grid Heading styled like user design In Progress */}
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionHeadingText, { color: T.text }]}>Gallery Snaps</Text>
                <View style={[styles.countBadgeWrap, { backgroundColor: T.accent + '15' }]}>
                  <Text style={[styles.countBadgeText, { color: T.accent }]}>{photos.length}</Text>
                </View>
              </View>
            </View>
          }
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
                <TouchableOpacity onPress={() => selected && shareAsPdf(selected)} style={styles.iconBtn}>
                  <Ionicons name="document-text-outline" size={22} color={T.accent} />
                </TouchableOpacity>
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
  headerContent: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerProfileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  greetingText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  profileNameText: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2, marginTop: 1 },
  refreshIconBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  
  gridContainer: { paddingBottom: 24 },
  row: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginVertical: 4 },
  photoItem: { width: ITEM_SIZE, height: ITEM_SIZE, overflow: 'hidden', borderRadius: 16, borderWidth: 1 },
  photo: { width: '100%', height: '100%' },
  spacer: { width: ITEM_SIZE, height: ITEM_SIZE },
  
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, marginTop: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  sectionCountBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  sectionCountText: { fontSize: 11, fontWeight: '700' },
  
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 1 },
  emptyTitle: { fontSize: 21, fontWeight: '700' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 21 },
  loadingText: { marginTop: 10, fontSize: 14 },
  
  // Purple Diagnostic Card (mirrors settings exactly)
  listHeaderWrap: { gap: 8 },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    shadowColor: '#5B42F3',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  heroCardLeft: { flex: 1, gap: 4 },
  heroCardLabel: { color: 'rgba(255, 255, 255, 0.75)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  heroCardStatus: { color: '#FFF', fontSize: 20, fontWeight: '800', letterSpacing: 0.2 },
  heroCardSub: { color: 'rgba(255, 255, 255, 0.85)', fontSize: 11, fontWeight: '500', marginTop: 2 },
  heroCardBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 10,
  },
  heroCardBtnText: { color: '#5B42F3', fontSize: 12, fontWeight: '700' },
  heroCardRight: { marginLeft: 16 },
  circularContainer: { alignItems: 'center', justifyContent: 'center' },
  circularOutline: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderTopColor: '#FFF',
    borderRightColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularText: { color: '#FFF', fontSize: 13, fontWeight: '800' },

  // Section Headers inside ListHeaderComponent
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginTop: 12, marginBottom: 4 },
  sectionHeadingText: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  countBadgeWrap: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countBadgeText: { fontSize: 10, fontWeight: '800' },

  // Modal styles
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
