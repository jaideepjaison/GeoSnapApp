import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library';
import MapView, { Marker } from 'react-native-maps';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';

const { width, height } = Dimensions.get('window');

export default function MapScreen() {
  const { theme: T } = useTheme();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [photosWithLocation, setPhotosWithLocation] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadLocations();
    }, [])
  );

  const loadLocations = async () => {
    setLoading(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        setHasPermission(false);
        setLoading(false);
        return;
      }
      setHasPermission(true);
      
      const album = await MediaLibrary.getAlbumAsync('GeoSnap');
      if (!album) {
        setPhotosWithLocation([]);
        setLoading(false);
        return;
      }

      const result = await MediaLibrary.getAssetsAsync({
        album,
        mediaType: 'photo',
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        first: 100, // Process top 100 to avoid long loading
      });

      const mapped = [];
      for (const asset of result.assets) {
        try {
          const info = await MediaLibrary.getAssetInfoAsync(asset.id);
          if (info && info.location && info.location.latitude && info.location.longitude) {
            mapped.push({
              ...asset,
              latitude: info.location.latitude,
              longitude: info.location.longitude,
            });
          }
        } catch (err) {
          // Ignore individual asset errors
        }
      }

      setPhotosWithLocation(mapped);
    } catch (err) {
      console.log('Map load error', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (photo) => {
    const rawTs = Number(photo.modificationTime || photo.creationTime || Date.now());
    const actualTs = rawTs > 100000000000 ? rawTs : rawTs * 1000;
    const d = new Date(actualTs);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: T.surface, zIndex: 10 }}>
        <View style={[styles.header, { borderBottomColor: T.border }]}>
          <Text style={[styles.title, { color: T.text }]}>Map View</Text>
          <TouchableOpacity onPress={loadLocations}>
            <Ionicons name="refresh-outline" size={24} color={T.text} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={styles.body}>
        {!hasPermission ? (
          <View style={[styles.centered, { backgroundColor: T.bg }]}>
            <Ionicons name="lock-closed-outline" size={52} color={T.accent} />
            <Text style={[styles.emptyTitle, { color: T.text }]}>Permission Needed</Text>
            <Text style={[styles.emptySubtitle, { color: T.textMuted }]}>Grant Photos access to view your GeoSnap gallery on map</Text>
          </View>
        ) : loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={T.accent} />
            <Text style={[styles.emptySubtitle, { color: T.textMuted, marginTop: 12 }]}>Extracting GPS coordinates...</Text>
          </View>
        ) : photosWithLocation.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="map-outline" size={64} color={T.textMuted} />
            <Text style={[styles.emptyTitle, { color: T.text, marginTop: 16 }]}>No GPS Photos</Text>
            <Text style={[styles.emptySubtitle, { color: T.textMuted, marginTop: 8 }]}>Take photos with GeoSnap to see them here.</Text>
          </View>
        ) : (
          <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={{
              latitude: photosWithLocation[0].latitude,
              longitude: photosWithLocation[0].longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            {photosWithLocation.map((photo) => (
              <Marker
                key={photo.id}
                coordinate={{ latitude: photo.latitude, longitude: photo.longitude }}
                onPress={() => setSelectedPhoto(photo)}
              >
                <View style={[styles.markerContainer, { borderColor: T.accent }]}>
                  <Image source={{ uri: photo.uri }} style={styles.markerImage} />
                </View>
              </Marker>
            ))}
          </MapView>
        )}
      </View>

      {/* Photo Detail Modal */}
      <Modal visible={!!selectedPhoto} transparent={true} animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: T.bg }]}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedPhoto(null)}>
              <Ionicons name="close-circle" size={32} color={T.text} />
            </TouchableOpacity>
            {selectedPhoto && (
              <>
                <Image source={{ uri: selectedPhoto.uri }} style={styles.modalImage} resizeMode="cover" />
                <View style={styles.modalInfo}>
                  <Text style={[styles.modalDate, { color: T.text }]}>{formatDate(selectedPhoto)}</Text>
                  <Text style={[styles.modalCoords, { color: T.textMuted }]}>
                    {selectedPhoto.latitude.toFixed(6)}, {selectedPhoto.longitude.toFixed(6)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700' },
  body: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  
  markerContainer: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, overflow: 'hidden', backgroundColor: '#FFF' },
  markerImage: { width: '100%', height: '100%' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  modalClose: { position: 'absolute', top: 12, right: 12, zIndex: 10 },
  modalImage: { width: '100%', height: 400 },
  modalInfo: { padding: 16 },
  modalDate: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  modalCoords: { fontSize: 14 },
});
