import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';

// Full-width gradient button; falls back to outline variant.
export default function GradientButton({
  title, onPress, colors, style, textStyle, outline = false, loading = false, small = false, icon = null,
}) {
  const { theme, gradients } = useTheme();
  const grad = colors || gradients.primary;
  if (outline) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[styles.base, styles.outline, { borderColor: grad[0], backgroundColor: theme.card }, small && styles.small, style]}
      >
        {icon}
        <Text style={[styles.text, { color: grad[0] }, small && styles.textSmall, textStyle]}>{title}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.touch, small && styles.smallTouch, style]}>
      <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.base, small && styles.small]}>
        {loading ? <ActivityIndicator color="#fff" /> : (
          <>
            {icon}
            <Text style={[styles.text, small && styles.textSmall, textStyle]}>{title}</Text>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touch: { borderRadius: 16, overflow: 'hidden' },
  smallTouch: { borderRadius: 12 },
  base: {
    paddingVertical: 15, paddingHorizontal: 20, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
  },
  small: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12 },
  outline: { borderWidth: 1.5 },
  text: { color: '#fff', fontWeight: '800', fontSize: 16 },
  textSmall: { fontSize: 13 },
});
