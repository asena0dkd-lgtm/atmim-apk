import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { useTimer } from '../state/TimerContext';
import { CircularProgress } from './Charts';
import { formatDuration } from '../utils/helpers';

// Full-screen pomodoro modal: ring + time, pause/resume/reset/+5.
export default function PomodoroModal() {
  const { theme, gradients, t } = useTheme();
  const { timer, expanded, pauseTimer, resumeTimer, resetTimer, addMinutes, stopTimer, collapse } = useTimer();

  if (!timer) return null;
  const progress = timer.durationSec > 0 ? 1 - timer.remainingSec / timer.durationSec : 0;

  return (
    <Modal visible={expanded} animationType="slide" transparent onRequestClose={collapse}>
      <View style={[styles.backdrop, { backgroundColor: theme.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: theme.card }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{timer.taskName}</Text>

          <CircularProgress progress={progress} size={210} stroke={14} colors={timer.done ? gradients.accent : gradients.primary}>
            <Text style={[styles.time, { color: theme.text }]}>{formatDuration(timer.remainingSec)}</Text>
            <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>
              {timer.done ? '🎉' : timer.running ? '⏳' : `⏸ ${t('paused')}`}
            </Text>
          </CircularProgress>

          {timer.done ? (
            <Text style={[styles.doneText, { color: theme.text }]}>{t('timeUp')}</Text>
          ) : null}

          <View style={styles.btnRow}>
            {timer.running ? (
              <CtrlBtn label={t('pause')} emoji="⏸" colors={gradients.accent} onPress={pauseTimer} />
            ) : (
              <CtrlBtn label={t('resume')} emoji="▶️" colors={gradients.secondary} onPress={resumeTimer} />
            )}
            <CtrlBtn label={t('reset')} emoji="🔄" colors={gradients.secondary} onPress={resetTimer} />
            <CtrlBtn label={t('addFive')} emoji="➕" colors={gradients.accent} onPress={() => addMinutes(5)} />
          </View>

          <TouchableOpacity onPress={collapse} style={[styles.ghostBtn, { borderColor: theme.border }]}>
            <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>↓</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={stopTimer} style={styles.stopBtn}>
            <LinearGradient colors={gradients.primary} style={styles.stopGrad}>
              <Text style={styles.stopText}>{t('stopTimer')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function CtrlBtn({ label, emoji, colors, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.ctrl}>
      <LinearGradient colors={colors} style={styles.ctrlGrad}>
        <Text style={styles.ctrlEmoji}>{emoji}</Text>
        <Text style={styles.ctrlLabel}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36, alignItems: 'center' },
  handle: { width: 44, height: 5, borderRadius: 3, marginBottom: 16 },
  title: { fontSize: 19, fontWeight: '800', marginBottom: 18, textAlign: 'center' },
  time: { fontSize: 40, fontWeight: '900', fontVariant: ['tabular-nums'] },
  doneText: { fontSize: 17, fontWeight: '800', marginTop: 10 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  ctrl: { borderRadius: 16, overflow: 'hidden' },
  ctrlGrad: { paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', minWidth: 88 },
  ctrlEmoji: { fontSize: 18 },
  ctrlLabel: { color: '#fff', fontWeight: '800', fontSize: 12, marginTop: 4 },
  ghostBtn: { marginTop: 18, borderWidth: 1, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 6 },
  stopBtn: { marginTop: 12, borderRadius: 16, overflow: 'hidden', alignSelf: 'stretch' },
  stopGrad: { paddingVertical: 14, alignItems: 'center' },
  stopText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
