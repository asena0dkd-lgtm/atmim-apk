import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch,
  RefreshControl, Alert, TextInput, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../theme/ThemeContext';
import {
  getActivityRange, totalPoints, getStreak, listTasks, listCategories,
  exportAll, importAll, todayKey,
} from '../db/database';
import { WeeklyBarChart, LineChart, PieChart, Heatmap } from '../components/Charts';
import GradientButton from '../components/GradientButton';

function last7Keys() {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(todayKey(d));
  }
  return out;
}

function prev7Keys() {
  const out = [];
  for (let i = 13; i >= 7; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(todayKey(d));
  }
  return out;
}

export default function StatsScreen({ navigation }) {
  const { theme, gradients, t, lang, rtl, themeMode, setThemeMode, setLanguage, readSetting, writeSetting } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [activity, setActivity] = useState([]);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [pieSlices, setPieSlices] = useState([]);
  const [pinInput, setPinInput] = useState('');
  const [pinModal, setPinModal] = useState(false);
  const [aboutModal, setAboutModal] = useState(false);

  const load = useCallback(() => {
    setActivity(getActivityRange(84));
    setPoints(totalPoints());
    setStreak(getStreak());
    const completed = listTasks({ status: 'completed' });
    const cats = listCategories();
    const counts = {};
    for (const task of completed) {
      const c = task.category || '—';
      counts[c] = (counts[c] || 0) + 1;
    }
    setPieSlices(
      Object.entries(counts).map(([name, value]) => {
        const cat = cats.find((x) => x.name === name || x.name_en === name);
        return { label: name, value, color: cat ? cat.color : '#B8B8D1' };
      })
    );
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const byDate = useMemo(() => {
    const m = {};
    for (const row of activity) m[row.date] = row;
    return m;
  }, [activity]);

  const week7 = last7Keys();
  const prev7 = prev7Keys();
  const thisWeekVals = week7.map((k) => (byDate[k] ? byDate[k].tasks_completed : 0));
  const lastWeekVals = prev7.map((k) => (byDate[k] ? byDate[k].tasks_completed : 0));
  const thisTotal = thisWeekVals.reduce((a, b) => a + b, 0);
  const lastTotal = lastWeekVals.reduce((a, b) => a + b, 0);
  const pctChange = lastTotal === 0 ? (thisTotal > 0 ? 100 : 0) : Math.round(((thisTotal - lastTotal) / lastTotal) * 100);
  const bestIdx = thisWeekVals.indexOf(Math.max(...thisWeekVals));
  const weekDays = t('weekDays');
  const bestDayName = thisTotal > 0 ? weekDays[new Date(new Date().setDate(new Date().getDate() - (6 - bestIdx))).getDay()] : null;

  const heatDays = useMemo(() => {
    const out = [];
    for (let i = 83; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = todayKey(d);
      out.push({ date: k, count: byDate[k] ? byDate[k].tasks_completed : 0 });
    }
    return out;
  }, [byDate]);

  const doExport = async () => {
    try {
      const path = `${FileSystem.cacheDirectory}atmm_backup_${todayKey()}.json`;
      await FileSystem.writeAsStringAsync(path, exportAll());
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: 'application/json' });
    } catch (e) {
      Alert.alert('⚠️', t('error'));
    }
  };

  const doImport = async () => {
    Alert.alert('📥', t('importConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('ok'),
        onPress: async () => {
          try {
            const res = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
            if (res.canceled || !res.assets?.[0]?.uri) return;
            const content = await FileSystem.readAsStringAsync(res.assets[0].uri);
            importAll(content);
            load();
            Alert.alert('✅', t('saved'));
          } catch (e) {
            Alert.alert('⚠️', t('error'));
          }
        },
      },
    ]);
  };

  const savePin = () => {
    if (pinInput.length >= 4) {
      writeSetting('pin', pinInput);
      setPinInput('');
      setPinModal(false);
      Alert.alert('🔒', t('saved'));
    }
  };

  const silentEnabled = readSetting('silent_enabled', '0') === '1';
  const silentAuto = readSetting('silent_auto', '0') === '1';
  const notifEnabled = readSetting('notifications', '1') === '1';
  const hasPin = !!readSetting('pin', '');

  const Section = ({ title, children }) => (
    <View style={[styles.section, { backgroundColor: theme.card, shadowColor: theme.shadow }]}>
      <Text style={[styles.sectionTitle, { color: theme.text, textAlign: rtl ? 'right' : 'left' }]}>{title}</Text>
      {children}
    </View>
  );

  const SettingRow = ({ label, right, onPress }) => (
    <TouchableOpacity
      disabled={!onPress}
      onPress={onPress}
      style={[styles.settingRow, { borderColor: theme.border }, rtl && { flexDirection: 'row-reverse' }]}
    >
      <Text style={{ color: theme.text, fontWeight: '700', flex: 1, textAlign: rtl ? 'right' : 'left' }}>{label}</Text>
      {right}
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ padding: 16, paddingTop: 56, paddingBottom: 130 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); setTimeout(() => setRefreshing(false), 400); }} tintColor={theme.textSecondary} />}
    >
      <Text style={[styles.header, { color: theme.text, textAlign: rtl ? 'right' : 'left' }]}>{t('stats')}</Text>

      {/* Points + streak */}
      <View style={[styles.rowCards, rtl && { flexDirection: 'row-reverse' }]}>
        <View style={[styles.miniCard, { backgroundColor: theme.card }]}>
          <Text style={{ fontSize: 26 }}>⭐</Text>
          <Text style={[styles.bigNum, { color: theme.text }]}>{points}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>{t('totalPoints')}</Text>
        </View>
        <View style={[styles.miniCard, { backgroundColor: theme.card }]}>
          <Text style={{ fontSize: 26 }}>🔥</Text>
          <Text style={[styles.bigNum, { color: theme.text }]}>{streak}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>{t('streak')}</Text>
        </View>
        <TouchableOpacity style={[styles.miniCard, { backgroundColor: theme.card }]} onPress={() => navigation.navigate('DailySummary')}>
          <Text style={{ fontSize: 26 }}>🌙</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>{t('dailySummary')}</Text>
        </TouchableOpacity>
      </View>

      {/* Weekly comparison */}
      <Section title={`${t('weeklyComparison')} ${pctChange !== 0 ? (pctChange > 0 ? `+${pctChange}% 🎉` : `${pctChange}% 😔`) : ''}`}>
        <View style={[styles.legend, rtl && { flexDirection: 'row-reverse' }]}>
          <View style={[styles.legendItem, rtl && { flexDirection: 'row-reverse' }]}>
            <View style={[styles.legendDot, { backgroundColor: '#8A8A9E' }]} />
            <Text style={{ color: theme.textSecondary, fontSize: 11 }}>{t('lastWeek')} ({lastTotal})</Text>
          </View>
          <View style={[styles.legendItem, rtl && { flexDirection: 'row-reverse' }]}>
            <View style={[styles.legendDot, { backgroundColor: gradients.secondary[0] }]} />
            <Text style={{ color: theme.textSecondary, fontSize: 11 }}>{t('thisWeek')} ({thisTotal})</Text>
          </View>
        </View>
        <WeeklyBarChart thisWeek={thisWeekVals} lastWeek={lastWeekVals} labels={weekDays} width={320} />
        {bestDayName ? (
          <Text style={{ color: theme.textSecondary, marginTop: 8, textAlign: rtl ? 'right' : 'left' }}>
            💡 {t('productiveOn', { day: bestDayName })}
          </Text>
        ) : null}
      </Section>

      {/* Line chart */}
      <Section title={t('completionRate')}>
        <LineChart values={thisWeekVals} width={320} />
      </Section>

      {/* Heatmap */}
      <Section title={t('streakCalendar')}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Heatmap days={heatDays} />
        </ScrollView>
      </Section>

      {/* Pie */}
      <Section title={t('categoryBreakdown')}>
        <View style={{ alignItems: 'center' }}>
          <PieChart slices={pieSlices} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 12 }}>
            {pieSlices.map((s) => (
              <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{s.label} ({s.value})</Text>
              </View>
            ))}
          </View>
        </View>
      </Section>

      {/* Settings */}
      <Text style={[styles.header, { color: theme.text, fontSize: 22, marginTop: 10, textAlign: rtl ? 'right' : 'left' }]}>{t('settings')}</Text>

      <Section title={`🎨 ${t('theme')}`}>
        <View style={[styles.chipRow, rtl && { flexDirection: 'row-reverse' }]}>
          {['dark', 'light', 'auto'].map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => setThemeMode(m)}
              style={[styles.optChip, { borderColor: themeMode === m ? gradients.primary[0] : theme.border, backgroundColor: themeMode === m ? gradients.primary[0] + '22' : 'transparent' }]}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>{t(m)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      <Section title={`🌐 ${t('language')}`}>
        <View style={[styles.chipRow, rtl && { flexDirection: 'row-reverse' }]}>
          {[['ar', 'العربية'], ['en', 'English']].map(([code, label]) => (
            <TouchableOpacity
              key={code}
              onPress={() => setLanguage(code)}
              style={[styles.optChip, { borderColor: lang === code ? gradients.secondary[0] : theme.border, backgroundColor: lang === code ? gradients.secondary[0] + '22' : 'transparent' }]}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      <Section title={`🔕 ${t('silentMode')}`}>
        <SettingRow
          label={t('silentMode')}
          right={<Switch value={silentEnabled} onValueChange={(v) => writeSetting('silent_enabled', v ? '1' : '0')} trackColor={{ true: gradients.primary[0] }} thumbColor="#fff" />}
        />
        <SettingRow
          label={t('silentSchedule')}
          right={<Switch value={silentAuto} onValueChange={(v) => writeSetting('silent_auto', v ? '1' : '0')} trackColor={{ true: gradients.secondary[0] }} thumbColor="#fff" />}
        />
        {silentAuto ? (
          <View style={[styles.chipRow, rtl && { flexDirection: 'row-reverse' }]}>
            {[
              { k: 'silent_start', label: t('from') },
              { k: 'silent_end', label: t('to') },
            ].map(({ k, label }) => (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{label}</Text>
                <TextInput
                  defaultValue={readSetting(k, k === 'silent_start' ? '22:00' : '07:00')}
                  onEndEditing={(e) => writeSetting(k, e.nativeEvent.text)}
                  placeholder="22:00"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.timeInput, { backgroundColor: theme.inputBg, color: theme.text }]}
                />
              </View>
            ))}
          </View>
        ) : null}
      </Section>

      <Section title={`🔔 ${t('notifications')}`}>
        <SettingRow
          label={t('notifications')}
          right={<Switch value={notifEnabled} onValueChange={(v) => writeSetting('notifications', v ? '1' : '0')} trackColor={{ true: gradients.primary[0] }} thumbColor="#fff" />}
        />
      </Section>

      <Section title={`💾 ${t('exportData')} / ${t('importData')}`}>
        <GradientButton title={`📤 ${t('exportData')}`} small outline colors={gradients.secondary} onPress={doExport} />
        <View style={{ height: 8 }} />
        <GradientButton title={`📥 ${t('importData')}`} small outline colors={gradients.accent} onPress={doImport} />
      </Section>

      <Section title={`🔒 ${t('lockApp')}`}>
        {hasPin ? (
          <GradientButton title={t('clearPin')} small outline onPress={() => writeSetting('pin', '')} />
        ) : (
          <GradientButton title={t('setPin')} small onPress={() => setPinModal(true)} />
        )}
        <SettingRow
          label={t('useBiometric')}
          right={
            <Switch
              value={readSetting('biometric', '1') === '1'}
              onValueChange={(v) => writeSetting('biometric', v ? '1' : '0')}
              trackColor={{ true: gradients.secondary[0] }} thumbColor="#fff"
            />
          }
        />
      </Section>

      <Section title={`ℹ️ ${t('about')}`}>
        <SettingRow label={t('about')} right={<Text style={{ color: theme.textSecondary }}>›</Text>} onPress={() => setAboutModal(true)} />
      </Section>

      {/* PIN modal */}
      <Modal visible={pinModal} transparent animationType="fade" onRequestClose={() => setPinModal(false)}>
        <View style={[styles.modalBg, { backgroundColor: theme.overlay }]}>
          <View style={[styles.pinCard, { backgroundColor: theme.card }]}>
            <Text style={{ color: theme.text, fontWeight: '900', fontSize: 16, marginBottom: 12 }}>🔒 {t('setPin')}</Text>
            <TextInput
              value={pinInput}
              onChangeText={(v) => setPinInput(v.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              secureTextEntry
              placeholder="••••"
              placeholderTextColor={theme.textSecondary}
              style={[styles.pinInput, { backgroundColor: theme.inputBg, color: theme.text }]}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <GradientButton title={t('cancel')} small outline onPress={() => setPinModal(false)} style={{ flex: 1 }} />
              <GradientButton title={t('save')} small onPress={savePin} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* About modal */}
      <Modal visible={aboutModal} transparent animationType="fade" onRequestClose={() => setAboutModal(false)}>
        <View style={[styles.modalBg, { backgroundColor: theme.overlay }]}>
          <View style={[styles.pinCard, { backgroundColor: theme.card }]}>
            <Text style={{ fontSize: 40, textAlign: 'center' }}>✅</Text>
            <Text style={{ color: theme.text, fontWeight: '900', fontSize: 18, textAlign: 'center', marginVertical: 8 }}>أتمم — Atmm</Text>
            <Text style={{ color: theme.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 16 }}>{t('aboutText')}</Text>
            <GradientButton title={t('ok')} small onPress={() => setAboutModal(false)} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { fontSize: 26, fontWeight: '900', marginBottom: 14 },
  rowCards: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  miniCard: { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 4 },
  bigNum: { fontSize: 22, fontWeight: '900' },
  section: { borderRadius: 18, padding: 16, marginBottom: 14, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '900', marginBottom: 12 },
  legend: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  optChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  timeInput: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontWeight: '700', width: 76, textAlign: 'center' },
  modalBg: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  pinCard: { borderRadius: 20, padding: 22, width: '100%', maxWidth: 340 },
  pinInput: { borderRadius: 12, textAlign: 'center', fontSize: 22, fontWeight: '900', paddingVertical: 12, letterSpacing: 6 },
});
