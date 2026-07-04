import React, { createContext, useContext, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from './ThemeContext';

const AlertContext = createContext();

export function AlertProvider({ children }) {
  const { theme: T } = useTheme();
  const [alertData, setAlertData] = useState(null);
  const [visible, setVisible] = useState(false);
  
  const [toastMessage, setToastMessage] = useState(null);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(-50)).current;
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
    slideAnim.setValue(-50);
    
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 60, friction: 8, useNativeDriver: true })
    ]).start();
    
    toastTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -50, duration: 300, useNativeDriver: true })
      ]).start(() => setToastMessage(null));
    }, 3000);
  };

  return (
    <AlertContext.Provider value={{ showAlert, showToast }}>
      {children}
      
      {/* Toast Notification */}
      {toastMessage && (
        <Animated.View style={[
          styles.toastContainer, 
          { 
            backgroundColor: T.mode === 'dark' ? '#333' : '#333', 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
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
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 12,
    zIndex: 9999,
    elevation: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  }
});
