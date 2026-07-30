import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

// Custom tab bar: Notes (left), Tasks (center, raised gradient circle), Stats (right).
const ICONS = { Notes: '📝', Tasks: '✅', Stats: '📊' };

export default function CustomTabBar({ state, navigation }) {
  const { theme, gradients, t, rtl } = useTheme();
  const insets = useSafeAreaInsets();

  // RTL: put Notes on the right side visually by reversing order.
  const routes = state.routes;

  return (
    <View style={[styles.bar, { backgroundColor: theme.tabBar, paddingBottom: Math.max(insets.bottom, 10), borderTopColor: theme.border }]}>
      {routes.map((route, index) => {
        const focused = state.index === index;
        const isCenter = route.name === 'Tasks';
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        if (isCenter) {
          return (
            <TouchableOpacity key={route.key} onPress={onPress} activeOpacity={0.85} style={styles.centerWrap}>
              <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.centerBtn}>
                <Text style={styles.centerIcon}>✓</Text>
              </LinearGradient>
              <Text style={[styles.label, { color: focused ? theme.text : theme.textSecondary }]}>{t('tasks')}</Text>
            </TouchableOpacity>
          );
        }
        return (
          <TouchableOpacity key={route.key} onPress={onPress} style={styles.tab} activeOpacity={0.7}>
            <Text style={[styles.icon, { opacity: focused ? 1 : 0.5 }]}>{ICONS[route.name]}</Text>
            <Text style={[styles.label, { color: focused ? theme.text : theme.textSecondary }]}>
              {route.name === 'Notes' ? t('notes') : t('stats')}
            </Text>
            {focused && <View style={[styles.underline, { backgroundColor: gradients.secondary[0] }]} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'flex-end',
    borderTopWidth: 1, paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  icon: { fontSize: 22, marginBottom: 2 },
  label: { fontSize: 11, fontWeight: '700' },
  underline: { marginTop: 3, width: 18, height: 3, borderRadius: 2 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  centerBtn: {
    width: 58, height: 58, borderRadius: 29, marginTop: -28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF6B6B', shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 8,
    borderWidth: 4, borderColor: '#FFFFFF22',
  },
  centerIcon: { color: '#fff', fontSize: 26, fontWeight: '900' },
});
