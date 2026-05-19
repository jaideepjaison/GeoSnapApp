import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform, TouchableOpacity, Linking, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getMapStyle } from '../screens/SettingsScreen';
import { useTheme } from '../context/ThemeContext';


export default function GpsOverlay({ location, address, forCapture = false, captureTime = null }) {
  const { theme: T } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  // Use captureTime (frozen) when stamping, otherwise live clock
  const [now, setNow] = useState(captureTime || new Date());

  // Live clock — only runs in live viewfinder, not when stamping a capture
  useEffect(() => {
    if (forCapture) return; // frozen when stamping
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [forCapture]);

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
        // ESRI World Imagery — free satellite, no API key, no UA restrictions
        return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
      case 'terrain':
        // ESRI World Topo Map — free terrain, no API key
        return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}`;
      case 'roadmap':
      default:
        // ESRI World Street Map — free roadmap, no API key, works in React Native
        return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`;
    }
  };

  const mapTileUrl = location
    ? getMapTileUrl(location.coords.latitude, location.coords.longitude, getMapStyle())
    : null;

  const lat = location?.coords?.latitude;
  const lon = location?.coords?.longitude;

  return (
    <Animated.View
      style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      pointerEvents={forCapture ? 'none' : 'box-none'}
    >
      {/* Top-left: Date/Time Badge */}
      <View style={styles.timeBadge}>
        <Text style={[styles.timeText, { color: T.accent }]}>{timeStr}</Text>
        <Text style={styles.dateText}>{dayStr}, {dateStr}</Text>
      </View>

      {/* Bottom: GPS Info Panel (matching reference image style) */}
      <View style={styles.gpsPanel}>
        {/* Main content row: Map thumbnail + Info */}
        <View style={styles.mainRow}>
          {/* R2: Map thumbnail - tappable to open Google Maps */}
          <TouchableOpacity
            style={styles.mapThumb}
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
                <View style={styles.mapLabel}>
                  <Ionicons name="map" size={9} color="#4285F4" />
                  <Text style={styles.mapLabelText}>Maps</Text>
                </View>
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
              <Text style={styles.cityText} numberOfLines={1}>{address}</Text>
            ) : (
              <Text style={styles.cityText}>Locating...</Text>
            )}

            {/* Full address line */}
            {location && (
              <Text style={styles.addressText} numberOfLines={2}>
                Lat {lat?.toFixed(6)}, Long {lon?.toFixed(6)}
              </Text>
            )}

            {/* DMS Coordinates */}
            {location && (
              <Text style={styles.dmsText} numberOfLines={1}>
                {formatCoord(lat, 'lat')}  {formatCoord(lon, 'lon')}
              </Text>
            )}

            {/* Date/Day/Time row */}
            <Text style={styles.metaText}>
              {dayStr}, {dateStr} {timeStr} GMT+05:30
            </Text>

          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 10,
  },
  timeBadge: {
    alignSelf: 'flex-start',
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
