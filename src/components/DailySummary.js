import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Share } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { listTasks, getActivityForDate, getStreak, todayKey } from '../db/database';
import { isDueTomorrow, fmtTime } from '../utils/helpers';
import { CircularProgress } from './Charts';
import GradientButton from './GradientButton';

// "Your Day at a Glance" sheet — opened from the 9PM notification or Stats screen.
export default function DailySummary({ navigation, route }) {
  const { theme, gradients, t, lang } = useTheme();

  const data = useMemo(() => {
    const today = listTasks({});
    const doneToday = today.filter(
      (x) => x.status === 'completed' && x.updated_at && x.updated_at.slice(0, 10) === todayKey()
    );
    const act = getActivityForDate(todayKey());
    const tomorrowTasks = listTasks({ status: 'pending' }).filter(isDueTomorrow);
    return {
      total: doneToday.length + (listTasks({ status: 'pending' }).filter((x) => x.due_date && x.due_date.slice(0, 10) === todayKey()).length),
      done: doneToday.length,
      pomodoro: act ? act.pomodoro_minutes : 0,
      streak: getStreak(),
      tomorrowTasks,
    };
  }, []);

  const progress = data.total > 0 ? data.done / data.total : data.done > 0 ? 1 : 0;

  const share = async () => {
    const msg = `🌙 ${t('dailySummary')}\n✅ ${t('completedOf', { a: data.done, b: data.total })}\n🔥 ${t('streak')}: ${data.streak}\n⏳ ${data.pomodoro} ${t('minutes')}\n— أتمم`;
    try { await Share.share({ message: msg }); } catch (e) { /* dismissed */ }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.moon}>🌙</Text>
        <Text style={[styles.header, { color: theme.text }]}>{t('dailySummary')}</Text>

        <View style={styles.ringWrap}>
          <CircularProgress progress={progress} size={170} stroke={14}>
            <Text style={[styles.ringText, { color: theme.text }]}>{Math.round(progress * 100)}%</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>
              {t('completedOf', { a: data.done, b: data.total })}
            </Text>
          </CircularProgress>
        </View>

        <View style={[styles.streakCard, { backgroundColor: theme.card }]}>
          <Text style={styles.fire}>🔥</Text>
          <View>
            <Text style={[styles.streakNum, { color: theme.text }]}>{data.streak} {t('days')}</Text>
            <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>{t('streak')}</Text>
          </View>
          <View style={[styles.pomoBadge, { backgroundColor: theme.cardAlt }]}>
            <Text style={{ color: theme.text, fontWeight: '800' }}>⏳ {data.pomodoro} {t('minutes')}</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('tomorrowPreview')}</Text>
        {data.tomorrowTasks.length === 0 ? (
          <Text style={{ color: theme.textSecondary, marginBottom: 12 }}>😴 —</Text>
        ) : (
          data.tomorrowTasks.map((task) => (
            <View key={task.id} style={[styles.tomRow, { backgroundColor: theme.card }]}>
              <Text style={{ color: theme.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>{task.name}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{fmtTime(task.due_date, lang)}</Text>
            </View>
          ))
        )}

        <View style={{ height: 16 }} />
        <GradientButton
          title={t('planTomorrow')}
          colors={gradients.secondary}
          onPress={() => {
            const d = new Date();
            d.setDate(d.getDate() + 1);
            d.setHours(9, 0, 0, 0);
            navigation.navigate('TaskForm', { presetDue: d.toISOString() });
          }}
        />
        <View style={{ height: 10 }} />
        <GradientButton title={t('shareSummary')} outline onPress={share} />
        <View style={{ height: 10 }} />
        <GradientButton title={t('done')} outline colors={gradients.secondary} onPress={() => navigation.goBack()} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 24, paddingTop: 60, alignItems: 'stretch' },
  moon: { fontSize: 40, textAlign: 'center' },
  header: { fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 20 },
  ringWrap: { alignItems: 'center', marginBottom: 20 },
  ringText: { fontSize: 34, fontWeight: '900' },
  streakCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 18, padding: 16, marginBottom: 22,
  },
  fire: { fontSize: 34 },
  streakNum: { fontSize: 18, fontWeight: '900' },
  pomoBadge: { marginLeft: 'auto', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 10 },
  tomRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, padding: 14, marginBottom: 8,
  },
});
