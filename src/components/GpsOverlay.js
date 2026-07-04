import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform, TouchableOpacity, Linking, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getMapStyle } from '../screens/SettingsScreen';
import { useTheme } from '../context/ThemeContext';


export default function GpsOverlay({ location, address, forCapture = false, captureTime = null }) {
  const { theme: T, stampPosition, stampMapSize, horizontalMode, watermarkEnabled } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  // Live clock — always synced to system time; frozen only on capture
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (forCapture) {
      // When stamping the capture, freeze at captureTime
      if (captureTime) setNow(captureTime);
      return;
    }
    // Live clock synced to system time
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [forCapture, captureTime]);

  useEffect(() => {
    if (location) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [location]);

  const formatCoord = (value, type) => {
    const abs = Math.abs(value);
    const deg = Math.floor(abs);
    const minFull = (abs - deg) * 60;
    const min = Math.floor(minFull);
    const sec = ((minFull - min) * 60).toFixed(1);
    const dir = type === 'lat' ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
    return `${deg}°${min}'${sec}"${dir}`;
  };

  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dayStr  = now.toLocaleDateString('en-IN', { weekday: 'long' });

  const openGoogleMaps = () => {
    if (!location) return;
    const { latitude, longitude } = location.coords;
    const url = `geo:${latitude},${longitude}?q=${latitude},${longitude}(GeoSnap+Photo)`;
    const webUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
    Linking.canOpenURL(url)
      .then(supported => Linking.openURL(supported ? url : webUrl))
      .catch(() => Linking.openURL(webUrl));
  };

  // --- Free map tile providers (no API key needed) ---
  const latLonToTile = (lat, lon, zoom) => {
    const x = Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(
      (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, zoom)
    );
    return { x, y, z: zoom };
  };

  const getMapTileUrl = (lat, lon, style) => {
    const zoom = 15;
    const { x, y, z } = latLonToTile(lat, lon, zoom);
    switch (style) {
      case 'satellite':
      case 'hybrid':
        return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
      case 'terrain':
        return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}`;
      case 'roadmap':
      default:
        return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`;
    }
  };

  const mapTileUrl = location
    ? getMapTileUrl(location.coords.latitude, location.coords.longitude, getMapStyle())
    : null;

  const lat = location?.coords?.latitude;
  const lon = location?.coords?.longitude;

  const isTop = stampPosition === 'top';

  // Dynamic Map Size Styles
  let thumbSize = 68;
  let cityFs = 13;
  let addrFs = 9.5;
  let dmsFs = 8.5;
  let metaFs = 8;

  if (stampMapSize === 'small') {
    thumbSize = 52;
    cityFs = 11;
    addrFs = 8.5;
    dmsFs = 7.5;
    metaFs = 7;
  } else if (stampMapSize === 'large') {
    thumbSize = 84;
    cityFs = 15;
    addrFs = 10.5;
    dmsFs = 9.5;
    metaFs = 9.5;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          justifyContent: isTop ? 'flex-start' : 'flex-end',
          paddingTop: 10,
          paddingBottom: forCapture ? 10 : 180,
        }
      ]}
      pointerEvents={forCapture ? 'none' : 'box-none'}
    >

      {/* Bottom: GPS Info Panel (matching reference image style) */}
      <View style={[
        styles.gpsPanel, 
        forCapture && { backgroundColor: 'rgba(255,255,255,0.75)' },
        horizontalMode && { transform: [{ rotate: '90deg' }, { translateX: 50 }, { translateY: -50 }] }
      ]}>
        
        {/* Main content row: Map thumbnail + Info */}
        <View style={styles.mainRow}>
          {/* R2: Map thumbnail - tappable to open Google Maps */}
          <TouchableOpacity
            style={[styles.mapThumb, { width: thumbSize, height: thumbSize }]}
            onPress={openGoogleMaps}
            disabled={!location}
            activeOpacity={0.8}
          >
            {location ? (
              <>
                {mapTileUrl ? (
                  <View style={styles.mapBg}>
                    <Image
                       source={{ uri: mapTileUrl }}
                       style={styles.mapImage}
                       resizeMode="cover"
                     />
                    {/* Red location pin overlay */}
                    <View style={styles.pinOverlay} pointerEvents="none">
                      <View style={styles.mapPinOuter}>
                        <View style={styles.mapPinInner} />
                      </View>
                      <View style={styles.mapPinTip} />
                    </View>
                  </View>
                ) : (
                  <View style={styles.mapBg}>
                    <View style={[styles.mapLine, styles.mapLineH1]} />
                    <View style={[styles.mapLine, styles.mapLineH2]} />
                    <View style={[styles.mapLine, styles.mapLineV1]} />
                    <View style={[styles.mapLine, styles.mapLineV2]} />
                    <View style={styles.mapPinOuter}>
                      <View style={styles.mapPinInner} />
                    </View>
                    <View style={styles.mapPinTip} />
                  </View>
                )}
              </>
            ) : (
              <View style={styles.mapBg}>
                <Ionicons name="location-outline" size={20} color="#AAAACC" />
              </View>
            )}
          </TouchableOpacity>

          {/* Info column */}
          <View style={styles.infoCol}>
            {/* City / Address */}
            {address ? (
              <Text style={[styles.cityText, { fontSize: cityFs }]} numberOfLines={1}>{address}</Text>
            ) : (
              <Text style={[styles.cityText, { fontSize: cityFs }]}>Locating...</Text>
            )}

            {/* Full address line */}
            {location && (
              <Text style={[styles.addressText, { fontSize: addrFs, lineHeight: addrFs + 3.5 }]} numberOfLines={2}>
                Lat {lat?.toFixed(6)}, Long {lon?.toFixed(6)}
              </Text>
            )}

            {/* DMS Coordinates */}
            {location && (
              <Text style={[styles.dmsText, { fontSize: dmsFs }]} numberOfLines={1}>
                {formatCoord(lat, 'lat')}  {formatCoord(lon, 'lon')}
              </Text>
            )}

            {/* Date/Day/Time row */}
            <Text style={[styles.metaText, { fontSize: metaFs }]}>
              {dayStr}, {dateStr} {timeStr}
            </Text>

          </View>
        </View>
      </View>

      {/* Watermark brand row (bottom right corner) */}
      {forCapture && watermarkEnabled && (
        <View style={{ position: 'absolute', bottom: 10, right: 15 }}>
          <Image 
            source={require('../../assets/icon.png')} 
            style={{ width: 80, height: 80, resizeMode: 'contain', opacity: 0.9 }} 
          />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 10,
  },
  timeBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.60)',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  timeText: {
    color: '#00F5C4',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  dateText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    marginTop: 1,
  },
  gpsPanel: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 7,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  brandText: {
    color: '#555577',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  mapThumb: {
    width: 68,
    height: 68,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(66,133,244,0.3)',
  },
  mapBg: {
    flex: 1,
    backgroundColor: '#E8F0FE',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  pinOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLine: {
    position: 'absolute',
    backgroundColor: 'rgba(66,133,244,0.2)',
  },
  mapLineH1: { height: 1, left: 0, right: 0, top: '33%' },
  mapLineH2: { height: 1, left: 0, right: 0, top: '66%' },
  mapLineV1: { width: 1, top: 0, bottom: 0, left: '33%' },
  mapLineV2: { width: 1, top: 0, bottom: 0, left: '66%' },
  mapPinOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EA4335',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  mapPinInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  mapPinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#EA4335',
    marginTop: -2,
  },
  mapLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingVertical: 2,
  },
  mapLabelText: {
    color: '#4285F4',
    fontSize: 8,
    fontWeight: '700',
  },
  infoCol: {
    flex: 1,
    gap: 2,
  },
  cityText: {
    color: '#111122',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  addressText: {
    color: '#333355',
    fontSize: 9.5,
    lineHeight: 13,
  },
  dmsText: {
    color: '#1A56CC',
    fontSize: 8.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '600',
  },
  metaText: {
    color: '#555577',
    fontSize: 8,
    marginTop: 1,
  },
  noteText: {
    color: '#888899',
    fontSize: 7.5,
    fontStyle: 'italic',
    marginTop: 1,
  },
});
