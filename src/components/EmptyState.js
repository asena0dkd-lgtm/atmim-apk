import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

// Friendly empty state: big emoji "illustration" + encouraging copy.
export default function EmptyState({ emoji = '🌱', title, hint }) {
  const { theme } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.bubble, { backgroundColor: theme.card }]}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {hint ? <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  bubble: {
    width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center',
    marginBottom: 18, elevation: 3, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  emoji: { fontSize: 52 },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  hint: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
});
