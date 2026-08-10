import React, { createContext, useContext, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';

const AlertContext = createContext();

export function AlertProvider({ children }) {
  const { theme: T } = useTheme();
  const [alertData, setAlertData] = useState(null);
  const [visible, setVisible] = useState(false);
  
  const [toastMessage, setToastMessage] = useState(null);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(-20)).current;
  const toastTimer = React.useRef(null);
  
  const showAlert = (title, message, buttons = []) => {
    setAlertData({ title, message, buttons });
    setVisible(true);
  };

  const closeAlert = () => {
    setVisible(false);
    setTimeout(() => setAlertData(null), 300);
  };

  const showToast = (message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(message);
    fadeAnim.setValue(0);
    slideAnim.setValue(-20);
    
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 54, friction: 8, tension: 70, useNativeDriver: true })
    ]).start();
    
    toastTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -20, duration: 250, useNativeDriver: true })
      ]).start(() => setToastMessage(null));
    }, 2400);
  };

  return (
    <AlertContext.Provider value={{ showAlert, showToast }}>
      {children}
      
      {/* Compact Liquid Glass Toast Notification */}
      {toastMessage && (
        <Animated.View style={[
          styles.toastContainer, 
          { 
            backgroundColor: T.mode === 'dark' ? 'rgba(15, 23, 42, 0.78)' : 'rgba(255, 255, 255, 0.85)', 
            borderColor: T.mode === 'dark' ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.12)',
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}>
          <BlurView intensity={80} tint={T.mode === 'dark' ? 'dark' : 'light'} style={styles.toastBlur}>
            <Ionicons name="checkmark-circle" size={16} color={T.accent || '#1877F2'} />
            <Text style={[styles.toastText, { color: T.mode === 'dark' ? '#F0F2FF' : '#0F172A' }]}>
              {toastMessage}
            </Text>
          </BlurView>
        </Animated.View>
      )}

      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <BlurView intensity={T.mode === 'dark' ? 60 : 40} tint={T.mode === 'dark' ? 'dark' : 'light'} style={[styles.alertBox, { backgroundColor: T.mode === 'dark' ? 'rgba(30,30,42,0.85)' : 'rgba(255,255,255,0.85)', borderColor: T.border }]}>
            <Text style={[styles.title, { color: T.text }]}>{alertData?.title}</Text>
            {alertData?.message && <Text style={[styles.message, { color: T.textSub }]}>{alertData?.message}</Text>}
            
            <View style={styles.buttonRow}>
              {alertData?.buttons && alertData.buttons.length > 0 ? (
                alertData.buttons.map((btn, idx) => (
                  <TouchableOpacity 
                    key={idx} 
                    style={[styles.button, btn.style === 'destructive' ? { backgroundColor: T.danger + '20' } : { backgroundColor: T.accent + '20' }]} 
                    onPress={() => {
                      closeAlert();
                      if (btn.onPress) btn.onPress();
                    }}
                  >
                    <Text style={[styles.buttonText, btn.style === 'destructive' ? { color: T.danger } : { color: T.accent }]}>{btn.text}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <TouchableOpacity style={[styles.button, { backgroundColor: T.accent + '20' }]} onPress={closeAlert}>
                  <Text style={[styles.buttonText, { color: T.accent }]}>OK</Text>
                </TouchableOpacity>
              )}
            </View>
          </BlurView>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
}

export const useAlert = () => useContext(AlertContext);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertBox: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Compact Frosted Glass Toast Pill
  toastContainer: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    borderRadius: 20,
    zIndex: 9999,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  toastBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  toastText: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  }
});
