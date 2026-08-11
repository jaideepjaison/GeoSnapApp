import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Animated, Platform, Dimensions,
  Image, Linking, Clipboard, Vibration,
  Modal, TextInput, KeyboardAvoidingView, ScrollView as ScrollViewRN,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
// Share handled via expo-sharing (opens native external share sheet)
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import ViewShot from 'react-native-view-shot';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';
import { useFocusEffect } from '@react-navigation/native';
import GpsOverlay from '../components/GpsOverlay';
import FlashEffect from '../components/FlashEffect';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import { useCameraContext } from '../context/CameraContext';

let ExpoVideoModule = null;
try {
  ExpoVideoModule = require('expo-video');
} catch (e) {
  ExpoVideoModule = null;
}

function VideoPreviewPlayer({ videoUri }) {
  if (ExpoVideoModule && ExpoVideoModule.useVideoPlayer && ExpoVideoModule.VideoView) {
    const { useVideoPlayer, VideoView } = ExpoVideoModule;
    const player = useVideoPlayer({ uri: videoUri }, p => {
      p.loop = true;
      p.play();
    });

    return (
      <View style={StyleSheet.absoluteFill}>
        <VideoView
          style={{ width: '100%', height: '100%' }}
          player={player}
          allowsFullscreen
          allowsPictureInPicture
          nativeControls
        />
      </View>
    );
  }

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
      <Ionicons name="videocam" size={48} color="#FFF" />
      <Text style={{ color: '#FFF', fontWeight: '700', marginTop: 8 }}>Recorded Video Preview</Text>
    </View>
  );
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const isSmallScreen = SCREEN_H < 700;

// R4: Track if media permission was already granted this install
let _mediaPermGranted = false;

export default function CameraScreen({ route, navigation }) {
  const getFlagEmoji = (countryCode) => {
    if (!countryCode) return '';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
  };

  const { theme, gpsDeeplink, autoSave, muteAudio } = useTheme();
  const { showAlert, showToast } = useAlert();
  const { triggerCapture } = useCameraContext();
  // Safe theme access
  const T = theme || {};
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [locationPermission, setLocationPermission] = useState(null);
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState(null);
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const [isSaving, setIsSaving] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [stampedImageUri, setStampedImageUri] = useState(null);
  const [recentSavedPhoto, setRecentSavedPhoto] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharePhotoUri, setSharePhotoUri] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);
  const { isPreview, setIsPreview } = useCameraContext();
  const [isSaved, setIsSaved] = useState(false);
  const [mode, setMode] = useState('photo'); // 'photo' | 'video'
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimerRef = useRef(null);
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
  // Glass Top Bar options
  const [hdr, setHdr] = useState(false);
  const [gridOn, setGridOn] = useState(false);

  const cameraRef = useRef(null);
  const viewShotRef = useRef(null);
  const gpsOverlayRef = useRef(null);
  const locationWatchRef = useRef(null);
  const autoSaveTimerRef = useRef(null);
  const isAutoSavingRef = useRef(false);
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
  // Record red button blink animation
  const recBlinkAnim = useRef(new Animated.Value(1)).current;
  // Camera flip 180-degree rotation animation
  const camRotateAnim = useRef(new Animated.Value(0)).current;
  const camRotateVal = useRef(0);

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

  const [isFocused, setIsFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  useEffect(() => {
    if (triggerCapture > 0 && isFocused && !isSaving && !isPreview && !showShareModal && !showLocModal) {
      animatedTakePicture();
    }
  }, [triggerCapture]);

  // Hide tab bar dynamically during image preview to prevent layout overlap
  useEffect(() => {
    const isDark = T?.mode === 'dark';
    navigation.setOptions({
      tabBarStyle: {
        display: isPreview ? 'none' : 'flex',
        position: 'absolute',
        bottom: Math.max(insets.bottom + 6, 16),
        left: 16,
        right: 16,
        height: 66,
        borderRadius: 33,
        borderTopWidth: 0,
        elevation: 12,
        backgroundColor: 'transparent',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: isDark ? 0.45 : 0.18,
        shadowRadius: 20,
      },
      tabBarItemStyle: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 6,
      },
      tabBarLabelStyle: {
        fontSize: 10.5,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 2,
      },
    });
  }, [isPreview, navigation, insets, T?.mode]);

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
              const addressParts = Array.from(new Set([g.street, g.city, g.region, g.country].filter(Boolean)));
              const flag = getFlagEmoji(g.isoCountryCode);
              setAddress(addressParts.join(', ') + (flag ? ` ${flag}` : ''));
            }
          } catch { setAddress(null); }
        }
      );
      locationWatchRef.current = sub;
    })();
    return () => { if (locationWatchRef.current) locationWatchRef.current.remove(); };
  }, [locationPermission]);

  const toggleFlash = () => setFlash(p => p === 'off' ? 'on' : p === 'on' ? 'auto' : 'off');

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

  const processAutoSave = async () => {
    if (isAutoSavingRef.current || !viewShotRef.current) return;
    isAutoSavingRef.current = true;
    try {
      const uri = await captureRef(viewShotRef, { format: 'jpg', quality: 0.92 });
      const asset = await MediaLibrary.createAssetAsync(uri);
      let album = await MediaLibrary.getAlbumAsync('GeoSnap');
      if (!album) {
        await MediaLibrary.createAlbumAsync('GeoSnap', asset, true);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, true);
      }
      setStampedImageUri(uri);
      setRecentSavedPhoto(uri);
      showToast('Auto-saved to GeoSnap');

      recentSavedPhotoScaleAnim.setValue(0);
      Animated.sequence([
        Animated.spring(recentSavedPhotoScaleAnim, { toValue: 1.15, tension: 70, friction: 6, useNativeDriver: true }),
        Animated.spring(recentSavedPhotoScaleAnim, { toValue: 1, tension: 70, friction: 8, useNativeDriver: true }),
        Animated.delay(3500),
        Animated.timing(recentSavedPhotoScaleAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => setRecentSavedPhoto(null));
      setExposure(0);
    } catch (err) {
      console.log('Auto-save error:', err);
    } finally {
      setIsSaving(false);
      isAutoSavingRef.current = false;
      previewSlideAnim.setValue(80);
      Animated.spring(previewSlideAnim, { toValue: 0, friction: 8, useNativeDriver: true }).start();
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current || isSaving) return;
    try {
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 250);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.92, exif: true });
      const captureDate = new Date();
      setCaptureTime(captureDate);
      setManualLocation(null);
      setManualAddress(null);
      setCapturedPhoto(photo);
      setIsPreview(true);
      setIsSaved(false);
      setIsSaving(false);
      // Animate preview controls sliding in
      previewSlideAnim.setValue(80);
      Animated.spring(previewSlideAnim, { toValue: 0, friction: 8, useNativeDriver: true }).start();
    } catch (err) {
      showAlert('Error', 'Failed to take photo.');
    }
  };

  const formatRecordTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const toggleRecording = async () => {
    if (!cameraRef.current) return;
    if (isRecording) {
      try {
        Vibration.vibrate(120);
        cameraRef.current.stopRecording();
      } catch { }
      setIsRecording(false);
      setIsPaused(false);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    } else {
      if (!micPermission?.granted) {
        const p = await requestMicPermission();
        if (!p.granted) {
          showAlert('Permission Required', 'Microphone access is needed for video recording.');
          return;
        }
      }
      try {
        Vibration.vibrate(100);
        setIsRecording(true);
        setIsPaused(false);
        setRecordSeconds(0);

        // Blinking pulse loop for red record button
        recBlinkAnim.setValue(1);
        Animated.loop(
          Animated.sequence([
            Animated.timing(recBlinkAnim, { toValue: 0.35, duration: 550, useNativeDriver: true }),
            Animated.timing(recBlinkAnim, { toValue: 1.0, duration: 550, useNativeDriver: true }),
          ])
        ).start();

        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        recordTimerRef.current = setInterval(() => {
          setRecordSeconds(prev => prev + 1);
        }, 1000);

        const video = await cameraRef.current.recordAsync({ maxDuration: 120 });
        if (video?.uri) {
          setCapturedPhoto({ uri: video.uri, isVideo: true });
          setStampedImageUri(video.uri);
          setCaptureTime(new Date());
          setIsPreview(true);
          setIsSaved(false);
          previewSlideAnim.setValue(80);
          Animated.spring(previewSlideAnim, { toValue: 0, friction: 8, useNativeDriver: true }).start();
        }
      } catch (err) {
        console.log('Video error:', err);
      } finally {
        setIsRecording(false);
        setIsPaused(false);
        recBlinkAnim.stopAnimation();
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      }
    }
  };

  // ============== SAVE (silent, no dialog) ==============
  const savePhoto = async () => {
    if (!capturedPhoto || isSaving) return null;
    if (!_mediaPermGranted) {
      const p = await MediaLibrary.requestPermissionsAsync();
      if (p.status !== 'granted') {
        showAlert('Permission Required', 'Please grant Photos access to save.');
        return null;
      }
      _mediaPermGranted = true;
    }
    setIsSaving(true);
    try {
      if (capturedPhoto.isVideo) {
        showToast('Processing video overlay...');
        const overlayUri = await gpsOverlayRef.current.capture();

        const fileDir = capturedPhoto.uri.substring(0, capturedPhoto.uri.lastIndexOf('/')) + '/';
        const outputUri = `${fileDir}geosnap_out_${Date.now()}.mp4`;

        const cleanVideoUri = capturedPhoto.uri.replace('file://', '');
        const cleanOverlayUri = overlayUri.replace('file://', '');
        const cleanOutputUri = outputUri.replace('file://', '');

        const command = `-i "${cleanVideoUri}" -i "${cleanOverlayUri}" -filter_complex "[1:v][0:v]scale2ref=w=iw:h=-2[ovrl][vid];[vid][ovrl]overlay=x=0:y=main_h-overlay_h-6" -c:v mpeg4 -q:v 2 -c:a copy "${cleanOutputUri}"`;

        const session = await FFmpegKit.execute(command);
        const returnCode = await session.getReturnCode();

        if (ReturnCode.isSuccess(returnCode)) {
          const asset = await MediaLibrary.createAssetAsync(outputUri);
          let album = await MediaLibrary.getAlbumAsync('GeoSnap');
          if (!album) {
            await MediaLibrary.createAlbumAsync('GeoSnap', asset, true);
          } else {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, true);
          }
          return outputUri;
        } else {
          const output = await session.getOutput();
          showAlert('Error', `Overlay failed.\nOutput: ${output ? output.slice(-400) : 'No logs'}`);
          return null;
        }
      } else {
        const uri = await captureRef(viewShotRef, { format: 'jpg', quality: 0.92 });
        const asset = await MediaLibrary.createAssetAsync(uri);
        let album = await MediaLibrary.getAlbumAsync('GeoSnap');
        if (!album) {
          await MediaLibrary.createAlbumAsync('GeoSnap', asset, true);
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, true);
        }
        return uri;
      }
    } catch (err) {
      showAlert('Error', 'Failed to save: ' + err.message);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // Save edited photo/video with updated location stamp
  const handleSaveEdited = async () => {
    if (isSaving || !capturedPhoto) return;
    setIsSaving(true);
    try {
      if (capturedPhoto.isVideo) {
        showToast('Processing video overlay... this may take a moment.');
        // Capture GPS overlay as a transparent PNG
        const overlayUri = await gpsOverlayRef.current.capture();

        // Output file
        // FFmpeg command to overlay the image at the bottom
        // [0:v] is video, [1:v] is image
        // We use overlay=x=0:y=main_h-overlay_h to put it at the bottom.
        const fileDir = capturedPhoto.uri.substring(0, capturedPhoto.uri.lastIndexOf('/')) + '/';
        const outputUri = `${fileDir}geosnap_out_${Date.now()}.mp4`;

        const cleanVideoUri = capturedPhoto.uri.replace('file://', '');
        const cleanOverlayUri = overlayUri.replace('file://', '');
        const cleanOutputUri = outputUri.replace('file://', '');

        const command = `-i "${cleanVideoUri}" -i "${cleanOverlayUri}" -filter_complex "[1:v][0:v]scale2ref=w=iw:h=-2[ovrl][vid];[vid][ovrl]overlay=x=0:y=main_h-overlay_h" -c:v mpeg4 -q:v 2 -c:a copy "${cleanOutputUri}"`;

        const session = await FFmpegKit.execute(command);
        const returnCode = await session.getReturnCode();

        if (ReturnCode.isSuccess(returnCode)) {
          const asset = await MediaLibrary.createAssetAsync(outputUri);
          let album = await MediaLibrary.getAlbumAsync('GeoSnap');
          if (!album) {
            await MediaLibrary.createAlbumAsync('GeoSnap', asset, true);
          } else {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, true);
          }
          setStampedImageUri(outputUri);
          setIsSaved(true);
          showToast('Saved video to GeoSnap gallery!');
        } else {
          const output = await session.getOutput();
          showAlert('Error', `Overlay failed.\nOutput: ${output ? output.slice(-400) : 'No logs'}`);
        }
      } else {
        const uri = await captureRef(viewShotRef, { format: 'jpg', quality: 0.92 });
        const asset = await MediaLibrary.createAssetAsync(uri);
        let album = await MediaLibrary.getAlbumAsync('GeoSnap');
        if (!album) {
          await MediaLibrary.createAlbumAsync('GeoSnap', asset, true);
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, true);
        }
        setStampedImageUri(uri);
        setRecentSavedPhoto(uri);
        setIsSaved(true);
        showToast('Saved photo to GeoSnap gallery!');

        recentSavedPhotoScaleAnim.setValue(0);
        Animated.sequence([
          Animated.spring(recentSavedPhotoScaleAnim, { toValue: 1.15, tension: 70, friction: 6, useNativeDriver: true }),
          Animated.spring(recentSavedPhotoScaleAnim, { toValue: 1, tension: 70, friction: 8, useNativeDriver: true }),
          Animated.delay(3500),
          Animated.timing(recentSavedPhotoScaleAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start(() => setRecentSavedPhoto(null));
      }
    } catch (err) {
      showAlert('Save Error', 'Failed to save: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleFacing = () => {
    camRotateVal.current += 180;
    Animated.spring(camRotateAnim, {
      toValue: camRotateVal.current,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
    setFacing(prev => prev === 'back' ? 'front' : 'back');
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
    showToast('Saved to GeoSnap'); // Show "Saved!" toast
    triggerShareModal(uri);
  };

  // Save only (silent)
  const handleSaveOnly = async () => {
    const uri = await savePhoto();
    if (!uri) return;
    showToast('Saved to GeoSnap');
    setTimeout(retake, 1500);
  };

  const handleShareAutoSaved = async () => {
    // First save if not already saved
    let uriToShare = stampedImageUri;
    if (!uriToShare) {
      uriToShare = await savePhoto();
      if (!uriToShare) return;
      showToast('Saved to GeoSnap');
    }
    triggerShareModal(uriToShare);
  };


  const retake = () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setCapturedPhoto(null);
    setIsPreview(false);
    setIsSaved(false);
    setIsSaving(false);
    setCaptureTime(null);
    setManualLocation(null);
    setManualAddress(null);
    setStampedImageUri(null);
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
    const countryCode = result.address?.country_code;
    const flag = getFlagEmoji(countryCode);
    const name = result.display_name.split(',').slice(0, 3).join(',').trim() + (flag ? ` ${flag}` : '');
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
  const flashColor = flash !== 'off' ? (T.warn || '#F59E0B') : (T.textMuted || '#8E90B0');

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
      {/* Header — App Logo Top-Left | Recording Banner Center | Camera/Video Switcher Top-Right */}
      <SafeAreaView edges={['top']} style={styles.absoluteHeader}>
        <View style={styles.headerBar}>
          {/* Top-Left: App Logo */}
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
            <Image source={require('../../assets/icon.png')} style={{ width: 26, height: 26, borderRadius: 6 }} />
          </View>

          {/* Top-Center: Recording Timer & Pause/Play Control */}
          {isRecording && (
            <View style={styles.recBannerCard}>
              <View style={[styles.recIndicatorDot, isPaused && { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.recTimerText}>
                {isPaused ? 'PAUSED' : 'REC'}  {formatRecordTime(recordSeconds)}
              </Text>
              <TouchableOpacity
                style={styles.recPauseCircle}
                onPress={() => {
                  if (isPaused) {
                    try { cameraRef.current?.resumeRecording(); } catch { }
                    setIsPaused(false);
                    Vibration.vibrate(50);
                  } else {
                    try { cameraRef.current?.pauseRecording(); } catch { }
                    setIsPaused(true);
                    Vibration.vibrate(50);
                  }
                }}
              >
                <Ionicons name={isPaused ? "play" : "pause"} size={14} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Top-Right: Camera / Video Mode Switcher */}
          <TouchableOpacity
            style={styles.glassCircleBtn}
            onPress={async () => {
              if (mode === 'photo') {
                if (!micPermission?.granted) await requestMicPermission();
                setMode('video');
              } else {
                if (isRecording) {
                  try { cameraRef.current?.stopRecording(); } catch { }
                  setIsRecording(false);
                  setIsPaused(false);
                  if (recordTimerRef.current) clearInterval(recordTimerRef.current);
                }
                setMode('photo');
              }
            }}
          >
            <Ionicons name={mode === 'photo' ? 'videocam-outline' : 'camera-outline'} size={20} color="#FFF" />
          </TouchableOpacity>
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
          <>
            {capturedPhoto.isVideo ? (
              <VideoPreviewPlayer videoUri={capturedPhoto.uri} />
            ) : (
              <Image
                source={{ uri: capturedPhoto.uri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                onLoad={() => {
                  if (isSaving && autoSave) {
                    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
                    setTimeout(processAutoSave, 100);
                  }
                }}
                onError={(e) => {
                  console.log('Image load error:', e.nativeEvent?.error);
                  if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
                  setIsSaving(false);
                  if (!capturedPhoto?.uri) {
                    setIsPreview(false);
                    showAlert('Error', 'Failed to display captured photo.');
                  }
                }}
              />
            )}
            {isSaving && (
              <View style={styles.savingOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.savingOverlayText}>
                  {capturedPhoto.isVideo ? 'Saving GPS Video…' : 'Saving GPS Photo…'}
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            <CameraView
              style={styles.camera}
              ref={cameraRef}
              facing={facing}
              flash={flash}
              zoom={zoom}
              mode={mode === 'video' ? 'video' : 'picture'}
              mute={muteAudio}
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
            {['TL', 'TR', 'BL', 'BR'].map(pos => (
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

        {/* GPS Overlay — always on top (burned into saved image & video) */}
        <ViewShot ref={gpsOverlayRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }} style={StyleSheet.absoluteFill} pointerEvents="none">
          <GpsOverlay
            location={manualLocation || location}
            address={manualAddress ?? address}
            forCapture={isPreview}
            captureTime={captureTime}
          />
        </ViewShot>

        {/* Zoom badge */}
        {!isPreview && (
          <TouchableOpacity
            style={styles.zoomBadge}
            activeOpacity={0.7}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onPress={() => {
              const next = (currentZoomIdx + 1) % ZOOM_LEVELS.length;
              setZoom(ZOOM_LEVELS[next]);
            }}
          >
            <Text style={styles.zoomBadgeText}>{ZOOM_LABELS[currentZoomIdx]}</Text>
          </TouchableOpacity>
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






      {/* Bottom Controls — Gallery | Shutter / Record | Switch */}
      <View style={[styles.bottomControlsWrap, { paddingBottom: Math.max(insets.bottom, 12) + (isSmallScreen ? 70 : 80) }]}>
        {isPreview ? (
          <Animated.View style={[
            styles.previewActions,
            {
              transform: [{ translateY: previewSlideAnim }],
              paddingBottom: Math.max(insets.bottom, 8),
            }
          ]}>
            {!isSaved ? (
              <>
                {/* Step 1: Save | Edit | Close */}
                <TouchableOpacity style={[styles.previewCircleBtn, { backgroundColor: T?.accentGreen || '#22C55E' }]} onPress={handleSaveEdited} disabled={isSaving}>
                  <Ionicons name="save-outline" size={isSmallScreen ? 20 : 22} color="#FFF" />
                  <Text style={styles.previewCircleBtnLabel}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.previewCircleBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]} onPress={openLocModal}>
                  <Ionicons name="create-outline" size={isSmallScreen ? 20 : 22} color="#FFF" />
                  <Text style={styles.previewCircleBtnLabel}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.previewCircleBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]} onPress={retake}>
                  <Ionicons name="close-outline" size={isSmallScreen ? 20 : 22} color="#FFF" />
                  <Text style={styles.previewCircleBtnLabel}>Close</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Step 2 (Once Saved): Share | Cancel */}
                <TouchableOpacity style={[styles.previewCircleBtn, { backgroundColor: T?.accent || '#1877F2' }]} onPress={handleShareAutoSaved}>
                  <Ionicons name="share-social-outline" size={isSmallScreen ? 20 : 22} color="#FFF" />
                  <Text style={styles.previewCircleBtnLabel}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.previewCircleBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]} onPress={retake}>
                  <Ionicons name="close-outline" size={isSmallScreen ? 20 : 22} color="#FFF" />
                  <Text style={styles.previewCircleBtnLabel}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        ) : (
          <View style={styles.shootRow}>
            {/* Flash toggle */}
            <TouchableOpacity style={styles.galleryThumb} onPress={toggleFlash}>
              <Ionicons name={flashIcon} size={24} color={flashColor} />
            </TouchableOpacity>
            {/* Shutter / Record button */}
            <Animated.View style={{ transform: [{ scale: shutterScaleAnim }] }}>
              {mode === 'photo' ? (
                <TouchableOpacity style={[styles.shutterBtn, { borderColor: T?.accent || '#1877F2' }]} onPress={animatedTakePicture} disabled={isSaving}>
                  <View style={[styles.shutterInner, { backgroundColor: '#FFF' }]} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.shutterBtn, { borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.2)' }]}
                  onPress={toggleRecording}
                >
                  <Animated.View style={[styles.shutterInner, { backgroundColor: '#EF4444', borderRadius: 30, opacity: isRecording ? recBlinkAnim : 1 }]} />
                </TouchableOpacity>
              )}
            </Animated.View>
            {/* Switch camera */}
            <TouchableOpacity style={styles.switchCamBtn} onPress={toggleFacing} activeOpacity={0.75}>
              <Animated.View
                style={{
                  transform: [{
                    rotate: camRotateAnim.interpolate({
                      inputRange: [0, 360],
                      outputRange: ['0deg', '360deg'],
                    })
                  }]
                }}
              >
                <Ionicons name="camera-reverse" size={26} color="#FFFFFF" />
              </Animated.View>
            </TouchableOpacity>
          </View>
        )}
      </View>

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
                        showAlert('Invalid', 'Enter valid lat/lon.');
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
                    } catch { }
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
                    } catch { }
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

  // Header — clean bar
  absoluteHeader: { zIndex: 10, backgroundColor: 'transparent' },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  glassCircleBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },

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

  // Zoom badge
  zoomBadge: { position: 'absolute', top: 20, left: 20, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  zoomBadgeText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  // Flip overlay
  flipOverlay: { position: 'absolute', top: 20, right: 20, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },

  // Zoom indicator
  zoomIndicator: { position: 'absolute', top: 12, alignSelf: 'center', flexDirection: 'row', gap: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  zoomPip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)' },
  zoomPipText: { fontSize: 11, fontWeight: '700' },

  // Focus ring
  focusRing: { position: 'absolute', width: 60, height: 60, borderRadius: 8, borderWidth: 2 },

  // GPS Panel — Liquid Glass
  gpsPanel: { position: 'absolute', bottom: 100, left: 16, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 24, paddingHorizontal: 18, paddingVertical: 14, maxWidth: 220, zIndex: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10 },
  gpsPanelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  gpsPanelLabel: { color: '#FFF', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  gpsDot: { width: 8, height: 8, borderRadius: 4, shadowColor: '#22C55E', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4 },
  gpsPanelCoord: { color: '#FFF', fontSize: 12, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  gpsPanelAddr: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 4, fontWeight: '500' },

  // Bottom controls
  bottomControlsWrap: { backgroundColor: 'transparent', position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: 30, zIndex: 10 },
  shootRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 40 },
  galleryThumb: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  galleryThumbImg: { width: '100%', height: '100%', borderRadius: 24 },
  shutterBtn: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
  shutterInner: { width: 60, height: 60, borderRadius: 30 },
  switchCamBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },

  // Preview action buttons (circular like the design)
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: isSmallScreen ? 18 : 28,
    paddingVertical: isSmallScreen ? 8 : 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 28,
    marginHorizontal: 16,
    paddingHorizontal: 12,
  },
  previewCircleBtn: {
    width: isSmallScreen ? 48 : 56,
    height: isSmallScreen ? 48 : 56,
    borderRadius: isSmallScreen ? 24 : 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCircleBtnLabel: {
    color: '#FFF',
    fontSize: isSmallScreen ? 9 : 10,
    fontWeight: '600',
    marginTop: 4,
    position: 'absolute',
    bottom: isSmallScreen ? -15 : -18,
  },

  // Save toast
  saveToast: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 20, zIndex: 100 },
  saveToastText: { fontSize: 14, fontWeight: '700' },

  // Permissions
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
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    gap: 12,
  },
  savingOverlayText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Video Recording Banner (Top Positioned)
  recBannerOverlay: {
    position: 'absolute',
    top: 65,
    alignSelf: 'center',
    zIndex: 30,
  },
  recBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  recIndicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  recTimerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    letterSpacing: 0.8,
  },
  recPauseCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
});
