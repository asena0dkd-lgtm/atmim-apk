import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeContext';
import { priorityColors } from '../theme/colors';
import { fmtTime, fmtDateLabel, isOverdue, truncate, formatDuration } from '../utils/helpers';
import { useTimer } from '../state/TimerContext';
import { ProgressBar } from './Charts';

// One task card: priority left border, badges, pomodoro bar, swipe + long-press actions.
export default function TaskCard({ task, categoryColor, onPress, onComplete, onEdit, onDelete, onPostpone, onLongAction, lang }) {
  const { theme, t, rtl } = useTheme();
  const { timer, expand } = useTimer();
  const overdue = isOverdue(task);
  const borderColor = priorityColors[task.priority] || priorityColors.medium;
  const hasTimer = task.pomodoro_active === 1 && task.pomodoro_duration > 0;
  const isRunning = timer && timer.taskId === task.id;
  const progress = isRunning && timer.durationSec > 0 ? 1 - timer.remainingSec / timer.durationSec : 0;

  const renderLeft = () => (
    <View style={[styles.swipeBox, { backgroundColor: '#4ECDC4' }]}>
      <Text style={styles.swipeIcon}>✓</Text>
      <Text style={styles.swipeText}>{t('complete')}</Text>
    </View>
  );

  const renderRight = () => (
    <View style={styles.rightGroup}>
      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#6BC5D2' }]} onPress={() => onEdit(task)}>
        <Text style={styles.swipeIcon}>✏️</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FFB347' }]} onPress={() => onPostpone(task)}>
        <Text style={styles.swipeIcon}>⏰</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FF6B6B' }]} onPress={() => onDelete(task)}>
        <Text style={styles.swipeIcon}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Swipeable
      friction={1.6}
      leftThreshold={60}
      rightThreshold={40}
      renderLeftActions={renderLeft}
      renderRightActions={renderRight}
      onSwipeableOpen={(dir) => {
        if (dir === 'left') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onComplete(task);
        }
      }}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onPress(task)}
        onLongPress={() => onLongAction(task)}
        delayLongPress={380}
        style={[
          styles.card,
          {
            backgroundColor: theme.card,
            shadowColor: theme.shadow,
          },
          rtl ? { borderRightWidth: 5, borderRightColor: borderColor } : { borderLeftWidth: 5, borderLeftColor: borderColor },
          overdue && { backgroundColor: theme.dangerBg },
        ]}
      >
        <View style={[styles.topRow, rtl && { flexDirection: 'row-reverse' }]}>
          <Text style={[styles.name, { color: theme.text, textAlign: rtl ? 'right' : 'left' }, task.status === 'completed' && styles.doneName]} numberOfLines={1}>
            {task.name}
          </Text>
          {task.category ? (
            <View style={[styles.badge, { backgroundColor: (categoryColor || '#B8B8D1') + '26', borderColor: categoryColor || '#B8B8D1' }]}>
              <Text style={[styles.badgeText, { color: categoryColor || '#B8B8D1' }]}>{task.category}</Text>
            </View>
          ) : null}
        </View>

        {task.description ? (
          <Text style={[styles.desc, { color: theme.textSecondary, textAlign: rtl ? 'right' : 'left' }]} numberOfLines={2}>
            {task.description}
          </Text>
        ) : null}

        <View style={[styles.metaRow, rtl && { flexDirection: 'row-reverse' }]}>
          {task.due_date ? (
            <Text style={[styles.meta, { color: overdue ? '#FF6B6B' : theme.textSecondary }]}>
              {overdue ? `⚠ ${t('overdue')} · ` : '🕐 '}
              {fmtDateLabel(task.due_date, lang, t)} · {fmtTime(task.due_date, lang)}
            </Text>
          ) : (
            <Text style={[styles.meta, { color: theme.textSecondary }]}>∞</Text>
          )}
          {task.repeat_type && task.repeat_type !== 'none' ? <Text style={styles.meta}>🔁</Text> : null}
          {hasTimer ? <Text style={styles.meta}>⏳ {task.pomodoro_duration}{lang === 'ar' ? 'د' : 'm'}</Text> : null}
          {task.parent_task_id ? <Text style={styles.meta}>🔗</Text> : null}
        </View>

        {hasTimer && task.status === 'pending' ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => (isRunning ? expand() : onPress(task))}
            style={styles.pomoWrap}
          >
            {isRunning ? (
              <>
                <Text style={[styles.pomoTime, { color: theme.text }]}>{formatDuration(timer.remainingSec)}</Text>
                <ProgressBar progress={progress} />
              </>
            ) : (
              <Text style={[styles.pomoHint, { color: theme.textSecondary }]}>⏳ {t('tapToStart')}</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16, padding: 14, marginHorizontal: 16, marginVertical: 6,
    shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontWeight: '800', flex: 1 },
  doneName: { textDecorationLine: 'line-through', opacity: 0.5 },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  desc: { fontSize: 13, marginTop: 5, lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  meta: { fontSize: 12, fontWeight: '600' },
  pomoWrap: { marginTop: 10 },
  pomoTime: { fontSize: 15, fontWeight: '800', textAlign: 'center', marginBottom: 2, fontVariant: ['tabular-nums'] },
  pomoHint: { fontSize: 12, textAlign: 'center', paddingVertical: 4 },
  swipeBox: { justifyContent: 'center', alignItems: 'center', width: 96, borderRadius: 16, marginVertical: 6, marginLeft: 16 },
  swipeIcon: { fontSize: 20 },
  swipeText: { color: '#fff', fontWeight: '800', fontSize: 12, marginTop: 2 },
  rightGroup: { flexDirection: 'row', alignItems: 'center', marginRight: 16, gap: 6 },
  actionBtn: { width: 52, height: '78%', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
