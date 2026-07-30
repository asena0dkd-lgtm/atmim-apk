import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  Modal, Alert, Share, RefreshControl, Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import {
  listTasks, listCategories, setTaskStatus, deleteTask, postponeTask,
  duplicateTask, createTask, overdueCount,
} from '../db/database';
import { notifyTaskUnlocked } from '../utils/notifications';
import TaskCard from '../components/TaskCard';
import CategoryChips from '../components/CategoryChips';
import EmptyState from '../components/EmptyState';
import EmergencyMode from '../components/EmergencyMode';
import GradientButton from '../components/GradientButton';
import { isSilentNow } from '../utils/helpers';

export default function TasksScreen({ navigation }) {
  const { theme, gradients, t, lang, rtl, readSetting, writeSetting } = useTheme();
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [emergencyVisible, setEmergencyVisible] = useState(false);
  const [overdue, setOverdue] = useState(0);
  const [silent, setSilent] = useState(false);

  const load = useCallback(() => {
    setCategories(listCategories());
    setTasks(listTasks({ status: showCompleted ? undefined : 'pending', category, search: search.trim() || undefined }));
    setOverdue(overdueCount());
    setSilent(isSilentNow());
  }, [category, search, showCompleted]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pulse = useSharedValue(1);
  useEffect(() => {
    if (overdue > 0) {
      pulse.value = withRepeat(withSequence(withTiming(1.18, { duration: 600 }), withTiming(1, { duration: 600 })), -1, false);
    } else {
      pulse.value = 1;
    }
  }, [overdue]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const onRefresh = () => {
    setRefreshing(true);
    load();
    setTimeout(() => setRefreshing(false), 400);
  };

  const completeTask = (task) => {
    const { dependents } = setTaskStatus(task.id, 'completed');
    for (const c of dependents) notifyTaskUnlocked(task.name, c.name);
    load();
  };

  const confirmDelete = (task) => {
    Alert.alert('🗑️', t('deleteTaskConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => { deleteTask(task.id); load(); } },
    ]);
  };

  const longPressMenu = (task) => {
    Alert.alert(task.name, '', [
      { text: `📄 ${t('duplicate')}`, onPress: () => { duplicateTask(task.id); load(); } },
      {
        text: `📤 ${t('share')}`,
        onPress: () => Share.share({ message: `✅ ${task.name}\n${task.description || ''}\n— أتمم` }).catch(() => {}),
      },
      {
        text: `🔗 ${t('linkTask')}`,
        onPress: () => navigation.navigate('TaskForm', { taskId: task.id, focusLink: true }),
      },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  const submitQuickAdd = () => {
    if (!quickName.trim()) return;
    createTask({ name: quickName.trim(), priority: 'medium', encouragement_text: '' });
    setQuickName('');
    Keyboard.dismiss();
    load();
  };

  const catColor = (name) => {
    const c = categories.find((x) => x.name === name || x.name_en === name);
    return c ? c.color : null;
  };

  const toggleSilent = () => {
    writeSetting('silent_enabled', silent ? '0' : '1');
    setSilent(!silent);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, rtl && { flexDirection: 'row-reverse' }]}>
        <Text style={[styles.appName, { color: theme.text }]}>أتمم</Text>
        <View style={[styles.headerBtns, rtl && { flexDirection: 'row-reverse' }]}>
          <TouchableOpacity onPress={toggleSilent} style={[styles.headerBtn, { backgroundColor: theme.card }]}>
            <Text style={{ fontSize: 16 }}>{silent ? '🔕' : '🔔'}</Text>
          </TouchableOpacity>
          <Animated.View style={pulseStyle}>
            <TouchableOpacity onPress={() => setEmergencyVisible(true)} activeOpacity={0.85}>
              <LinearGradient colors={gradients.primary} style={styles.panicBtn}>
                <Text style={{ fontSize: 16 }}>🚨</Text>
                {overdue > 0 && (
                  <View style={styles.panicBadge}>
                    <Text style={styles.panicBadgeText}>{overdue}</Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>

      {/* Categories */}
      <CategoryChips categories={categories} selected={category} onSelect={setCategory} />

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchBox, { backgroundColor: theme.card, shadowColor: theme.shadow }, rtl && { flexDirection: 'row-reverse' }]}>
          <Text style={{ fontSize: 15, opacity: 0.6 }}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('searchTasks')}
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text, textAlign: rtl ? 'right' : 'left' }]}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: theme.textSecondary }}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Completed toggle */}
      <TouchableOpacity onPress={() => setShowCompleted((s) => !s)} style={{ paddingHorizontal: 18, paddingBottom: 2 }}>
        <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700', textAlign: rtl ? 'right' : 'left' }}>
          {showCompleted ? `👁 ${t('pending')}` : `✓ ${t('done')}`}
        </Text>
      </TouchableOpacity>

      {/* List */}
      <FlatList
        data={tasks}
        keyExtractor={(it) => String(it.id)}
        contentContainerStyle={{ paddingBottom: 130, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.textSecondary} />}
        ListEmptyComponent={
          search
            ? <EmptyState emoji="🔍" title={t('emptySearch')} />
            : <EmptyState emoji="🌱" title={t('noTasks')} hint={t('noTasksHint')} />
        }
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            lang={lang}
            categoryColor={catColor(item.category)}
            onPress={(task) => navigation.navigate('TaskForm', { taskId: task.id })}
            onComplete={completeTask}
            onEdit={(task) => navigation.navigate('TaskForm', { taskId: task.id })}
            onDelete={confirmDelete}
            onPostpone={(task) => { postponeTask(task.id, 1); load(); }}
            onLongAction={longPressMenu}
          />
        )}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => setQuickAddVisible(true)}>
        <LinearGradient colors={gradients.primary} style={styles.fabGrad}>
          <Text style={styles.fabPlus}>＋</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Quick add bottom sheet */}
      <Modal visible={quickAddVisible} transparent animationType="slide" onRequestClose={() => setQuickAddVisible(false)}>
        <TouchableOpacity style={[styles.sheetBackdrop, { backgroundColor: theme.overlay }]} activeOpacity={1} onPress={() => setQuickAddVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: theme.card }]} onPress={() => {}}>
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{t('quickAddTitle')}</Text>
            <View style={[styles.quickRow, rtl && { flexDirection: 'row-reverse' }]}>
              <TextInput
                autoFocus
                value={quickName}
                onChangeText={setQuickName}
                onSubmitEditing={submitQuickAdd}
                placeholder={t('taskNamePlaceholder')}
                placeholderTextColor={theme.textSecondary}
                style={[styles.quickInput, { backgroundColor: theme.inputBg, color: theme.text, textAlign: rtl ? 'right' : 'left' }]}
                returnKeyType="done"
              />
              <GradientButton title={t('add')} small onPress={submitQuickAdd} />
            </View>
            <View style={{ height: 10 }} />
            <GradientButton
              title={t('fullAdd')}
              outline
              colors={gradients.secondary}
              onPress={() => {
                setQuickAddVisible(false);
                navigation.navigate('TaskForm', { presetName: quickName });
              }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <EmergencyMode
        visible={emergencyVisible}
        onClose={() => { setEmergencyVisible(false); load(); }}
        onChanged={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 56, paddingBottom: 4,
  },
  appName: { fontSize: 26, fontWeight: '900' },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  panicBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  panicBadge: {
    position: 'absolute', top: -4, right: -4, backgroundColor: '#fff',
    minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  panicBadgeText: { color: '#FF6B6B', fontSize: 11, fontWeight: '900' },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11,
    shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  fab: { position: 'absolute', bottom: 26, right: 22, borderRadius: 32, overflow: 'hidden', elevation: 8 },
  fabGrad: {
    width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF6B6B', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
  },
  fabPlus: { color: '#fff', fontSize: 30, fontWeight: '300', marginTop: -2 },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: 34 },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: 14 },
  sheetTitle: { fontSize: 17, fontWeight: '800', marginBottom: 14, textAlign: 'center' },
  quickRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quickInput: { flex: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
});
