import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Modal, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { listTasks, setTaskStatus, postponeTask } from '../db/database';
import { fmtTime } from '../utils/helpers';
import { useTimer } from '../state/TimerContext';
import GradientButton from './GradientButton';
import EmptyState from './EmptyState';

// Panic mode: red-tinted full screen listing ONLY overdue tasks with 3 big actions.
export default function EmergencyMode({ visible, onClose, onChanged }) {
  const { theme, gradients, t, rtl } = useTheme();
  const { startTimer } = useTimer();
  const [items, setItems] = useState([]);

  const load = useCallback(() => {
    setItems(listTasks({ overdueOnly: true }));
  }, []);

  useEffect(() => {
    if (visible) load();
  }, [visible]);

  const handle = (fn, task) => {
    fn(task);
    const remaining = listTasks({ overdueOnly: true });
    setItems(remaining);
    onChanged && onChanged();
    if (remaining.length === 0) onClose(); // auto-exit
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: '#2A0E1E' }]}>
        <LinearGradient colors={['#FF6B6B33', 'transparent']} style={StyleSheet.absoluteFill} />
        <Text style={styles.siren}>🚨</Text>
        <Text style={[styles.counter, { color: '#FF8E8E' }]}>
          {items.length > 0 ? t('overdueCounter', { n: items.length }) : t('allClear')}
        </Text>

        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={{ padding: 16, gap: 14, flexGrow: 1 }}
          ListEmptyComponent={<EmptyState emoji="🎉" title={t('allClear')} />}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: '#3A1626' }, rtl && { direction: 'rtl' }]}>
              <Text style={[styles.name, { color: '#fff' }]} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.due}>🕐 {fmtTime(item.due_date)}</Text>
              <View style={styles.btnCol}>
                <EmergencyBtn label={t('doItNow')} emoji="🔥" colors={gradients.primary}
                  onPress={() => {
                    startTimer(item, item.pomodoro_duration || 25);
                    handle((tk) => {}, item);
                  }} />
                <EmergencyBtn label={t('postponeTomorrow')} emoji="⏰" colors={gradients.accent}
                  onPress={() => handle((tk) => postponeTask(tk.id, 1), item)} />
                <EmergencyBtn label={t('cancelForever')} emoji="✖️" colors={['#8A8A9E', '#6E6E85']}
                  onPress={() => handle((tk) => setTaskStatus(tk.id, 'cancelled'), item)} />
              </View>
            </View>
          )}
        />

        <View style={{ padding: 20 }}>
          <GradientButton title={t('exitEmergency')} onPress={onClose} outline colors={gradients.primary} />
        </View>
      </View>
    </Modal>
  );
}

function EmergencyBtn({ label, emoji, colors, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.eBtnWrap}>
      <LinearGradient colors={colors} style={styles.eBtn}>
        <Text style={styles.eEmoji}>{emoji}</Text>
        <Text style={styles.eLabel}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 60 },
  siren: { fontSize: 44, textAlign: 'center' },
  counter: { fontSize: 20, fontWeight: '900', textAlign: 'center', marginVertical: 10, paddingHorizontal: 20 },
  card: { borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#FF6B6B55' },
  name: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  due: { color: '#FF8E8E', fontWeight: '700', marginBottom: 12 },
  btnCol: { gap: 10 },
  eBtnWrap: { borderRadius: 16, overflow: 'hidden' },
  eBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14 },
  eEmoji: { fontSize: 18 },
  eLabel: { color: '#fff', fontWeight: '900', fontSize: 15 },
});
