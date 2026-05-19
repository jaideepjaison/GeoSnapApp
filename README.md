# 📍 GeoSnap v2.0 — GPS Camera App

## What's New in v2.0

| # | Requirement | Status |
|---|---|---|
| R1 | Light / Dark / Auto (system) theme | ✅ Settings → Appearance |
| R2 | Google Maps thumbnail + tap to open Maps | ✅ GPS panel shows map card, tappable |
| R3 | Zoom levels (1×, 1.5×, 2×) | ✅ Zoom buttons below shutter |
| R4 | Save permission asked only once on install | ✅ Module-level flag, no repeat dialog |
| R5 | Share to WhatsApp / any app after capture | ✅ Share button in preview + gallery viewer |
| R6 | Gallery: newest photo on top | ✅ Sorted by creationTime descending |
| R7 | Brightness adjustment while capturing | ✅ ☀ button → slider in camera view |
| R8 | GPS link in shared images | ✅ Settings toggle; coordinates in share caption |
| R9 | No "PREVIEW" watermark in saved photo | ✅ Badge is outside viewShotRef |
| R10 | Smaller bundle — removed 3 unused packages | ✅ Removed AsyncStorage, expo-file-system, expo-image-manipulator |

## Setup

```bash
cd GeoSnapApp
yarn install        # or: npm install
yarn android        # or: yarn ios
```

Requires **Expo Go** on your device, or Android Studio / Xcode for emulator.

## Key Notes on R8 (GPS Deep Link)

WhatsApp and Android/iOS gallery apps **cannot render clickable links inside JPEG pixels** — this is a system-level limitation. What GeoSnap does instead:

1. The GPS coordinates are **burned visually** onto the photo (always).
2. When **Share** is tapped, the share dialog includes a text caption with a `maps.google.com` link.
3. In WhatsApp, the recipient sees the link in the caption and can tap it to open Google Maps.
4. Toggle this in **Settings → GPS Deep Link**.

## App Structure

```
App.js                          ← Navigation + ThemeProvider
src/
  context/ThemeContext.js       ← Light/Dark/Auto theme (R1)
  screens/
    CameraScreen.js             ← Camera, GPS, zoom, brightness, share
    GalleryScreen.js            ← Gallery sorted newest-first
    SettingsScreen.js           ← Theme picker + GPS deep link toggle
  components/
    GpsOverlay.js               ← Info panel with map thumbnail (R2)
    FlashEffect.js              ← Shutter flash
```
