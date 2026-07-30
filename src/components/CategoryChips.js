import React from 'react';
import { ScrollView, TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

// Horizontal scroll of category chips with colored dots.
export default function CategoryChips({ categories, selected, onSelect }) {
  const { theme, t, rtl, lang } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, rtl && styles.rowRtl]}
    >
      <Chip
        label={t('all')}
        dot={null}
        active={selected === 'all'}
        onPress={() => onSelect('all')}
        theme={theme}
      />
      {categories.map((c) => (
        <Chip
          key={c.id}
          label={lang === 'ar' ? c.name : c.name_en}
          icon={c.icon}
          dot={c.color}
          active={selected === c.name}
          onPress={() => onSelect(selected === c.name ? 'all' : c.name)}
          theme={theme}
        />
      ))}
    </ScrollView>
  );
}

function Chip({ label, dot, icon, active, onPress, theme }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.chip,
        { backgroundColor: active ? theme.cardAlt : theme.card, borderColor: active && dot ? dot : theme.border },
        active && styles.chipActive,
      ]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={[styles.label, { color: theme.text, opacity: active ? 1 : 0.75 }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row', alignItems: 'center' },
  rowRtl: { flexDirection: 'row-reverse' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
  },
  chipActive: { borderWidth: 2 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  icon: { fontSize: 13 },
  label: { fontWeight: '700', fontSize: 13 },
});
