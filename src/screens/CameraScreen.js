import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Dimensions, Animated, Platform,
  Image, Share, Linking, PanResponder, AppState,
  Modal, TextInput, KeyboardAvoidingView, ScrollView as ScrollViewRN,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import GpsOverlay from '../components/GpsOverlay';
import FlashEffect from '../components/FlashEffect';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

// R4: Track if media permission was already granted this install
let _mediaPermGranted = false;

export default function CameraScreen() {
  const { theme } = useTheme();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState(null);
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState(null);
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const [isSaving, setIsSaving] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [isPreview, setIsPreview] = useState(false);
  const [captureTime, setCaptureTime] = useState(null);   // frozen at shutter press
  // Manual location override
  const [manualLocation, setManualLocation] = useState(null);
  const [manualAddress, setManualAddress] = useState(null);
  const [showLocModal, setShowLocModal] = useState(false);
  const [editLat, setEditLat] = useState('');
  const [editLon, setEditLon] = useState('');
  const [editAddr, setEditAddr] = useState('');
  // Location search
  const [locQuery, setLocQuery] = useState('');
  const [locResults, setLocResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [showManualCoords, setShowManualCoords] = useState(false);
  // R3: Zoom
  const [zoom, setZoom] = useState(0);
  const [showZoomBar, setShowZoomBar] = useState(false);
  // R7: Brightness slider
  const [brightness, setBrightness] = useState(0); // -1 to 1 exposure
  const [showBrightness, setShowBrightness] = useState(false);

  const cameraRef = useRef(null);
  const viewShotRef = useRef(null);
  const locationWatchRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const zoomHideTimer = useRef(null);

  // Pulse animation for GPS dot
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Request permissions on mount
  useEffect(() => {
    (async () => {
      const locPerm = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(locPerm.status === 'granted');

      // R4: Only request media permission once; after that it's remembered by OS
      if (!_mediaPermGranted) {
        const mediaPerm = await MediaLibrary.requestPermissionsAsync();
        if (mediaPerm.status === 'granted') _mediaPermGranted = true;
      }
    })();
  }, []);

  // Watch GPS
  useEffect(() => {
    if (!locationPermission) return;
    let sub;
    (async () => {
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
        async (loc) => {
          setLocation(loc);
          try {
            const geo = await Location.reverseGeocodeAsync({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
            if (geo.length > 0) {
              const g = geo[0];
              const parts = [g.street, g.district, g.city, g.region, g.country].filter(Boolean);
              setAddress(parts.slice(0, 3).join(', '));
            }
          } catch { setAddress(null); }
        }
      );
      locationWatchRef.current = sub;
    })();
    return () => { if (locationWatchRef.current) locationWatchRef.current.remove(); };
  }, [locationPermission]);

  const toggleFlash = () => setFlash(p => p === 'off' ? 'on' : p === 'on' ? 'auto' : 'off');
  const toggleFacing = () => setFacing(p => p === 'back' ? 'front' : 'back');

  // R3: Zoom levels
  const ZOOM_LEVELS = [0, 0.05, 0.12]; // ~1x, 1.5x, 2x
  const ZOOM_LABELS = ['1×', '1.5×', '2×'];
  const currentZoomIdx = ZOOM_LEVELS.indexOf(zoom) !== -1 ? ZOOM_LEVELS.indexOf(zoom) : 0;
  const cycleZoom = () => {
    const next = (currentZoomIdx + 1) % ZOOM_LEVELS.length;
    setZoom(ZOOM_LEVELS[next]);
    setShowZoomBar(true);
    if (zoomHideTimer.current) clearTimeout(zoomHideTimer.current);
    zoomHideTimer.current = setTimeout(() => setShowZoomBar(false), 2000);
  };

  // R7: Brightness: expo-camera uses exposureCompensation or similar
  // We'll use a brightness value for the camera
  const brightnessSteps = [-0.5, -0.25, 0, 0.25, 0.5, 0.75, 1.0];
  const brightnessIdx = brightnessSteps.indexOf(brightness) !== -1 ? brightnessSteps.indexOf(brightness) : 2;
  const adjustBrightness = (dir) => {
    const next = Math.max(0, Math.min(brightnessSteps.length - 1, brightnessIdx + dir));
    setBrightness(brightnessSteps[next]);
  };

  const takePicture = async () => {
    if (!cameraRef.current || isSaving) return;
    try {
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 250);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.92, exif: true });
      setCaptureTime(new Date());   // freeze time at shutter moment
      setManualLocation(null);      // reset any previous manual override
      setManualAddress(null);
      setCapturedPhoto(photo);
      setIsPreview(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to take photo.');
    }
  };

  // R4: Save without repeated OS dialog (permission asked once at startup)
  // R9: Don't show "PREVIEW" watermark label in saved image
  const savePhoto = async () => {
    if (!capturedPhoto || isSaving) return;
    if (!_mediaPermGranted) {
      const p = await MediaLibrary.requestPermissionsAsync();
      if (p.status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant Photos access to save.');
        return;
      }
      _mediaPermGranted = true;
    }
    setIsSaving(true);
    try {
      // Capture without the preview badge (R9: badge is not in viewShotRef)
      const uri = await captureRef(viewShotRef, { format: 'jpg', quality: 0.92 });
      const asset = await MediaLibrary.createAssetAsync(uri);
      try { await MediaLibrary.createAlbumAsync('GeoSnap', asset, false); } catch {}
      return uri; // return for share flow
    } catch (err) {
      Alert.alert('Error', 'Failed to save: ' + err.message);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // R5: Save then share
  const handleSaveAndShare = async () => {
    const uri = await savePhoto();
    if (!uri) return;
    Alert.alert('Saved!', 'Photo saved to GeoSnap album.', [
      { text: 'Done', onPress: retake },
      {
        text: 'Share', onPress: async () => {
          try {
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(uri, {
                mimeType: 'image/jpeg',
                dialogTitle: 'Share your GeoSnap photo',
              });
            } else {
              await Share.share({ url: uri, message: `📍 ${address || 'GPS Tagged Photo'}\nLat: ${location?.coords.latitude.toFixed(6)}, Lon: ${location?.coords.longitude.toFixed(6)}` });
            }
          } catch {}
          retake();
        }
      },
    ]);
  };

  // R5: Share only (don't save to gallery separately)
  const handleShareOnly = async () => {
    if (!capturedPhoto || isSaving) return;
    setIsSaving(true);
    try {
      const uri = await captureRef(viewShotRef, { format: 'jpg', quality: 0.92 });
      // Also auto-save
      const asset = await MediaLibrary.createAssetAsync(uri);
      try { await MediaLibrary.createAlbumAsync('GeoSnap', asset, false); } catch {}
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Share GeoSnap photo' });
      } else {
        await Share.share({ url: uri });
      }
      retake();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const retake = () => {
    setCapturedPhoto(null);
    setIsPreview(false);
    setCaptureTime(null);
    setManualLocation(null);
    setManualAddress(null);
  };

  // Manual location helpers
  const openLocModal = () => {
    const loc = manualLocation || location;
    setEditLat(loc?.coords?.latitude?.toFixed(6) ?? '');
    setEditLon(loc?.coords?.longitude?.toFixed(6) ?? '');
    setEditAddr(manualAddress ?? address ?? '');
    setLocQuery('');
    setLocResults([]);
    setSearchDone(false);
    setShowManualCoords(false);
    setShowLocModal(true);
  };

  // Nominatim geocoding (free, no API key)
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
    const name = result.display_name.split(',').slice(0, 3).join(',').trim();
    setEditLat(lat.toFixed(6));
    setEditLon(lon.toFixed(6));
    setEditAddr(name);
    setManualLocation({ coords: { latitude: lat, longitude: lon } });
    setManualAddress(name);
    setShowLocModal(false);
  };

  const applyManualLocation = () => {
    const lat = parseFloat(editLat);
    const lon = parseFloat(editLon);
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      Alert.alert('Invalid Coordinates', 'Please enter valid latitude (-90 to 90) and longitude (-180 to 180).');
      return;
    }
    setManualLocation({ coords: { latitude: lat, longitude: lon } });
    setManualAddress(editAddr.trim() || null);
    setShowLocModal(false);
  };

  const openMaps = () => {
    if (!location) return;
    const { latitude, longitude } = location.coords;
    const url = `geo:${latitude},${longitude}?q=${latitude},${longitude}`;
    const web = `https://maps.google.com/?q=${latitude},${longitude}`;
    Linking.canOpenURL(url).then(s => Linking.openURL(s ? url : web)).catch(() => Linking.openURL(web));
  };

  const flashIcon = flash === 'off' ? 'flash-off' : flash === 'on' ? 'flash' : 'flash-outline';
  const flashColor = flash !== 'off' ? theme.warn : theme.textMuted;

  const T = theme; // shorthand

  if (!cameraPermission) {
    return <View style={[styles.centered, { backgroundColor: T.bg }]}>
      <ActivityIndicator size="large" color={T.accent} />
    </View>;
  }

  if (!cameraPermission.granted) {
    return (
      <View style={[styles.centered, { backgroundColor: T.bg }]}>
        <Ionicons name="camera-off-outline" size={60} color={T.accent} />
        <Text style={[styles.permText, { color: T.text }]}>Camera access needed</Text>
        <Text style={[styles.permSubText, { color: T.textMuted }]}>GeoSnap needs camera to take GPS-tagged photos</Text>
        <TouchableOpacity style={[styles.permBtn, { backgroundColor: T.accent }]} onPress={requestCameraPermission}>
          <Text style={[styles.permBtnText, { color: T.mode === 'dark' ? '#0A0A0F' : '#FFFFFF' }]}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: T.surface }}>
        <View style={[styles.headerContent, { borderBottomColor: T.border }]}>
          <View style={styles.logoRow}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <View style={[styles.gpsDot, { backgroundColor: location ? T.accentGreen : T.textMuted }]} />
            </Animated.View>
            <Text style={[styles.appName, { color: T.text }]}>GEOSNAP</Text>
          </View>
          <View style={styles.headerRight}>
            {/* R7: Brightness toggle */}
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: T.controlBg }]}
              onPress={() => setShowBrightness(p => !p)}
            >
              <Ionicons name="sunny-outline" size={18} color={showBrightness ? T.warn : T.textSub} />
            </TouchableOpacity>
            {/* GPS tap → open maps */}
            {location && (
              <TouchableOpacity
                style={[styles.headerBtn, { backgroundColor: T.controlBg }]}
                onPress={openMaps}
              >
                <Ionicons name="navigate" size={16} color={T.accent} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* Camera / Preview — this whole ref is captured to image (R9: no PREVIEW badge inside) */}
      <View style={styles.cameraContainer} ref={viewShotRef} collapsable={false}>
        {isPreview && capturedPhoto ? (
          <Image source={{ uri: capturedPhoto.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <CameraView
            style={styles.camera}
            ref={cameraRef}
            facing={facing}
            flash={flash}
            zoom={zoom}
            // R7: exposure compensation
            exposureCompensation={brightness}
          >
            {/* Rule-of-thirds grid */}
            <View style={styles.grid} pointerEvents="none">
              {[0.33, 0.66].map(p => (
                <View key={`h${p}`} style={[styles.gridLine, styles.gridLineH, { top: `${p * 100}%` }]} />
              ))}
              {[0.33, 0.66].map(p => (
                <View key={`v${p}`} style={[styles.gridLine, styles.gridLineV, { left: `${p * 100}%` }]} />
              ))}
            </View>
            {/* Corner brackets */}
            {['TL','TR','BL','BR'].map(pos => (
              <View key={pos} style={[styles.bracket, styles[`bracket${pos}`], { borderColor: T.accent }]} />
            ))}
          </CameraView>
        )}

        {/* GPS Overlay — always on top (burned into saved image) */}
        <GpsOverlay
          location={manualLocation || location}
          address={manualAddress ?? address}
          forCapture
          captureTime={captureTime}
        />

        {showFlash && <FlashEffect />}

        {/* R3: Zoom indicator overlay */}
        {showZoomBar && !isPreview && (
          <View style={styles.zoomIndicator}>
            {ZOOM_LABELS.map((lbl, i) => (
              <View key={i} style={[styles.zoomPip, i === currentZoomIdx && { backgroundColor: T.accent }]}>
                <Text style={[styles.zoomPipText, { color: i === currentZoomIdx ? '#000' : '#FFF' }]}>{lbl}</Text>
              </View>
            ))}
          </View>
        )}

        {/* R7: Brightness slider overlay */}
        {showBrightness && !isPreview && (
          <View style={styles.brightnessBar}>
            <Ionicons name="sunny-outline" size={13} color="#FFD700" />
            <TouchableOpacity onPress={() => adjustBrightness(-1)} style={styles.brightBtn}>
              <Ionicons name="remove" size={18} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.brightTrack}>
              <View style={[styles.brightFill, { width: `${((brightnessIdx) / (brightnessSteps.length - 1)) * 100}%` }]} />
            </View>
            <TouchableOpacity onPress={() => adjustBrightness(1)} style={styles.brightBtn}>
              <Ionicons name="add" size={18} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.brightLabel}>{brightness > 0 ? '+' : ''}{brightness.toFixed(2)}</Text>
          </View>
        )}
      </View>

      {/* Controls */}
      <SafeAreaView edges={['bottom']} style={[styles.controls, { backgroundColor: T.surface, borderTopColor: T.border }]}>
        {isPreview ? (
          // Preview actions: Retake | Save | Share
          <>
            <View style={styles.previewControls}>
              <TouchableOpacity style={[styles.previewBtn, { backgroundColor: T.surface2, borderColor: T.border }]} onPress={retake}>
                <Ionicons name="refresh-outline" size={20} color={T.danger} />
                <Text style={[styles.previewBtnText, { color: T.danger }]}>Retake</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: T.accent }, isSaving && styles.saveBtnDisabled]}
                onPress={handleSaveAndShare}
                disabled={isSaving}
              >
                {isSaving
                  ? <ActivityIndicator color={T.mode === 'dark' ? '#0A0A0F' : '#FFF'} size="small" />
                  : <>
                      <Ionicons name="save-outline" size={20} color={T.mode === 'dark' ? '#0A0A0F' : '#FFF'} />
                      <Text style={[styles.saveBtnText, { color: T.mode === 'dark' ? '#0A0A0F' : '#FFF' }]}>Save</Text>
                    </>
                }
              </TouchableOpacity>

              {/* R5: Share button */}
              <TouchableOpacity
                style={[styles.shareBtn, { backgroundColor: T.surface2, borderColor: T.border }]}
                onPress={handleShareOnly}
                disabled={isSaving}
              >
                <Ionicons name="share-social-outline" size={20} color={T.accent} />
                <Text style={[styles.previewBtnText, { color: T.accent }]}>Share</Text>
              </TouchableOpacity>
            </View>

            {/* Edit Location row */}
            <TouchableOpacity
              style={[styles.editLocBtn, { backgroundColor: T.surface2, borderColor: manualLocation ? T.accent : T.border }]}
              onPress={openLocModal}
            >
              <Ionicons name="location-outline" size={15} color={manualLocation ? T.accent : T.textSub} />
              <Text style={[styles.editLocText, { color: manualLocation ? T.accent : T.textSub }]}>
                {manualLocation
                  ? `📍 ${manualLocation.coords.latitude.toFixed(5)}, ${manualLocation.coords.longitude.toFixed(5)}`
                  : 'Edit Location on Stamp'}
              </Text>
              <Ionicons name="pencil-outline" size={13} color={manualLocation ? T.accent : T.textMuted} />
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.shootControls}>
            {/* Flash */}
            <TouchableOpacity style={[styles.controlBtn, { backgroundColor: T.controlBg, borderColor: T.border }]} onPress={toggleFlash}>
              <Ionicons name={flashIcon} size={24} color={flashColor} />
            </TouchableOpacity>

            {/* Shutter */}
            <TouchableOpacity style={[styles.shutterBtn, { borderColor: T.shutterBorder }]} onPress={takePicture} disabled={isSaving}>
              <View style={[styles.shutterInner, { backgroundColor: T.mode === 'dark' ? '#FFF' : T.accent }]} />
            </TouchableOpacity>

            {/* Flip */}
            <TouchableOpacity style={[styles.controlBtn, { backgroundColor: T.controlBg, borderColor: T.border }]} onPress={toggleFacing}>
              <Ionicons name="camera-reverse-outline" size={24} color={T.textSub} />
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom row: GPS status + R3 zoom buttons */}
        {!isPreview && (
          <View style={styles.bottomRow}>
            {/* R3: Zoom buttons */}
            <View style={styles.zoomRow}>
              {ZOOM_LABELS.map((lbl, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.zoomBtn,
                    { backgroundColor: T.controlBg, borderColor: T.border },
                    i === currentZoomIdx && { backgroundColor: T.accent, borderColor: T.accent }
                  ]}
                  onPress={() => { setZoom(ZOOM_LEVELS[i]); setShowZoomBar(true); setTimeout(() => setShowZoomBar(false), 1500); }}
                >
                  <Text style={[styles.zoomBtnText, { color: T.textSub }, i === currentZoomIdx && { color: T.mode === 'dark' ? '#000' : '#FFF' }]}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* GPS coords */}
            <TouchableOpacity style={styles.gpsStatus} onPress={openMaps} activeOpacity={location ? 0.7 : 1}>
              <Ionicons name={location ? 'location' : 'location-outline'} size={12} color={location ? T.accentGreen : T.textMuted} />
              <Text style={[styles.gpsStatusText, { color: location ? T.accentGreen : T.textMuted, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' }]} numberOfLines={1}>
                {location ? `${location.coords.latitude.toFixed(5)}, ${location.coords.longitude.toFixed(5)}` : 'Acquiring GPS...'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      {/* Manual Location Modal */}
      <Modal
        visible={showLocModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLocModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalSheet, { backgroundColor: T.surface }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: T.text }]}>Set Location</Text>
                <Text style={[styles.modalSubtitle, { color: T.textMuted }]}>Search or enter manually</Text>
              </View>
              <TouchableOpacity onPress={() => setShowLocModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={T.textSub} />
              </TouchableOpacity>
            </View>

            {/* Search bar */}
            <View style={[styles.searchBar, { backgroundColor: T.surface2, borderColor: T.border }]}>
              <Ionicons name="search-outline" size={18} color={T.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: T.text }]}
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
              <ScrollViewRN style={styles.resultsList} keyboardShouldPersistTaps="handled">
                {locResults.map((r, i) => {
                  const parts = r.display_name.split(',');
                  const primary = parts.slice(0, 2).join(',').trim();
                  const secondary = parts.slice(2, 4).join(',').trim();
                  return (
                    <TouchableOpacity
                      key={r.place_id}
                      style={[styles.resultItem, { borderBottomColor: T.border }, i === locResults.length - 1 && { borderBottomWidth: 0 }]}
                      onPress={() => selectSearchResult(r)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.resultIcon, { backgroundColor: T.accent + '20' }]}>
                        <Ionicons name="location" size={14} color={T.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.resultPrimary, { color: T.text }]} numberOfLines={1}>{primary}</Text>
                        <Text style={[styles.resultSecondary, { color: T.textMuted }]} numberOfLines={1}>{secondary}</Text>
                        <Text style={[styles.resultCoords, { color: T.textSub }]}>
                          {parseFloat(r.lat).toFixed(5)}, {parseFloat(r.lon).toFixed(5)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={T.textMuted} />
                    </TouchableOpacity>
                  );
                })}
              </ScrollViewRN>
            )}

            {/* No results state */}
            {searchDone && locResults.length === 0 && (
              <View style={styles.noResults}>
                <Ionicons name="location-outline" size={32} color={T.textMuted} />
                <Text style={[styles.noResultsText, { color: T.textMuted }]}>No locations found</Text>
                <Text style={[styles.noResultsHint, { color: T.textMuted }]}>
                  Try a different search, or set a custom name below.
                </Text>
                <TextInput
                  style={[styles.locInput, { backgroundColor: T.surface2, borderColor: T.border, color: T.text, marginTop: 8, width: '100%' }]}
                  value={editAddr}
                  onChangeText={setEditAddr}
                  placeholder="e.g. My Home, Goa Beach…"
                  placeholderTextColor={T.textMuted}
                />
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: T.accent, borderColor: T.accent, marginTop: 8 }]}
                  onPress={() => {
                    setManualAddress(editAddr.trim() || null);
                    setShowLocModal(false);
                  }}
                >
                  <Text style={[styles.modalBtnText, { color: T.mode === 'dark' ? '#000' : '#FFF' }]}>Use This Name</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Manual coords toggle */}
            <TouchableOpacity
              style={styles.manualToggle}
              onPress={() => setShowManualCoords(p => !p)}
            >
              <Ionicons name={showManualCoords ? 'chevron-up' : 'chevron-down'} size={14} color={T.textMuted} />
              <Text style={[styles.manualToggleText, { color: T.textMuted }]}>Enter coordinates manually</Text>
            </TouchableOpacity>

            {showManualCoords && (
              <View style={styles.manualCoords}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: T.textSub }]}>Latitude</Text>
                    <TextInput
                      style={[styles.locInput, { backgroundColor: T.surface2, borderColor: T.border, color: T.text }]}
                      value={editLat}
                      onChangeText={setEditLat}
                      placeholder="12.971599"
                      placeholderTextColor={T.textMuted}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: T.textSub }]}>Longitude</Text>
                    <TextInput
                      style={[styles.locInput, { backgroundColor: T.surface2, borderColor: T.border, color: T.text }]}
                      value={editLon}
                      onChangeText={setEditLon}
                      placeholder="77.594566"
                      placeholderTextColor={T.textMuted}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <Text style={[styles.inputLabel, { color: T.textSub }]}>Label (optional)</Text>
                <TextInput
                  style={[styles.locInput, { backgroundColor: T.surface2, borderColor: T.border, color: T.text }]}
                  value={editAddr}
                  onChangeText={setEditAddr}
                  placeholder="e.g. Bangalore, Karnataka"
                  placeholderTextColor={T.textMuted}
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: T.surface2, borderColor: T.border }]}
                    onPress={() => { setManualLocation(null); setManualAddress(null); setShowLocModal(false); }}
                  >
                    <Text style={[styles.modalBtnText, { color: T.danger }]}>Reset to GPS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: T.accent, borderColor: T.accent, flex: 1 }]}
                    onPress={() => {
                      const lat = parseFloat(editLat);
                      const lon = parseFloat(editLon);
                      if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                        Alert.alert('Invalid', 'Enter valid lat/lon.');
                        return;
                      }
                      setManualLocation({ coords: { latitude: lat, longitude: lon } });
                      setManualAddress(editAddr.trim() || null);
                      setShowLocModal(false);
                    }}
                  >
                    <Text style={[styles.modalBtnText, { color: T.mode === 'dark' ? '#000' : '#FFF' }]}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
  appName: { fontSize: 18, fontWeight: '800', letterSpacing: 3 },
  headerRight: { flexDirection: 'row', gap: 8 },
  headerBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  cameraContainer: { flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#000' },
  camera: { flex: 1 },
  grid: { ...StyleSheet.absoluteFillObject },
  gridLine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.13)' },
  gridLineH: { height: 1, left: 0, right: 0 },
  gridLineV: { width: 1, top: 0, bottom: 0 },
  bracket: { position: 'absolute', width: 22, height: 22, opacity: 0.75 },
  bracketTL: { top: 16, left: 16, borderTopWidth: 2, borderLeftWidth: 2 },
  bracketTR: { top: 16, right: 16, borderTopWidth: 2, borderRightWidth: 2 },
  bracketBL: { bottom: 16, left: 16, borderBottomWidth: 2, borderLeftWidth: 2 },
  bracketBR: { bottom: 16, right: 16, borderBottomWidth: 2, borderRightWidth: 2 },
  zoomIndicator: { position: 'absolute', top: 12, alignSelf: 'center', flexDirection: 'row', gap: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  zoomPip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)' },
  zoomPipText: { fontSize: 11, fontWeight: '700' },
  brightnessBar: { position: 'absolute', bottom: 8, left: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  brightBtn: { padding: 2 },
  brightTrack: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  brightFill: { height: '100%', backgroundColor: '#FFD700', borderRadius: 2 },
  brightLabel: { color: '#FFD700', fontSize: 10, fontWeight: '700', minWidth: 30, textAlign: 'right', fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
  controls: { borderTopWidth: 1 },
  shootControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 32, paddingVertical: 14 },
  controlBtn: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  shutterBtn: { width: 74, height: 74, borderRadius: 37, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 58, height: 58, borderRadius: 29 },
  previewControls: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  previewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  previewBtnText: { fontSize: 14, fontWeight: '600' },
  saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 14, fontWeight: '700' },
  bottomRow: { paddingHorizontal: 16, paddingBottom: 4, gap: 6 },
  zoomRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  zoomBtn: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  zoomBtnText: { fontSize: 12, fontWeight: '700' },
  gpsStatus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  gpsStatusText: { fontSize: 10, letterSpacing: 0.3 },
  permText: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  permSubText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  permBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  permBtnText: { fontWeight: '700', fontSize: 16 },
  // Edit location button
  editLocBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  editLocText: { flex: 1, fontSize: 12, fontWeight: '500' },
  // Manual location modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  modalHint: { fontSize: 12, lineHeight: 18, marginBottom: 10 },
  inputLabel: { fontSize: 11, fontWeight: '600', marginTop: 6, marginBottom: 3, letterSpacing: 0.5 },
  locInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 2 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1 },
  modalBtnText: { fontSize: 14, fontWeight: '700' },
});
