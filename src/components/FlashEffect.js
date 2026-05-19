import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

export default function FlashEffect() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, { backgroundColor: '#FFFFFF', opacity }]}
      pointerEvents="none"
    />
  );
}
