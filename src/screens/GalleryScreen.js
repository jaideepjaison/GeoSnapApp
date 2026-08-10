import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, SectionList, Image,
  TouchableOpacity, ActivityIndicator,
  Dimensions, Modal, Platform, Animated, Clipboard, ScrollView, TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import piexif from 'piexifjs';
import Share from 'react-native-share';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import ImageViewer from 'react-native-image-zoom-viewer';
import GpsOverlay from '../components/GpsOverlay';
let ExpoVideoModule = null;
try {
  ExpoVideoModule = require('expo-video');
} catch (e) {
  ExpoVideoModule = null;
}

function VideoPlayerView({ videoUri, location, address }) {
  if (ExpoVideoModule && ExpoVideoModule.useVideoPlayer && ExpoVideoModule.VideoView) {
    const { useVideoPlayer, VideoView } = ExpoVideoModule;
    const player = useVideoPlayer({ uri: videoUri }, p => {
      p.loop = true;
      p.play();
    });

    return (
      <View style={{ flex: 1, width: '100%', minHeight: 400, justifyContent: 'center', alignItems: 'center' }}>
        <VideoView
          style={{ width: '100%', height: '100%' }}
          player={player}
          allowsFullscreen
          allowsPictureInPicture
          nativeControls
        />
        <GpsOverlay forCapture={true} location={location} address={address} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, width: '100%', minHeight: 400, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
      <Image source={{ uri: videoUri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
      <GpsOverlay forCapture={true} location={location} address={address} />
    </View>
  );
}

const { width, height } = Dimensions.get('window');
const COLS = 3;
const ITEM_SIZE = (width - 32) / COLS;

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
    const rawTs = Number(photo.modificationTime || photo.creationTime || Date.now());
    const ts = rawTs > 100000000000 ? rawTs : rawTs * 1000;
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
      data: chunkArray(g.data, COLS),
    }));
};

function FadeInPhoto({ photo, onPress, onLongPress, isSelected, selectionMode, T }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  return (
    <TouchableOpacity 
      style={styles.photoItem} 
      activeOpacity={0.85} 
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <Animated.View style={{ width: '100%', height: '100%', opacity }}>
        <Image source={{ uri: photo.uri }} style={styles.photo} />
        {photo.mediaType === 'video' && (
          <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 3 }}>
            <Ionicons name="videocam" size={14} color="#FFF" />
          </View>
        )}
        {selectionMode && (
          <View style={[styles.selectionOverlay, isSelected && { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected, { borderColor: T.text }]}>
              {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
            </View>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function GalleryScreen({ navigation }) {
  const { theme: T } = useTheme();
  const { showAlert, showToast } = useAlert();
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [sharePhotoUri, setSharePhotoUri] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  
  const [locationOverrides, setLocationOverrides] = useState({});
  const [selectedInfo, setSelectedInfo] = useState(null);
  const [editLocationVisible, setEditLocationVisible] = useState(false);
  const [tempLat, setTempLat] = useState('');
  const [tempLon, setTempLon] = useState('');
  
  // Location search state (matching CameraScreen)
  const [locQuery, setLocQuery] = useState('');
  const [locResults, setLocResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [editAddr, setEditAddr] = useState('');
  
  const scrollRef = useRef(null);

  const getHiddenAssetIds = async () => {
    try {
      const val = await AsyncStorage.getItem('geoSnapHiddenAssets');
      return val ? JSON.parse(val) : [];
    } catch {
      return [];
    }
  };

  const addHiddenAssetIds = async (idsOrUris) => {
    try {
      const existing = await getHiddenAssetIds();
      const updated = Array.from(new Set([...existing, ...idsOrUris]));
      await AsyncStorage.setItem('geoSnapHiddenAssets', JSON.stringify(updated));
    } catch {}
  };

  useEffect(() => {
    AsyncStorage.getItem('geoSnapLocationOverrides').then(val => {
      if (val) setLocationOverrides(JSON.parse(val));
    });
  }, []);

  useEffect(() => {
    if (selected) {
      MediaLibrary.getAssetInfoAsync(selected.id).then(info => {
        setSelectedInfo(info);
      }).catch(() => {});
    } else {
      setSelectedInfo(null);
    }
  }, [selected]);

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
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        first: 150,
      });

      const hiddenIds = await getHiddenAssetIds();
      const hiddenSet = new Set(hiddenIds);

      // Filter out assets deleted or hidden from app gallery
      const validAssets = (await Promise.all(
        result.assets.map(async (asset) => {
          if (hiddenSet.has(asset.id) || hiddenSet.has(asset.uri)) return null;
          try {
            const info = await FileSystem.getInfoAsync(asset.uri);
            if (info && info.exists) return asset;
            return null;
          } catch {
            return asset;
          }
        })
      )).filter(Boolean);

      // Sort newest first (newest photo/video at top, mixed together)
      validAssets.sort((a, b) => {
        const timeA = Number(a.creationTime || a.modificationTime || 0);
        const timeB = Number(b.creationTime || b.modificationTime || 0);
        return timeB - timeA;
      });

      setPhotos(validAssets);
      setSections(groupPhotosByDate(validAssets));
    } catch (err) {
      console.error('Gallery load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const deletePhoto = async (photo) => {
    showAlert('Delete Item', 'Remove this item from your GeoSnap gallery?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await addHiddenAssetIds([photo.id, photo.uri]);
          try { await FileSystem.deleteAsync(photo.uri, { idempotent: true }); } catch {}
          setSelected(null);
          loadPhotos();
          showToast('Deleted item');
        } catch { showAlert('Error', 'Could not delete item.'); }
      }},
    ]);
  };

  const deleteSelected = async () => {
    if (selectedPhotos.length === 0) return;
    showAlert('Delete Items', `Delete ${selectedPhotos.length} selected items?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const idsAndUris = [];
          for (const item of selectedPhotos) {
            if (typeof item === 'string') {
              idsAndUris.push(item);
              try { await FileSystem.deleteAsync(item, { idempotent: true }); } catch {}
            } else if (item?.id || item?.uri) {
              if (item.id) idsAndUris.push(item.id);
              if (item.uri) {
                idsAndUris.push(item.uri);
                try { await FileSystem.deleteAsync(item.uri, { idempotent: true }); } catch {}
              }
            }
          }
          await addHiddenAssetIds(idsAndUris);
          cancelSelection();
          loadPhotos();
          showToast('Deleted selected items');
        } catch (err) {
          showAlert('Error', 'Failed to delete: ' + err.message);
        }
      }}
    ]);
  };

  const generatePDF = async () => {
    if (selectedPhotos.length === 0) return;
    setLoading(true);
    try {
      const compressedImages = [];
      for (const photo of selectedPhotos) {
        const manipResult = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 800 } }],
          { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        compressedImages.push(manipResult.base64);
      }

      let html = `<html><body style="margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center;">`;
      for (const base64 of compressedImages) {
        html += `<div style="margin-bottom: 20px; page-break-inside: avoid; width: 100%; text-align: center;">
                   <img src="data:image/jpeg;base64,${base64}" style="max-width: 100%; max-height: 90vh; object-fit: contain;" />
                 </div>`;
      }
      html += `</body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share PDF' });
      }
      cancelSelection();
    } catch (err) {
      showAlert('Error', 'Could not generate PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (photo) => {
    setSelectedPhotos(prev => {
      const exists = prev.find(p => p.id === photo.id);
      if (exists) return prev.filter(p => p.id !== photo.id);
      return [...prev, photo];
    });
  };

  const handlePhotoPress = (photo) => {
    if (selectionMode) toggleSelection(photo);
    else setSelected(photo);
  };

  const handleLongPress = (photo) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedPhotos([photo]);
    }
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedPhotos([]);
  };

  const selectAll = () => {
    if (selectedPhotos.length === photos.length) setSelectedPhotos([]);
    else setSelectedPhotos([...photos]);
  };

  const saveLocation = async (overrideOriginal = false) => {
    if (!selected) return;
    const lat = parseFloat(tempLat);
    const lon = parseFloat(tempLon);
    if (isNaN(lat) || isNaN(lon)) {
      showAlert('Invalid Input', 'Please enter valid numbers for latitude and longitude.');
      return;
    }
    setEditLocationVisible(false);
    
    const newOverrides = { ...locationOverrides, [selected.id]: { lat, lon } };
    
    try {
      showToast('Processing EXIF...');
      const base64Data = await FileSystem.readAsStringAsync(selected.uri, { encoding: FileSystem.EncodingType.Base64 });
      const imgData = `data:image/jpeg;base64,${base64Data}`;
      let exifObj;
      try {
        exifObj = piexif.load(imgData);
      } catch (e) {
        exifObj = { "0th": {}, "Exif": {}, "GPS": {} };
      }
      
      const degToDmsRational = (degFloat) => {
        let absDeg = Math.abs(degFloat);
        let minFloat = (absDeg % 1) * 60;
        let secFloat = (minFloat % 1) * 60;
        return [[Math.floor(absDeg), 1], [Math.floor(minFloat), 1], [Math.round(secFloat * 100), 100]];
      };

      if (!exifObj["GPS"]) exifObj["GPS"] = {};
      exifObj["GPS"][piexif.GPSIFD.GPSLatitudeRef] = lat >= 0 ? "N" : "S";
      exifObj["GPS"][piexif.GPSIFD.GPSLatitude] = degToDmsRational(lat);
      exifObj["GPS"][piexif.GPSIFD.GPSLongitudeRef] = lon >= 0 ? "E" : "W";
      exifObj["GPS"][piexif.GPSIFD.GPSLongitude] = degToDmsRational(lon);

      const exifBytes = piexif.dump(exifObj);
      const newImgData = piexif.insert(exifBytes, imgData);
      const newBase64 = newImgData.split(',')[1];
      
      const tempUri = FileSystem.cacheDirectory + `geosnap_edit_${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(tempUri, newBase64, { encoding: FileSystem.EncodingType.Base64 });
      
      const newAsset = await MediaLibrary.createAssetAsync(tempUri);
      const album = await MediaLibrary.getAlbumAsync('GeoSnap');
      if (album) await MediaLibrary.addAssetsToAlbumAsync([newAsset], album, false);

      // Copy the override coordinates to the new asset ID
      const updatedOverrides = { ...newOverrides, [newAsset.id]: { lat, lon } };
      if (overrideOriginal) {
        delete updatedOverrides[selected.id];
      }
      setLocationOverrides(updatedOverrides);
      await AsyncStorage.setItem('geoSnapLocationOverrides', JSON.stringify(updatedOverrides));

      if (overrideOriginal) {
        await MediaLibrary.deleteAssetsAsync([selected]);
      }
      
      showToast('Location saved to image!');
      loadPhotos();
      setSelected(null);
    } catch (err) {
      console.error(err);
      showAlert('EXIF Error', 'App logic updated, but physical EXIF rewrite failed: ' + err.message);
    }
  };

  // ============== LOCATION SEARCH (Nominatim) ==============
  const getFlagEmoji = (countryCode) => {
    if (!countryCode) return '';
    const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
  };

  const searchLocation = async () => {
    const q = locQuery.trim();
    if (!q) return;
    setIsSearching(true);
    setSearchDone(false);
    setLocResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1`,
        { headers: { 'User-Agent': 'GeoSnapApp/2.0' } }
      );
      const data = await res.json();
      setLocResults(data);
    } catch {
      setLocResults([]);
    } finally {
      setIsSearching(false);
      setSearchDone(true);
    }
  };

  const selectSearchResult = (result) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    setTempLat(lat.toFixed(6));
    setTempLon(lon.toFixed(6));
    const countryCode = result.address?.country_code;
    const flag = getFlagEmoji(countryCode);
    const name = result.display_name.split(',').slice(0, 3).join(',').trim() + (flag ? ` ${flag}` : '');
    setEditAddr(name);
    // Auto-save the location immediately after selecting
    setLocResults([]);
    setLocQuery('');
  };

  const openEditGpsModal = () => {
    const currentOverride = locationOverrides[selected.id];
    const defaultLat = currentOverride ? currentOverride.lat : (selectedInfo?.location?.latitude || '');
    const defaultLon = currentOverride ? currentOverride.lon : (selectedInfo?.location?.longitude || '');
    setTempLat(defaultLat.toString());
    setTempLon(defaultLon.toString());
    setEditAddr('');
    setLocQuery('');
    setLocResults([]);
    setSearchDone(false);
    setShowManualCoords(false);
    setEditLocationVisible(true);
  };

  const copyGPS = async (photo) => {
    let lat = null, lon = null;
    if (locationOverrides[photo.id]) {
      lat = locationOverrides[photo.id].lat;
      lon = locationOverrides[photo.id].lon;
    } else {
      try {
        const info = await MediaLibrary.getAssetInfoAsync(photo.id);
        if (info && info.location) { lat = info.location.latitude; lon = info.location.longitude; }
      } catch (e) {}
    }
    
    if (lat !== null && lon !== null) {
      const mapUrl = `https://maps.google.com/?q=${lat.toFixed(6)},${lon.toFixed(6)}`;
      const caption = `📍 GeoSnap Location: ${lat.toFixed(6)}, ${lon.toFixed(6)}\nGoogle Maps: ${mapUrl}`;
      Clipboard.setString(caption);
      showAlert('Copied!', 'GPS coordinates and map link copied to clipboard.');
    } else {
      showAlert('Error', 'No GPS data available for this photo.');
    }
  };

  const sharePhoto = async (photo) => {
    try {
      let lat = null, lon = null;
      if (locationOverrides[photo.id]) {
        lat = locationOverrides[photo.id].lat;
        lon = locationOverrides[photo.id].lon;
      } else {
        try {
          const info = await MediaLibrary.getAssetInfoAsync(photo.id);
          if (info && info.location) { lat = info.location.latitude; lon = info.location.longitude; }
        } catch (e) {}
      }
      
      if (lat !== null && lon !== null) {
        const mapUrl = `https://maps.google.com/?q=${lat.toFixed(6)},${lon.toFixed(6)}`;
        const caption = `📍 GeoSnap Captured Location\nCoordinates: ${lat.toFixed(6)}, ${lon.toFixed(6)}\n🗺️ Open in Google Maps: ${mapUrl}\nCaptured with GeoSnap`;
        Clipboard.setString(caption);
        showAlert('GPS Link Copied!', 'Location coordinates & clickable Google Maps link copied!', [
          { text: 'OK & Share Photo', onPress: async () => {
              try {
                await Share.open({ url: photo.uri, message: caption, failOnCancel: false });
              } catch (e) { console.log(e); }
          }}
        ]);
      } else {
        try {
          await Share.open({ url: photo.uri, failOnCancel: false });
        } catch (e) { console.log(e); }
      }
    } catch (err) { showAlert('Error', err.message); }
  };

  const shareAsPdf = async (photo) => {
    try {
      const html = `<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#fff;"><img src="${photo.uri}" style="max-width:100%;max-height:100%;object-fit:contain;" /></body></html>`;
      const { uri } = await Print.printToFileAsync({ html, margins: { left: 0, top: 0, right: 0, bottom: 0 } });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share GeoSnap PDF' });
      }
    } catch (err) { showAlert('Error', 'Could not generate PDF: ' + err.message); }
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
    } catch (err) { showAlert('Import Error', err.message); }
  };

  const formatDate = (photo) => {
    const rawTs = Number(photo.modificationTime || photo.creationTime || Date.now());
    const actualTs = rawTs > 100000000000 ? rawTs : rawTs * 1000;
    const d = new Date(actualTs);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const FILTERS = ['All', 'Location', 'Date', 'Favorites'];

  const renderRow = ({ item: row }) => (
    <View style={styles.row}>
      {row.map(photo => {
        const isSelected = selectedPhotos.some(p => p.id === photo.id);
        return (
          <FadeInPhoto 
            key={photo.id} 
            photo={photo} 
            T={T} 
            isSelected={isSelected}
            selectionMode={selectionMode}
            onPress={() => handlePhotoPress(photo)} 
            onLongPress={() => handleLongPress(photo)}
          />
        );
      })}
      {row.length < COLS && Array.from({ length: COLS - row.length }).map((_, i) => (
        <View key={`spacer-${i}`} style={styles.spacer} />
      ))}
    </View>
  );

  const renderSectionHeader = ({ section }) => (
    <View style={[styles.sectionHeader, { backgroundColor: T.bg + 'E6' }]}>
      <Text style={[styles.sectionTitle, { color: T.text }]}>{section.title}</Text>
      <Text style={[styles.sectionCount, { color: T.textMuted }]}>
        {section.count} {section.count === 1 ? 'photo' : 'photos'}
      </Text>
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
      {/* Header */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        {selectionMode ? (
          <View style={styles.headerContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <TouchableOpacity onPress={cancelSelection}>
                <Ionicons name="close" size={26} color={T.text} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: T.text, fontSize: 20 }]}>{selectedPhotos.length} Selected</Text>
            </View>
            <TouchableOpacity onPress={selectAll} style={styles.glassHeaderBtn}>
              <Ionicons name={selectedPhotos.length === photos.length ? "checkbox" : "checkbox-outline"} size={20} color={T.text} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.headerContent}>
            <Text style={[styles.headerTitle, { color: T.text }]}>Gallery</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={() => setSelectionMode(true)} style={styles.glassHeaderBtn}>
                <Ionicons name="checkbox-outline" size={20} color={T.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleImport} style={styles.glassHeaderBtn}>
                <Ionicons name="folder-open-outline" size={20} color={T.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={loadPhotos} style={styles.glassHeaderBtn}>
                <Ionicons name="refresh-outline" size={20} color={T.text} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Floating Search Bar */}
        <View style={styles.searchBarWrapper}>
          <View style={[styles.glassSearchBar, { backgroundColor: T.surface2 }]}>
            <Ionicons name="search" size={18} color={T.textMuted} style={{ marginRight: 8 }} />
            <Text style={{ color: T.textMuted, fontSize: 14 }}>Search photos, locations...</Text>
          </View>
        </View>
      </SafeAreaView>

      {photos.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: T.surface2 }]}>
            <Ionicons name="camera-outline" size={44} color={T.textMuted} />
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
        />
      )}

      {selectionMode && (
        <SafeAreaView style={styles.selectionBottomBar}>
          <TouchableOpacity style={[styles.selectionActionBtn, { opacity: selectedPhotos.length ? 1 : 0.5 }]} disabled={!selectedPhotos.length} onPress={deleteSelected}>
            <Ionicons name="trash-outline" size={24} color={T.danger} />
            <Text style={[styles.selectionActionText, { color: T.danger }]}>Delete</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.selectionActionBtn, { opacity: selectedPhotos.length ? 1 : 0.5 }]} disabled={!selectedPhotos.length} onPress={generatePDF}>
            <Ionicons name="document-text-outline" size={24} color={T.text} />
            <Text style={[styles.selectionActionText, { color: T.text }]}>Create PDF</Text>
          </TouchableOpacity>
        </SafeAreaView>
      )}

      {/* Photo Detail Modal — Flex column layout without overlapping overlays */}
      <Modal visible={!!selected} transparent={false} animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {selected && (
            <SafeAreaView style={{ flex: 1 }}>
              
              {/* Top Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
                <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, marginRight: 12 }}>
                  <Ionicons name="arrow-back" size={22} color="#FFF" />
                </TouchableOpacity>
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFF' }}>Photo</Text>
              </View>

              {/* Full screen Image or Video Viewer */}
              <View style={{ flex: 1, overflow: 'hidden' }}>
                {(selected.mediaType === 'video' || selected.uri?.endsWith('.mp4') || selected.filename?.endsWith('.mp4')) ? (
                  <VideoPlayerView
                    videoUri={selected.uri}
                    location={(() => {
                      const override = locationOverrides[selected.id];
                      const lat = override ? override.lat : selectedInfo?.location?.latitude;
                      const lon = override ? override.lon : selectedInfo?.location?.longitude;
                      return (lat && lon) ? { coords: { latitude: lat, longitude: lon } } : null;
                    })()}
                    address="GeoSnap Video Location"
                  />
                ) : (
                  <ScrollView 
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
                    maximumZoomScale={3}
                    minimumZoomScale={1}
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                  >
                    <Image 
                      source={{ uri: selected.uri }} 
                      style={{ flex: 1, width: '100%', minHeight: 400 }} 
                      resizeMode="contain" 
                    />
                  </ScrollView>
                )}
              </View>

              {/* Bottom Actions Navigation Bar */}
              <View style={{ backgroundColor: '#0B1220', paddingVertical: 16, paddingBottom: Math.max(insets.bottom, 16), borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
                  <ActionBtn icon="share-social-outline" label="Share" color="#FFF" onPress={() => sharePhoto(selected)} />
                  <ActionBtn icon="information-circle-outline" label="Details" color="#FFF" onPress={() => setShowDetails(true)} />
                  <ActionBtn icon="copy-outline" label="Copy GPS" color="#FFF" onPress={() => copyGPS(selected)} />
                  <ActionBtn icon="trash-outline" label="Delete" color="#FF6B6B" onPress={() => { setSelected(null); deletePhoto(selected); }} />
                </ScrollView>
              </View>

              {/* Image Data Details Modal */}
              <Modal visible={showDetails} transparent={true} animationType="slide" onRequestClose={() => setShowDetails(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                  {/* Tap outside to dismiss */}
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowDetails(false)} />
                  
                  {/* Bottom sheet content */}
                  <View style={{ backgroundColor: T.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: height * 0.8 }}>
                    <View style={{ alignItems: 'center', marginBottom: 16 }}>
                      <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: T.border }} />
                    </View>
                    <Text style={[styles.modalTitle, { color: T.text, marginBottom: 16 }]}>Image Data</Text>
                    
                    <ScrollView showsVerticalScrollIndicator={false}>
                      <View style={styles.infoGrid}>
                        <InfoRow icon="location-outline" text={(() => {
                          const override = locationOverrides[selected.id];
                          const lat = override ? override.lat : selectedInfo?.location?.latitude;
                          const lon = override ? override.lon : selectedInfo?.location?.longitude;
                          return (lat && lon) ? `${lat.toFixed(4)}, ${lon.toFixed(4)}` : 'Location not available';
                        })()} T={T} />
                        <InfoRow icon="analytics-outline" text={selectedInfo?.location?.altitude ? `${Math.round(selectedInfo.location.altitude)}m` : 'Unknown'} T={T} />
                        <InfoRow icon="speedometer-outline" text="Speed N/A" T={T} />
                        <InfoRow icon="calendar-outline" text={formatDate(selected)} T={T} />
                        <InfoRow icon="image-outline" text={`${selected.width} × ${selected.height}`} T={T} />
                      </View>
                      
                      {/* Mini map placeholder */}
                      <View style={[styles.miniMapPlaceholder, { backgroundColor: T.surface2 }]}>
                        <Ionicons name="map" size={40} color={T.textMuted} />
                        <Text style={{ color: T.textMuted, marginTop: 8 }}>Map View</Text>
                      </View>
                    </ScrollView>
                  </View>
                </View>
              </Modal>

              {/* Edit GPS Modal — Full Search (matching CameraScreen) */}
              <Modal visible={editLocationVisible} transparent animationType="slide" onRequestClose={() => setEditLocationVisible(false)}>
                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}
                >
                  <View style={{ backgroundColor: T.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 6, maxHeight: '85%' }}>
                    {/* Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                      <View>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: T.text }}>Set Location</Text>
                        <Text style={{ fontSize: 12, marginTop: 2, color: T.textMuted }}>Search or enter manually</Text>
                      </View>
                      <TouchableOpacity onPress={() => setEditLocationVisible(false)} style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="close" size={20} color={T.textSub} />
                      </TouchableOpacity>
                    </View>

                    {/* Search bar */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4, backgroundColor: T.surface2, borderColor: T.border }}>
                      <Ionicons name="search-outline" size={18} color={T.textMuted} />
                      <TextInput
                        style={{ flex: 1, fontSize: 15, paddingVertical: 2, color: T.text }}
                        value={locQuery}
                        onChangeText={setLocQuery}
                        placeholder="Search city, landmark, address…"
                        placeholderTextColor={T.textMuted}
                        returnKeyType="search"
                        onSubmitEditing={searchLocation}
                        autoFocus
                      />
                      {isSearching
                        ? <ActivityIndicator size="small" color={T.accent} />
                        : (
                          <TouchableOpacity onPress={searchLocation} disabled={!locQuery.trim()}>
                            <Ionicons name="arrow-forward-circle" size={26} color={locQuery.trim() ? T.accent : T.border} />
                          </TouchableOpacity>
                        )
                      }
                    </View>

                    {/* Search results */}
                    {locResults.length > 0 && (
                      <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="handled">
                        {locResults.map((r, i) => {
                          const parts = r.display_name.split(',');
                          const primary = parts.slice(0, 2).join(',').trim();
                          const secondary = parts.slice(2, 4).join(',').trim();
                          return (
                            <TouchableOpacity
                              key={r.place_id}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: i === locResults.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: T.border }}
                              onPress={() => selectSearchResult(r)}
                              activeOpacity={0.7}
                            >
                              <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: T.accent + '20' }}>
                                <Ionicons name="location" size={14} color={T.accent} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: T.text }} numberOfLines={1}>{primary}</Text>
                                <Text style={{ fontSize: 11, marginTop: 1, color: T.textMuted }} numberOfLines={1}>{secondary}</Text>
                                <Text style={{ fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', marginTop: 2, color: T.textSub }}>
                                  {parseFloat(r.lat).toFixed(5)}, {parseFloat(r.lon).toFixed(5)}
                                </Text>
                              </View>
                              <Ionicons name="chevron-forward" size={16} color={T.textMuted} />
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}

                    {/* No results state */}
                    {searchDone && locResults.length === 0 && (
                      <View style={{ alignItems: 'center', paddingVertical: 16, gap: 4 }}>
                        <Ionicons name="location-outline" size={32} color={T.textMuted} />
                        <Text style={{ fontSize: 14, fontWeight: '600', color: T.textMuted }}>No locations found</Text>
                        <Text style={{ fontSize: 12, textAlign: 'center', lineHeight: 18, color: T.textMuted }}>Try a different search, or enter coordinates manually below.</Text>
                      </View>
                    )}

                    {/* Selected Location Confirmation */}
                    {editAddr ? (
                      <View style={{ backgroundColor: T.accent + '15', padding: 12, borderRadius: 10, marginVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="location" size={16} color={T.accent} />
                        <Text style={{ color: T.text, fontSize: 13, flex: 1, fontWeight: '600' }} numberOfLines={1}>
                          Selected: {editAddr} ({parseFloat(tempLat).toFixed(4)}, {parseFloat(tempLon).toFixed(4)})
                        </Text>
                      </View>
                    ) : null}

                    {/* Manual coords toggle */}
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10 }}
                      onPress={() => setShowManualCoords(p => !p)}
                    >
                      <Ionicons name={showManualCoords ? 'chevron-up' : 'chevron-down'} size={14} color={T.textMuted} />
                      <Text style={{ fontSize: 12, fontWeight: '500', color: T.textMuted }}>Enter coordinates manually</Text>
                    </TouchableOpacity>

                    {showManualCoords && (
                      <View style={{ gap: 4 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, fontWeight: '600', marginTop: 6, marginBottom: 3, letterSpacing: 0.5, color: T.textSub }}>Latitude</Text>
                            <TextInput
                              style={{ borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: T.surface2, borderColor: T.border, color: T.text }}
                              value={tempLat}
                              onChangeText={setTempLat}
                              placeholder="12.971599"
                              placeholderTextColor={T.textMuted}
                              keyboardType="numeric"
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, fontWeight: '600', marginTop: 6, marginBottom: 3, letterSpacing: 0.5, color: T.textSub }}>Longitude</Text>
                            <TextInput
                              style={{ borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: T.surface2, borderColor: T.border, color: T.text }}
                              value={tempLon}
                              onChangeText={setTempLon}
                              placeholder="77.594566"
                              placeholderTextColor={T.textMuted}
                              keyboardType="numeric"
                            />
                          </View>
                        </View>
                      </View>
                    )}

                    {/* Action buttons */}
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, backgroundColor: T.surface2, borderColor: T.border }}
                        onPress={() => setEditLocationVisible(false)}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '700', color: T.textMuted }}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderColor: T.border }}
                        onPress={() => saveLocation(false)}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '700', color: T.text }}>Save Copy</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, backgroundColor: T.accent, borderColor: T.accent }}
                        onPress={() => saveLocation(true)}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '700', color: T.mode === 'dark' ? '#000' : '#FFF' }}>Override</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </KeyboardAvoidingView>
              </Modal>
            </SafeAreaView>
          )}
        </View>
      </Modal>
    </View>
  );
}

function ActionBtn({ icon, label, color, onPress }) {
  return (
    <View style={styles.actionBtnContainer}>
      <TouchableOpacity style={[styles.actionCircle, { backgroundColor: color + '20' }]} onPress={onPress}>
        <Ionicons name={icon} size={22} color={color} />
      </TouchableOpacity>
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, text, T }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={T.textMuted} />
      <Text style={[styles.infoText, { color: T.textSub }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  
  // Header
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  headerActions: { flexDirection: 'row', gap: 8 },
  glassHeaderBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },

  // Search Bar
  searchBarWrapper: { paddingHorizontal: 16, paddingBottom: 12 },
  glassSearchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },

  // Filter tabs
  filterRow: { paddingBottom: 12 },
  glassFilterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)' },
  filterText: { fontSize: 13, fontWeight: '600' },

  // Grid
  gridContainer: { paddingBottom: 100 },
  row: { flexDirection: 'row', paddingHorizontal: 8, gap: 4, marginVertical: 2 },
  photoItem: { width: ITEM_SIZE, height: ITEM_SIZE, overflow: 'hidden', borderRadius: 16 },
  photo: { width: '100%', height: '100%' },
  spacer: { width: ITEM_SIZE, height: ITEM_SIZE },
  
  // Selection Mode
  selectionOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-start', alignItems: 'flex-end', padding: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  checkboxSelected: { backgroundColor: '#4A90E2', borderColor: '#4A90E2' },
  selectionBottomBar: { position: 'absolute', bottom: 100, left: 24, right: 24, backgroundColor: '#1A1A1A', flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 15, elevation: 10 },
  selectionActionBtn: { alignItems: 'center', gap: 6 },
  selectionActionText: { fontSize: 12, fontWeight: '600' },

  // Section headers
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionCount: { fontSize: 12 },

  // Empty state
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 21, fontWeight: '700' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 21 },
  loadingText: { marginTop: 10, fontSize: 14 },

  // Modal — Photo Detail
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  modalBackBtn: { marginRight: 12 },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
  modalHeaderRight: { flexDirection: 'row', gap: 12 },
  modalHeaderIcon: { padding: 4 },
  fullImage: { height: 350, width: '100%', backgroundColor: '#000' },

  // Action buttons row
  actionRow: { paddingHorizontal: 16, paddingVertical: 16, gap: 16 },
  actionBtnContainer: { alignItems: 'center', gap: 6 },
  actionCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 11, fontWeight: '600' },

  // Photo metadata
  photoInfo: { padding: 16, borderTopWidth: 1, flex: 1 },
  infoSectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '45%' },
  infoText: { fontSize: 12 },
  miniMapPlaceholder: { height: 120, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
});
