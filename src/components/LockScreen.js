import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '../theme/ThemeContext';
import { getSetting } from '../db/database';

// PIN pad gate shown on app launch when a PIN is set; biometric button if enrolled.
export default function LockScreen({ onUnlock }) {
  const { theme, gradients, t } = useTheme();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const savedPin = getSetting('pin', '');

  const tryBiometric = useCallback(async () => {
    try {
      const has = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (has && enrolled && getSetting('biometric', '1') === '1') {
        const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'أتمم 🔒' });
        if (res.success) onUnlock();
      }
    } catch (e) { /* not available */ }
  }, [onUnlock]);

  useEffect(() => {
    tryBiometric();
  }, []);

  const press = (d) => {
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    setError(false);
    if (next.length === savedPin.length) {
      if (next === savedPin) onUnlock();
      else {
        Vibration.vibrate(200);
        setError(true);
        setTimeout(() => setPin(''), 350);
      }
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Text style={styles.logo}>🔒</Text>
      <Text style={[styles.title, { color: theme.text }]}>{t('enterPin')}</Text>
      {error ? <Text style={{ color: '#FF6B6B', fontWeight: '700' }}>{t('wrongPin')}</Text> : null}

      <View style={styles.dotsRow}>
        {savedPin.split('').map((_, i) => (
          <View key={i} style={[styles.dot, { borderColor: theme.textSecondary }, i < pin.length && { backgroundColor: gradients.primary[0], borderColor: gradients.primary[0] }]} />
        ))}
      </View>

      <View style={styles.pad}>
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
          <TouchableOpacity
            key={i}
            disabled={k === ''}
            onPress={() => (k === '⌫' ? setPin((p) => p.slice(0, -1)) : press(k))}
            style={[styles.key, { backgroundColor: k === '' ? 'transparent' : theme.card }]}
          >
            <Text style={[styles.keyText, { color: theme.text }]}>{k}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity onPress={tryBiometric} style={{ marginTop: 18 }}>
        <Text style={{ color: gradients.secondary[0], fontWeight: '800' }}>👆 {t('useBiometric')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 99, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logo: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '900', marginBottom: 12 },
  dotsRow: { flexDirection: 'row', gap: 12, marginVertical: 22 },
  dot: { width: 15, height: 15, borderRadius: 8, borderWidth: 2 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', width: 260, justifyContent: 'center', gap: 14 },
  key: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 24, fontWeight: '800' },
});
