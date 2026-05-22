import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Animated, Platform, Dimensions,
  Image, Share, Linking, Clipboard,
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

const { width: SCREEN_W } = Dimensions.get('window');

// R4: Track if media permission was already granted this install
let _mediaPermGranted = false;

export default function CameraScreen({ route, navigation }) {
  const { theme, gpsDeeplink, autoSave } = useTheme();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState(null);
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState(null);
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const [isSaving, setIsSaving] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [recentSavedPhoto, setRecentSavedPhoto] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharePhotoUri, setSharePhotoUri] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [captureTime, setCaptureTime] = useState(null);
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
  // Zoom
  const [zoom, setZoom] = useState(0);
  const [showZoomBar, setShowZoomBar] = useState(false);
  // Focus point & Exposure
  const [focusPoint, setFocusPoint] = useState(null);
  const [exposure, setExposure] = useState(0); // -1 to 1
  const [showExposureSlider, setShowExposureSlider] = useState(false);
  // Save toast
  const [showSaveToast, setShowSaveToast] = useState(false);

  const cameraRef = useRef(null);
  const viewShotRef = useRef(null);
  const locationWatchRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const zoomHideTimer = useRef(null);
  // Focus ring animation
  const focusScaleAnim = useRef(new Animated.Value(1.4)).current;
  const focusOpacityAnim = useRef(new Animated.Value(0)).current;
  // Shutter animation
  const shutterScaleAnim = useRef(new Animated.Value(1)).current;
  // Toast animation
  const toastSlideAnim = useRef(new Animated.Value(-60)).current;
  const toastOpacityAnim = useRef(new Animated.Value(0)).current;
  // Preview controls slide
  const previewSlideAnim = useRef(new Animated.Value(80)).current;
  // Recent saved photo bubble scale
  const recentSavedPhotoScaleAnim = useRef(new Animated.Value(0)).current;
  // Share bottom sheet slide
  const shareSlideAnim = useRef(new Animated.Value(380)).current;

  // Touch gesture refs for Exposure Swipe
  const touchStartY = useRef(0);
  const touchStartExposure = useRef(0);
  const isTap = useRef(true);
  const exposureHideTimer = useRef(null);

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

  // Handle Imported Photo from Gallery
  const importedImageUri = route?.params?.importedImageUri;
  useEffect(() => {
    if (importedImageUri) {
      setCapturedPhoto({ uri: importedImageUri });
      setIsPreview(true);
      setTimeout(() => setShowLocModal(true), 300);
      if (navigation) {
        navigation.setParams({ importedImageUri: undefined });
      }
    }
  }, [importedImageUri, navigation]);

  // Request permissions on mount
  useEffect(() => {
    (async () => {
      const locPerm = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(locPerm.status === 'granted');
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

  // Zoom levels — expo-camera CameraView accepts 0-1 float (0 = 1x, 1 = max)
  const ZOOM_LEVELS = [0, 0.15, 0.3];
  const ZOOM_LABELS = ['1x', '1.5x', '2x'];
  const currentZoomIdx = ZOOM_LEVELS.indexOf(zoom) !== -1 ? ZOOM_LEVELS.indexOf(zoom) : 0;

  // ============== GESTURES (TAP TO FOCUS & SWIPE EXPOSURE) ==============
  const handleTouchStart = (evt) => {
    if (isPreview) return;
    touchStartY.current = evt.nativeEvent.pageY;
    touchStartExposure.current = exposure;
    isTap.current = true;
  };

  const handleTouchMove = (evt) => {
    if (isPreview || !focusPoint) return;
    const diff = touchStartY.current - evt.nativeEvent.pageY;
    if (Math.abs(diff) > 8) {
      isTap.current = false;
    }

    const sensitivity = 220; // vertical drag pixels for full scale
    let nextExposure = touchStartExposure.current + (diff / sensitivity);
    nextExposure = Math.max(-1, Math.min(1, nextExposure));
    setExposure(nextExposure);

    if (exposureHideTimer.current) clearTimeout(exposureHideTimer.current);
    setShowExposureSlider(true);
  };

  const handleTouchEnd = (evt) => {
    if (isPreview) return;
    if (isTap.current) {
      const { locationX, locationY } = evt.nativeEvent;
      setFocusPoint({ x: locationX, y: locationY });
      setShowExposureSlider(true);

      // Animate focus ring spring in
      focusScaleAnim.setValue(1.4);
      focusOpacityAnim.setValue(1);
      Animated.parallel([
        Animated.spring(focusScaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
        Animated.timing(focusOpacityAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();

      if (exposureHideTimer.current) clearTimeout(exposureHideTimer.current);
      exposureHideTimer.current = setTimeout(() => {
        Animated.timing(focusOpacityAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
          setFocusPoint(null);
          setShowExposureSlider(false);
        });
      }, 4000);
    } else {
      if (exposureHideTimer.current) clearTimeout(exposureHideTimer.current);
      exposureHideTimer.current = setTimeout(() => {
        Animated.timing(focusOpacityAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
          setFocusPoint(null);
          setShowExposureSlider(false);
        });
      }, 2500);
    }
  };

  // ============== SHUTTER ANIMATION ==============
  const animatedTakePicture = async () => {
    // Scale-down press effect
    Animated.sequence([
      Animated.timing(shutterScaleAnim, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(shutterScaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();

    await takePicture();
  };

  const takePicture = async () => {
    if (!cameraRef.current || isSaving) return;
    try {
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 250);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.92, exif: true });
      const captureDate = new Date();
      setCaptureTime(captureDate);

      if (autoSave) {
        if (!_mediaPermGranted) {
          const p = await MediaLibrary.requestPermissionsAsync();
          if (p.status !== 'granted') {
            Alert.alert('Permission Required', 'Please grant Photos access to save.');
            return;
          }
          _mediaPermGranted = true;
        }

        // Briefly show frame on screen for native click visual feedback
        setCapturedPhoto(photo);
        setIsPreview(true);
        setIsSaving(true);

        // Perform the background ViewShot render, stamp, and gallery saving
        setTimeout(async () => {
          try {
            const uri = await captureRef(viewShotRef, { format: 'jpg', quality: 0.92 });
            const asset = await MediaLibrary.createAssetAsync(uri);
            try {
              await MediaLibrary.createAlbumAsync('GeoSnap', asset, false);
            } catch {}

            // Trigger the premium floating thumbnail bubble animation
            setRecentSavedPhoto(uri);
            recentSavedPhotoScaleAnim.setValue(0);
            Animated.sequence([
              Animated.spring(recentSavedPhotoScaleAnim, { toValue: 1.15, tension: 70, friction: 6, useNativeDriver: true }),
              Animated.spring(recentSavedPhotoScaleAnim, { toValue: 1, tension: 70, friction: 8, useNativeDriver: true }),
              Animated.delay(3500),
              Animated.timing(recentSavedPhotoScaleAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
            ]).start(() => setRecentSavedPhoto(null));

            // Instantly clear captured photo and restore live viewfinder
            setCapturedPhoto(null);
            setIsPreview(false);
            setCaptureTime(null);
            setManualLocation(null);
            setManualAddress(null);
            setExposure(0);
          } catch (err) {
            Alert.alert('Error', 'Failed to auto-save: ' + err.message);
          } finally {
            setIsSaving(false);
          }
        }, 120);
      } else {
        setCaptureTime(new Date());
        setManualLocation(null);
        setManualAddress(null);
        setCapturedPhoto(photo);
        setIsPreview(true);
        // Animate preview controls sliding in
        previewSlideAnim.setValue(80);
        Animated.spring(previewSlideAnim, { toValue: 0, friction: 8, useNativeDriver: true }).start();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to take photo.');
    }
  };

  // ============== SAVE TOAST ==============
  const showToast = () => {
    setShowSaveToast(true);
    toastSlideAnim.setValue(-60);
    toastOpacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(toastSlideAnim, { toValue: 10, friction: 8, useNativeDriver: true }),
      Animated.timing(toastOpacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastSlideAnim, { toValue: -60, duration: 300, useNativeDriver: true }),
        Animated.timing(toastOpacityAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setShowSaveToast(false));
    }, 2000);
  };

  // ============== SAVE (silent, no dialog) ==============
  const savePhoto = async () => {
    if (!capturedPhoto || isSaving) return null;
    if (!_mediaPermGranted) {
      const p = await MediaLibrary.requestPermissionsAsync();
      if (p.status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant Photos access to save.');
        return null;
      }
      _mediaPermGranted = true;
    }
    setIsSaving(true);
    try {
      const uri = await captureRef(viewShotRef, { format: 'jpg', quality: 0.92 });
      const asset = await MediaLibrary.createAssetAsync(uri);
      try { await MediaLibrary.createAlbumAsync('GeoSnap', asset, false); } catch {}
      return uri;
    } catch (err) {
      Alert.alert('Error', 'Failed to save: ' + err.message);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // ============== GPS SHARE MESSAGE ==============
  const getShareMessage = () => {
    const loc = manualLocation || location;
    const addr = manualAddress ?? address;
    if (!loc) return '';
    const lat = loc.coords.latitude.toFixed(6);
    const lon = loc.coords.longitude.toFixed(6);
    const mapUrl = `https://maps.google.com/?q=${lat},${lon}`;
    const parts = [];
    if (addr) parts.push(`📍 ${addr}`);
    parts.push(`🗺️ ${mapUrl}`);
    parts.push('Captured with GeoSnap');
    return parts.join('\n');
  };

  const triggerShareModal = (uri) => {
    setSharePhotoUri(uri);
    setShareCopied(false);
    setShowShareModal(true);
    shareSlideAnim.setValue(380);
    Animated.spring(shareSlideAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }).start();
  };

  const closeShareModal = (shouldRetake = true) => {
    Animated.timing(shareSlideAnim, { toValue: 380, duration: 220, useNativeDriver: true }).start(() => {
      setShowShareModal(false);
      setSharePhotoUri(null);
      if (shouldRetake && isPreview) {
        retake();
      }
    });
  };

  // Save + Share with GPS link
  const handleSaveAndShare = async () => {
    const uri = await savePhoto();
    if (!uri) return;
    showToast(); // Show "Saved!" toast
    triggerShareModal(uri);
  };

  // Save only (silent)
  const handleSaveOnly = async () => {
    const uri = await savePhoto();
    if (!uri) return;
    showToast();
    setTimeout(retake, 1500);
  };

  // Share only (also auto-saves)
  const handleShareOnly = async () => {
    if (!capturedPhoto || isSaving) return;
    setIsSaving(true);
    try {
      const uri = await captureRef(viewShotRef, { format: 'jpg', quality: 0.92 });
      const asset = await MediaLibrary.createAssetAsync(uri);
      try { await MediaLibrary.createAlbumAsync('GeoSnap', asset, false); } catch {}
      const msg = getShareMessage();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Share GeoSnap photo' });
      } else {
        await Share.share({ url: uri, message: msg });
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
        <Ionicons name="camera-outline" size={60} color={T.accent} />
        <Text style={[styles.permText, { color: T.text }]}>Camera access needed</Text>
        <Text style={[styles.permSubText, { color: T.textMuted }]}>GeoSnap needs camera to take GPS-tagged photos</Text>
        <TouchableOpacity style={[styles.permBtn, { backgroundColor: T.accent }]} onPress={requestCameraPermission}>
          <Text style={[styles.permBtnText, { color: T.mode === 'dark' ? '#0A0A0F' : '#FFFFFF' }]}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.absoluteHeader}>
        <View style={styles.headerContentTranslucent}>
          <View style={styles.headerProfileRow}>
            <View style={styles.logoWrap}>
              <Image source={require('../../assets/geo_snap_logo.png')} style={styles.headerLogoImg} resizeMode="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.greetingText, { color: location ? T.accentGreen : 'rgba(255,255,255,0.7)' }]}>
                {location ? 'GPS Connected • Live' : 'Satellites Acquiring...'}
              </Text>
              <Text style={[styles.profileNameText, { color: '#FFF' }]}>GeoSnap Camera</Text>
            </View>
            {location && (
              <TouchableOpacity
                style={[styles.headerBtn, { backgroundColor: 'rgba(0,0,0,0.4)', borderColor: 'rgba(255,255,255,0.2)', borderWidth: 1 }]}
                onPress={openMaps}
                activeOpacity={0.8}
              >
                <Ionicons name="navigate-outline" size={16} color={T.accent} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* Camera / Preview — this whole ref is captured to image */}
      <View
        style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
        ref={viewShotRef}
        collapsable={false}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isPreview && capturedPhoto ? (
          <Image source={{ uri: capturedPhoto.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <>
            <CameraView
              style={styles.camera}
              ref={cameraRef}
              facing={facing}
              flash={flash}
              zoom={zoom}
            />
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
          </>
        )}

        {/* Simulated Camera Exposure/Brightness Overlays */}
        {exposure < 0 && (
          <View 
            pointerEvents="none" 
            style={[
              StyleSheet.absoluteFill, 
              { backgroundColor: '#000', opacity: Math.abs(exposure) * 0.65 }
            ]} 
          />
        )}
        {exposure > 0 && (
          <View 
            pointerEvents="none" 
            style={[
              StyleSheet.absoluteFill, 
              { backgroundColor: '#FFF', opacity: exposure * 0.45 }
            ]} 
          />
        )}

        {/* GPS Overlay — always on top (burned into saved image) */}
        <GpsOverlay
          location={manualLocation || location}
          address={manualAddress ?? address}
          forCapture
          captureTime={captureTime}
        />

        {/* Zoom buttons — floating in camera area */}
        {!isPreview && (
          <View style={styles.zoomFloat}>
            {ZOOM_LABELS.map((lbl, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.zoomFloatBtn,
                  i === currentZoomIdx && { backgroundColor: T.accent, borderColor: T.accent },
                ]}
                onPress={() => { setZoom(ZOOM_LEVELS[i]); setShowZoomBar(true); setTimeout(() => setShowZoomBar(false), 1500); }}
              >
                <Text style={[styles.zoomFloatText, i === currentZoomIdx && { color: T.mode === 'dark' ? '#000' : '#FFF' }]}>{lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {showFlash && <FlashEffect />}

        {/* Zoom indicator overlay */}
        {showZoomBar && !isPreview && (
          <View style={styles.zoomIndicator}>
            {ZOOM_LABELS.map((lbl, i) => (
              <View key={i} style={[styles.zoomPip, i === currentZoomIdx && { backgroundColor: T.accent }]}>
                <Text style={[styles.zoomPipText, { color: i === currentZoomIdx ? '#000' : '#FFF' }]}>{lbl}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Focus Ring & Exposure Slider (Yellow vertical bar + Sun icon) */}
        {focusPoint && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: focusPoint.x - 30,
              top: focusPoint.y - 30,
              width: 90,
              height: 60,
              opacity: focusOpacityAnim,
            }}
          >
            {/* Focus Ring Box */}
            <Animated.View
              style={[
                styles.focusRing,
                {
                  width: 60,
                  height: 60,
                  borderRadius: 6,
                  borderWidth: 1.5,
                  borderColor: T.accent,
                  transform: [{ scale: focusScaleAnim }],
                },
              ]}
            />
            
            {/* Exposure Vertical Slider (Sun icon) */}
            {showExposureSlider && (
              <View
                style={{
                  position: 'absolute',
                  left: 70,
                  top: -10,
                  width: 16,
                  height: 80,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Vertical Track Line */}
                <View
                  style={{
                    width: 2,
                    height: 50,
                    backgroundColor: 'rgba(255, 255, 255, 0.45)',
                    borderRadius: 1,
                  }}
                />
                {/* Sun Thumb */}
                <Animated.View
                  style={{
                    position: 'absolute',
                    transform: [{ translateY: -exposure * 25 }],
                  }}
                >
                  <Ionicons name="sunny" size={16} color="#FFD700" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 1 }} />
                </Animated.View>
              </View>
            )}
          </Animated.View>
        )}

        {/* Floating Saved Photo Corner Bubble */}
        {!isPreview && recentSavedPhoto && (
          <Animated.View
            style={[
              styles.floatingBubble,
              {
                transform: [{ scale: recentSavedPhotoScaleAnim }],
              }
            ]}
          >
            <Image source={{ uri: recentSavedPhoto }} style={styles.floatingBubbleImg} />
            <View style={[styles.floatingBubbleBadge, { backgroundColor: T.accentGreen }]}>
              <Ionicons name="checkmark" size={10} color="#FFF" />
            </View>
          </Animated.View>
        )}
      </View>

      {/* Save toast */}
      {showSaveToast && (
        <Animated.View
          style={[
            styles.saveToast,
            {
              backgroundColor: T.accent,
              transform: [{ translateY: toastSlideAnim }],
              opacity: toastOpacityAnim,
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={18} color={T.mode === 'dark' ? '#000' : '#FFF'} />
          <Text style={[styles.saveToastText, { color: T.mode === 'dark' ? '#000' : '#FFF' }]}>
            Saved to GeoSnap
          </Text>
        </Animated.View>
      )}
      


      {/* Controls Overlay */}
      <SafeAreaView edges={['bottom']} style={styles.absoluteFooter}>
        <View style={styles.footerContentTranslucent}>
        {isPreview ? (
          <Animated.View style={{ transform: [{ translateY: previewSlideAnim }] }}>
            {/* Preview action buttons */}
            <View style={styles.previewControls}>
              <TouchableOpacity style={[styles.previewBtn, { backgroundColor: T.surface2, borderColor: T.border }]} onPress={retake}>
                <Ionicons name="refresh-outline" size={20} color={T.danger} />
                <Text style={[styles.previewBtnText, { color: T.danger }]}>Retake</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: T.accent }, isSaving && styles.saveBtnDisabled]}
                onPress={handleSaveOnly}
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

              <TouchableOpacity
                style={[styles.shareBtn, { backgroundColor: T.surface2, borderColor: T.border }]}
                onPress={handleSaveAndShare}
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
          </Animated.View>
        ) : (
          <View style={styles.shootControls}>
            {/* Flash */}
            <TouchableOpacity style={[styles.controlBtn, { backgroundColor: T.controlBg, borderColor: T.border }]} onPress={toggleFlash}>
              <Ionicons name={flashIcon} size={24} color={flashColor} />
            </TouchableOpacity>

            {/* Shutter */}
            <Animated.View style={{ transform: [{ scale: shutterScaleAnim }] }}>
              <TouchableOpacity style={[styles.shutterBtn, { borderColor: T.shutterBorder }]} onPress={animatedTakePicture} disabled={isSaving}>
                <View style={[styles.shutterInner, { backgroundColor: T.mode === 'dark' ? '#FFF' : T.accent }]} />
              </TouchableOpacity>
            </Animated.View>

            {/* Flip */}
            <TouchableOpacity style={[styles.controlBtn, { backgroundColor: T.controlBg, borderColor: T.border }]} onPress={toggleFacing}>
              <Ionicons name="camera-reverse-outline" size={24} color={T.textSub} />
            </TouchableOpacity>
          </View>
        )}
        </View>
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

      {/* Custom Share Bottom Sheet Modal */}
      <Modal
        visible={showShareModal}
        transparent
        animationType="fade"
        onRequestClose={() => closeShareModal(true)}
      >
        <TouchableOpacity
          style={styles.shareOverlay}
          activeOpacity={1}
          onPress={() => closeShareModal(true)}
        >
          <Animated.View
            style={[
              styles.shareSheet,
              {
                backgroundColor: T.surface,
                borderColor: T.border,
                transform: [{ translateY: shareSlideAnim }],
              }
            ]}
          >
            {/* Grab Handle */}
            <View style={[styles.shareHandle, { backgroundColor: T.border }]} />

            {/* Header */}
            <View style={styles.shareHeader}>
              <View style={[styles.shareIconWrap, { backgroundColor: T.accent + '15' }]}>
                <Ionicons name="share-social" size={20} color={T.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.shareTitle, { color: T.text }]}>SHARE GEOSNAP</Text>
                <Text style={[styles.shareSubtitle, { color: T.textMuted }]}>
                  {gpsDeeplink ? "With GPS location coordinates and maps deep link" : "Share photo tagged with coordinates"}
                </Text>
              </View>
            </View>

            {/* Preview Card */}
            <View style={[styles.sharePreviewCard, { backgroundColor: T.surface2, borderColor: T.border }]}>
              {sharePhotoUri ? (
                <Image source={{ uri: sharePhotoUri }} style={styles.sharePreviewImg} />
              ) : (
                <View style={[styles.sharePreviewImg, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="image-outline" size={24} color={T.textMuted} />
                </View>
              )}
              <View style={styles.sharePreviewTextCol}>
                <Text style={[styles.sharePreviewTitle, { color: T.text }]} numberOfLines={1}>
                  📍 {manualAddress ?? address ?? "GeoSnap Location"}
                </Text>
                <Text style={[styles.sharePreviewDesc, { color: T.textMuted }]} numberOfLines={2}>
                  {getShareMessage()}
                </Text>
              </View>
            </View>

            {/* Copy Notification Toast */}
            {shareCopied && (
              <Animated.View style={[styles.shareToastBanner, { backgroundColor: T.accentGreen }]}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#FFF" />
                <Text style={styles.shareToastBannerText}>GPS Caption Copied to Clipboard!</Text>
              </Animated.View>
            )}

            {/* Sharing App Grid */}
            <View style={styles.shareGrid}>
              {/* Copy Link Button */}
              <TouchableOpacity
                style={[styles.shareGridItem, { backgroundColor: T.surface2 }]}
                onPress={() => {
                  Clipboard.setString(getShareMessage());
                  setShareCopied(true);
                  setTimeout(() => setShareCopied(false), 2500);
                }}
              >
                <View style={[styles.shareAppIcon, { backgroundColor: T.accent + '20' }]}>
                  <Ionicons name="copy-outline" size={22} color={T.accent} />
                </View>
                <Text style={[styles.shareAppName, { color: T.text }]}>Copy Link</Text>
              </TouchableOpacity>

              {/* WhatsApp Button */}
              <TouchableOpacity
                style={[styles.shareGridItem, { backgroundColor: T.surface2 }]}
                onPress={async () => {
                  // Copy link automatically for WhatsApp!
                  Clipboard.setString(getShareMessage());
                  setShareCopied(true);
                  setTimeout(() => setShareCopied(false), 2500);
                  
                  // Share the file natively
                  if (sharePhotoUri) {
                    try {
                      await Sharing.shareAsync(sharePhotoUri, {
                        mimeType: 'image/jpeg',
                        dialogTitle: 'GeoSnap GPS Share',
                      });
                    } catch {}
                  }
                }}
              >
                <View style={[styles.shareAppIcon, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
                </View>
                <Text style={[styles.shareAppName, { color: T.text }]}>WhatsApp</Text>
              </TouchableOpacity>

              {/* Native System Share */}
              <TouchableOpacity
                style={[styles.shareGridItem, { backgroundColor: T.surface2 }]}
                onPress={async () => {
                  if (sharePhotoUri) {
                    try {
                      await Sharing.shareAsync(sharePhotoUri, {
                        mimeType: 'image/jpeg',
                        dialogTitle: 'Share Photo',
                      });
                    } catch {}
                  }
                }}
              >
                <View style={[styles.shareAppIcon, { backgroundColor: T.accent + '15' }]}>
                  <Ionicons name="share-social-outline" size={22} color={T.accent} />
                </View>
                <Text style={[styles.shareAppName, { color: T.text }]}>More Apps</Text>
              </TouchableOpacity>
            </View>

            {/* Cancel Button */}
            <TouchableOpacity
              style={[styles.shareCancelBtn, { backgroundColor: T.surface2, borderColor: T.border }]}
              onPress={() => closeShareModal(true)}
            >
              <Text style={[styles.shareCancelText, { color: T.text }]}>Done</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  
  // Overlays
  absoluteHeader: { zIndex: 10, backgroundColor: '#000' },
  headerContentTranslucent: { paddingHorizontal: 16, paddingVertical: 14 },
  absoluteFooter: { zIndex: 10, backgroundColor: '#000' },
  footerContentTranslucent: { paddingBottom: 10, paddingTop: 10 },
  
  headerProfileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoWrap: { width: 36, height: 36, borderRadius: 8, overflow: 'hidden' },
  headerLogoImg: { width: '100%', height: '100%' },
  greetingText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  profileNameText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.2, marginTop: 1, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  
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
  // Focus ring
  focusRing: { position: 'absolute', width: 60, height: 60, borderRadius: 8, borderWidth: 2 },
  // Floating zoom inside camera
  zoomFloat: { position: 'absolute', bottom: 105, alignSelf: 'center', flexDirection: 'row', gap: 6, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 22, paddingHorizontal: 6, paddingVertical: 4 },
  zoomFloatBtn: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)' },
  zoomFloatText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  // Save toast
  saveToast: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 20, zIndex: 100 },
  saveToastText: { fontSize: 14, fontWeight: '700' },
  // Controls
  controls: { borderTopWidth: 1 },
  shootControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 32, paddingVertical: 10 },
  controlBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  shutterBtn: { width: 68, height: 68, borderRadius: 34, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 54, height: 54, borderRadius: 27 },
  previewControls: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  previewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  previewBtnText: { fontSize: 14, fontWeight: '600' },
  saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 14, fontWeight: '700' },
  permText: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  permSubText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  permBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  permBtnText: { fontWeight: '700', fontSize: 16 },
  // Edit location button
  editLocBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  editLocText: { flex: 1, fontSize: 12, fontWeight: '500' },
  // Location modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 6, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalSubtitle: { fontSize: 12, marginTop: 2 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  // Search bar
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 2 },
  // Results list
  resultsList: { maxHeight: 240 },
  resultItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  resultIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  resultPrimary: { fontSize: 14, fontWeight: '600' },
  resultSecondary: { fontSize: 11, marginTop: 1 },
  resultCoords: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', marginTop: 2 },
  // No results
  noResults: { alignItems: 'center', paddingVertical: 16, gap: 4 },
  noResultsText: { fontSize: 14, fontWeight: '600' },
  noResultsHint: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  // Manual toggle
  manualToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10 },
  manualToggleText: { fontSize: 12, fontWeight: '500' },
  manualCoords: { gap: 4 },
  // Shared modal elements
  inputLabel: { fontSize: 11, fontWeight: '600', marginTop: 6, marginBottom: 3, letterSpacing: 0.5 },
  locInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 2 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  modalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1 },
  modalBtnText: { fontSize: 14, fontWeight: '700' },
  // Floating bubble styles
  floatingBubble: {
    position: 'absolute',
    bottom: 110,
    left: 20,
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3.5,
    elevation: 6,
  },
  floatingBubbleImg: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  floatingBubbleBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  // Custom Share Modal Styles
  shareOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  shareSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    gap: 16,
    maxHeight: '90%',
  },
  shareHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  shareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shareIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  shareSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  sharePreviewCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    alignItems: 'center',
  },
  sharePreviewImg: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  sharePreviewTextCol: {
    flex: 1,
    gap: 2,
  },
  sharePreviewTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  sharePreviewDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  shareToastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  shareToastBannerText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  shareGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 8,
  },
  shareGridItem: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 8,
  },
  shareAppIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareAppName: {
    fontSize: 11,
    fontWeight: '600',
  },
  shareCancelBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  shareCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
