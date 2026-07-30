import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Modal, Alert, Platform, KeyboardAvoidingView, FlatList,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../theme/ThemeContext';
import { priorityColors } from '../theme/colors';
import {
  getTask, createTask, updateTask, listCategories, listTasks,
  listTemplates, addTemplate, touchTemplate, setSetting, getSetting,
} from '../db/database';
import { autoEncouragement, fmtTime } from '../utils/helpers';
import GradientButton from '../components/GradientButton';
import { useTimer } from '../state/TimerContext';

const REPEAT_OPTS = ['none', 'daily', 'weekly', 'monthly', 'custom'];

export default function TaskFormScreen({ navigation, route }) {
  const { theme, gradients, t, lang, rtl } = useTheme();
  const { startTimer } = useTimer();
  const { taskId, presetName, presetDue, focusLink } = route.params || {};

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(null);
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState(null);
  const [showPicker, setShowPicker] = useState(null); // 'date' | 'time' | null
  const [repeatType, setRepeatType] = useState('none');
  const [customDays, setCustomDays] = useState(0); // 7-bit mask
  const [pomoOn, setPomoOn] = useState(false);
  const [pomoMins, setPomoMins] = useState(25);
  const [parentTask, setParentTask] = useState(null);
  const [triggerType, setTriggerType] = useState('complete');
  const [attachment, setAttachment] = useState(null);
  const [encouragement, setEncouragement] = useState('');
  const [categories, setCategories] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showLinkPicker, setShowLinkPicker] = useState(!!focusLink);
  const [linkCandidates, setLinkCandidates] = useState([]);
  const [suggestion, setSuggestion] = useState(null);
  const [recording, setRecording] = useState(null);

  useEffect(() => {
    setCategories(listCategories());
    setTemplates(listTemplates());
    setLinkCandidates(listTasks({ status: 'pending' }).filter((x) => x.id !== taskId));
    if (taskId) {
      const task = getTask(taskId);
      if (task) {
        setName(task.name);
        setDescription(task.description || '');
        setCategory(task.category);
        setPriority(task.priority || 'medium');
        setDueDate(task.due_date ? new Date(task.due_date) : null);
        setRepeatType(task.repeat_type || 'none');
        if (task.repeat_type === 'custom') setCustomDays(task.repeat_interval || 0);
        setPomoOn(task.pomodoro_active === 1);
        setPomoMins(task.pomodoro_duration || 25);
        setParentTask(task.parent_task_id ? getTask(task.parent_task_id) : null);
        setTriggerType(task.trigger_type || 'complete');
        setAttachment(task.attachment_path);
        setEncouragement(task.encouragement_text || '');
      }
    } else {
      if (presetName) setName(presetName);
      if (presetDue) setDueDate(new Date(presetDue));
    }
  }, [taskId]);

  // Smart suggestion: frequent template matching the first letter + current hour bucket.
  useEffect(() => {
    if (!name || name.length !== 1 || taskId) { if (!name) setSuggestion(null); return; }
    const hour = new Date().getHours();
    const bucket = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    const letter = name.trim().charAt(0).toLowerCase();
    const hit = templates.find((tp) => {
      const nm = tp.name.toLowerCase();
      return (nm.startsWith(letter) || nm.includes(` ${letter}`)) && tp.usage_count >= 1;
    });
    const pattern = getSetting(`pattern_${bucket}_${letter}`, null);
    if (hit || pattern) {
      const tpl = hit || templates.find((tp) => tp.id === Number(pattern));
      if (tpl) setSuggestion(tpl);
    } else setSuggestion(null);
  }, [name, templates]);

  const applyTemplate = (tpl) => {
    try {
      const d = JSON.parse(tpl.task_data);
      if (d.category) setCategory(d.category);
      if (d.priority) setPriority(d.priority);
      if (d.repeat_type) setRepeatType(d.repeat_type);
      setPomoOn(!!d.pomodoro_active);
      if (d.pomodoro_duration) setPomoMins(d.pomodoro_duration);
      if (d.description) setDescription(d.description);
      if (!name || name.length <= 1) setName(tpl.name.split('|')[0].trim());
      touchTemplate(tpl.id);
      setSuggestion(null);
      setShowTemplates(false);
    } catch (e) { /* bad template */ }
  };

  const pickDate = (mode) => setShowPicker(mode);
  const onPicked = (event, value) => {
    setShowPicker(null);
    if (event.type !== 'set' || !value) return;
    const base = dueDate ? new Date(dueDate) : new Date();
    if (showPicker === 'date') {
      base.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());
    } else {
      base.setHours(value.getHours(), value.getMinutes(), 0, 0);
    }
    setDueDate(new Date(base));
  };

  const pickImage = async (useCamera) => {
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!result.canceled && result.assets?.[0]?.uri) setAttachment(result.assets[0].uri);
  };

  const toggleRecord = async () => {
    if (recording) {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (uri) {
        const dest = `${FileSystem.documentDirectory}rec_${Date.now()}.m4a`;
        try { await FileSystem.copyAsync({ from: uri, to: dest }); setAttachment(dest); } catch (e) { setAttachment(uri); }
      }
      return;
    }
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) return;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    setRecording(rec);
  };

  const toggleCustomDay = (dayIdx) => {
    setCustomDays((m) => m ^ (1 << dayIdx));
  };

  const weekDays = t('weekDays');

  const save = (startPomodoro = false) => {
    if (!name.trim()) {
      Alert.alert('✏️', t('taskName'));
      return;
    }
    const repeatInterval = repeatType === 'custom' ? customDays || 127 : 1;
    const payload = {
      name: name.trim(),
      description,
      category,
      priority,
      due_date: dueDate ? dueDate.toISOString() : null,
      repeat_type: repeatType,
      repeat_interval: repeatInterval,
      pomodoro_active: pomoOn,
      pomodoro_duration: pomoOn ? pomoMins : 0,
      parent_task_id: parentTask ? parentTask.id : null,
      trigger_type: parentTask ? triggerType : null,
      attachment_path: attachment,
      encouragement_text: encouragement || autoEncouragement(category || 'أخرى'),
      status: 'pending',
    };
    let id = taskId;
    if (taskId) updateTask(taskId, payload);
    else {
      id = createTask(payload);
      // record usage pattern for smart suggestions
      const hour = new Date().getHours();
      const bucket = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
      const letter = name.trim().charAt(0).toLowerCase();
      setSetting(`pattern_${bucket}_${letter}`, String(id));
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (startPomodoro && pomoOn) startTimer({ id, name: payload.name, pomodoro_duration: pomoMins }, pomoMins);
    navigation.goBack();
  };

  const saveAsTemplate = () => {
    if (!name.trim()) return;
    addTemplate(name.trim(), {
      category, priority, repeat_type: repeatType, pomodoro_active: pomoOn, pomodoro_duration: pomoMins, description,
    });
    setTemplates(listTemplates());
    Alert.alert('✨', t('saved'));
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Name */}
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('taskNamePlaceholder')}
          placeholderTextColor={theme.textSecondary}
          style={[styles.nameInput, { color: theme.text, textAlign: rtl ? 'right' : 'left' }]}
        />

        {/* Smart suggestion */}
        {suggestion ? (
          <TouchableOpacity onPress={() => applyTemplate(suggestion)} style={[styles.suggestionBar, { backgroundColor: theme.card, borderColor: gradients.accent[0] }]}>
            <Text style={{ color: theme.text, fontWeight: '700' }}>
              ✨ {t('smartSuggestion')}: {suggestion.name}
            </Text>
            <Text style={{ color: gradients.accent[0], fontWeight: '900' }}>{t('useTemplate')}</Text>
          </TouchableOpacity>
        ) : null}

        {/* Description */}
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={t('description')}
          placeholderTextColor={theme.textSecondary}
          multiline
          style={[styles.descInput, { backgroundColor: theme.inputBg, color: theme.text, textAlign: rtl ? 'right' : 'left' }]}
        />

        {/* Category */}
        <Text style={[styles.label, { color: theme.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>{t('category')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: rtl ? 'row-reverse' : 'row' }}>
          {categories.map((c) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => {
                setCategory(category === c.name ? null : c.name);
                if (!encouragement) setEncouragement('');
              }}
              style={[
                styles.catChip,
                { backgroundColor: theme.card, borderColor: category === c.name ? c.color : theme.border },
              ]}
            >
              <View style={[styles.catDot, { backgroundColor: c.color }]} />
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>{lang === 'ar' ? c.name : c.name_en}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Priority */}
        <Text style={[styles.label, { color: theme.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>{t('priority')}</Text>
        <View style={[styles.row, rtl && { flexDirection: 'row-reverse' }]}>
          {['low', 'medium', 'high'].map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setPriority(p)}
              style={[
                styles.prioChip,
                { backgroundColor: theme.card, borderColor: priority === p ? priorityColors[p] : theme.border },
                priority === p && { backgroundColor: priorityColors[p] + '22' },
              ]}
            >
              <View style={[styles.catDot, { backgroundColor: priorityColors[p] }]} />
              <Text style={{ color: theme.text, fontWeight: '700' }}>{t(p)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Due date */}
        <Text style={[styles.label, { color: theme.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>{t('dueDate')}</Text>
        <View style={[styles.row, rtl && { flexDirection: 'row-reverse' }]}>
          <TouchableOpacity onPress={() => pickDate('date')} style={[styles.pickBtn, { backgroundColor: theme.card }]}>
            <Text style={{ color: theme.text, fontWeight: '700' }}>
              📅 {dueDate ? dueDate.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US') : t('pickDate')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => pickDate('time')} style={[styles.pickBtn, { backgroundColor: theme.card }]}>
            <Text style={{ color: theme.text, fontWeight: '700' }}>
              🕐 {dueDate ? fmtTime(dueDate.toISOString(), lang) : t('pickTime')}
            </Text>
          </TouchableOpacity>
          {dueDate ? (
            <TouchableOpacity onPress={() => setDueDate(null)} style={styles.clearBtn}>
              <Text style={{ color: '#FF6B6B', fontWeight: '800' }}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {showPicker ? (
          <DateTimePicker
            value={dueDate || new Date()}
            mode={showPicker}
            display="default"
            onChange={onPicked}
          />
        ) : null}

        {/* Repeat */}
        <Text style={[styles.label, { color: theme.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>{t('repeat')}</Text>
        <View style={[styles.row, { flexWrap: 'wrap' }, rtl && { flexDirection: 'row-reverse' }]}>
          {REPEAT_OPTS.map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => setRepeatType(r)}
              style={[styles.repeatChip, { backgroundColor: theme.card, borderColor: repeatType === r ? gradients.secondary[0] : theme.border }]}
            >
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>{t(r)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {repeatType === 'custom' ? (
          <View style={[styles.row, { flexWrap: 'wrap', marginTop: 8 }, rtl && { flexDirection: 'row-reverse' }]}>
            {weekDays.map((d, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => toggleCustomDay(i)}
                style={[styles.dayChip, { backgroundColor: customDays & (1 << i) ? gradients.secondary[0] : theme.card }]}
              >
                <Text style={{ color: customDays & (1 << i) ? '#fff' : theme.text, fontWeight: '700', fontSize: 12 }}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* Pomodoro */}
        <View style={[styles.pomoCard, { backgroundColor: theme.card }]}>
          <View style={[styles.row, { justifyContent: 'space-between' }, rtl && { flexDirection: 'row-reverse' }]}>
            <Text style={{ color: theme.text, fontWeight: '800' }}>⏳ {t('pomodoro')}</Text>
            <Switch value={pomoOn} onValueChange={setPomoOn} trackColor={{ true: gradients.primary[0] }} thumbColor="#fff" />
          </View>
          {pomoOn ? (
            <>
              <Text style={{ color: theme.textSecondary, marginTop: 6, textAlign: 'center', fontWeight: '700' }}>
                {t('pomodoroDuration')}: <Text style={{ color: theme.text, fontWeight: '900' }}>{pomoMins} {t('minutes')}</Text>
              </Text>
              <Slider
                minimumValue={5}
                maximumValue={240}
                step={5}
                value={pomoMins}
                onValueChange={setPomoMins}
                minimumTrackTintColor={gradients.primary[0]}
                maximumTrackTintColor={theme.border}
                thumbTintColor={gradients.primary[0]}
              />
            </>
          ) : null}
        </View>

        {/* Task linking */}
        <TouchableOpacity onPress={() => setShowLinkPicker(true)} style={[styles.linkBtn, { backgroundColor: theme.card }]}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>
            🔗 {parentTask ? `${t('noteLinked')}: ${parentTask.name}` : t('addDependent')}
          </Text>
          {parentTask ? (
            <TouchableOpacity onPress={() => setParentTask(null)}>
              <Text style={{ color: '#FF6B6B', fontWeight: '800' }}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>
        {parentTask ? (
          <View style={[styles.row, { marginTop: 8 }, rtl && { flexDirection: 'row-reverse' }]}>
            {['complete', 'fail', 'cancel'].map((tr) => (
              <TouchableOpacity
                key={tr}
                onPress={() => setTriggerType(tr)}
                style={[styles.repeatChip, { backgroundColor: theme.card, borderColor: triggerType === tr ? gradients.accent[0] : theme.border }]}
              >
                <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>{t('on' + tr.charAt(0).toUpperCase() + tr.slice(1))}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* Attachment */}
        <Text style={[styles.label, { color: theme.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>{t('attachment')}</Text>
        <View style={[styles.row, rtl && { flexDirection: 'row-reverse' }]}>
          <TouchableOpacity onPress={() => pickImage(true)} style={[styles.attachBtn, { backgroundColor: theme.card }]}>
            <Text style={{ fontSize: 18 }}>📷</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '700' }}>{t('camera')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => pickImage(false)} style={[styles.attachBtn, { backgroundColor: theme.card }]}>
            <Text style={{ fontSize: 18 }}>🖼️</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '700' }}>{t('gallery')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleRecord} style={[styles.attachBtn, { backgroundColor: recording ? '#FF6B6B33' : theme.card }]}>
            <Text style={{ fontSize: 18 }}>{recording ? '⏹' : '🎙️'}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '700' }}>{recording ? t('stopPlaying') : t('recordAudio')}</Text>
          </TouchableOpacity>
        </View>
        {attachment ? (
          <View style={[styles.row, { marginTop: 8 }, rtl && { flexDirection: 'row-reverse' }]}>
            <Text style={{ color: theme.textSecondary, fontSize: 12, flex: 1 }} numberOfLines={1}>📎 {attachment.split('/').pop()}</Text>
            <TouchableOpacity onPress={() => setAttachment(null)}>
              <Text style={{ color: '#FF6B6B', fontWeight: '800' }}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Encouragement */}
        <Text style={[styles.label, { color: theme.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>{t('encouragement')}</Text>
        <TextInput
          value={encouragement}
          onChangeText={setEncouragement}
          placeholder={autoEncouragement(category || 'أخرى')}
          placeholderTextColor={theme.textSecondary}
          multiline
          style={[styles.encInput, { backgroundColor: theme.inputBg, color: theme.text, textAlign: rtl ? 'right' : 'left' }]}
        />

        {/* Templates */}
        <View style={[styles.row, rtl && { flexDirection: 'row-reverse' }]}>
          <GradientButton title={`🗂 ${t('templates')}`} small outline colors={gradients.secondary} onPress={() => setShowTemplates(true)} />
          <GradientButton title={`✨ ${t('newTemplate')}`} small outline colors={gradients.accent} onPress={saveAsTemplate} />
        </View>

        <View style={{ height: 24 }} />
        <GradientButton title={t('save')} onPress={() => save(false)} />
        {pomoOn ? (
          <>
            <View style={{ height: 10 }} />
            <GradientButton title={`⏳ ${t('startPomodoro')}`} colors={gradients.secondary} onPress={() => save(true)} />
          </>
        ) : null}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Templates modal */}
      <Modal visible={showTemplates} transparent animationType="slide" onRequestClose={() => setShowTemplates(false)}>
        <View style={[styles.modalBg, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>🗂 {t('templates')}</Text>
            <FlatList
              data={templates}
              keyExtractor={(it) => String(it.id)}
              style={{ maxHeight: 340 }}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => applyTemplate(item)} style={[styles.tplRow, { borderColor: theme.border }]}>
                  <Text style={{ color: theme.text, fontWeight: '700', flex: 1 }}>{item.name}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 11 }}>×{item.usage_count}</Text>
                </TouchableOpacity>
              )}
            />
            <GradientButton title={t('cancel')} outline onPress={() => setShowTemplates(false)} />
          </View>
        </View>
      </Modal>

      {/* Link picker modal */}
      <Modal visible={showLinkPicker} transparent animationType="slide" onRequestClose={() => setShowLinkPicker(false)}>
        <View style={[styles.modalBg, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>🔗 {t('selectTask')}</Text>
            <FlatList
              data={linkCandidates}
              keyExtractor={(it) => String(it.id)}
              style={{ maxHeight: 340 }}
              ListEmptyComponent={<Text style={{ color: theme.textSecondary, textAlign: 'center', padding: 20 }}>—</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => { setParentTask(item); setShowLinkPicker(false); }}
                  style={[styles.tplRow, { borderColor: theme.border }]}
                >
                  <Text style={{ color: theme.text, fontWeight: '700' }}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <GradientButton title={t('cancel')} outline onPress={() => setShowLinkPicker(false)} />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingTop: 60 },
  nameInput: { fontSize: 24, fontWeight: '900', marginBottom: 14, paddingVertical: 6 },
  suggestionBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderRadius: 14, borderWidth: 1.5, padding: 12, marginBottom: 12,
  },
  descInput: { borderRadius: 14, padding: 14, minHeight: 80, textAlignVertical: 'top', fontSize: 14, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18, borderWidth: 1.5 },
  catDot: { width: 9, height: 9, borderRadius: 5 },
  prioChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 14, borderWidth: 1.5 },
  pickBtn: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 14, alignItems: 'center' },
  clearBtn: { padding: 10 },
  repeatChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, borderWidth: 1.5 },
  dayChip: { width: 44, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pomoCard: { borderRadius: 16, padding: 14, marginTop: 16 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, padding: 14, marginTop: 16 },
  attachBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, gap: 4 },
  encInput: { borderRadius: 14, padding: 14, minHeight: 56, fontSize: 14 },
  modalBg: { flex: 1, justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 32 },
  modalTitle: { fontSize: 17, fontWeight: '900', marginBottom: 12, textAlign: 'center' },
  tplRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, borderBottomWidth: 1 },
});
