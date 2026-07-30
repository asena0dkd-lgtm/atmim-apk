import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { listNotes, deleteNote } from '../db/database';
import { truncate } from '../utils/helpers';
import EmptyState from '../components/EmptyState';
import GradientButton from '../components/GradientButton';

const { width } = Dimensions.get('window');
const CARD_W = (width - 16 * 2 - 12) / 2;

export default function NotesScreen({ navigation }) {
  const { theme, gradients, t, rtl, lang } = useTheme();
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setNotes(listNotes(search.trim() || undefined));
  }, [search]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const plainText = (content) => {
    try {
      const parsed = JSON.parse(content);
      return parsed.text || '';
    } catch (e) {
      return content || '';
    }
  };

  const confirmDelete = (note) => {
    Alert.alert('🗑️', t('deleteNoteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => { deleteNote(note.id); load(); } },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Text style={[styles.header, { color: theme.text, textAlign: rtl ? 'right' : 'left' }]}>{t('notes')}</Text>

      <View style={[styles.topRow, rtl && { flexDirection: 'row-reverse' }]}>
        <View style={[styles.searchBox, { backgroundColor: theme.card, shadowColor: theme.shadow }, rtl && { flexDirection: 'row-reverse' }]}>
          <Text style={{ opacity: 0.6 }}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('searchNotes')}
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text, textAlign: rtl ? 'right' : 'left' }]}
          />
        </View>
        <GradientButton
          title={`＋ ${t('newNote')}`}
          small
          onPress={() => navigation.navigate('NoteEditor', {})}
          style={{ borderRadius: 14 }}
        />
      </View>

      <FlatList
        data={notes}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        keyExtractor={(it) => String(it.id)}
        contentContainerStyle={{ paddingBottom: 130, flexGrow: 1, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); setTimeout(() => setRefreshing(false), 400); }} tintColor={theme.textSecondary} />}
        ListEmptyComponent={<EmptyState emoji="📝" title={t('noNotes')} hint={t('noNotesHint')} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('NoteEditor', { noteId: item.id })}
            onLongPress={() => confirmDelete(item)}
            style={[styles.card, { backgroundColor: theme.card, shadowColor: theme.shadow, width: CARD_W }]}
          >
            <View style={[styles.colorTag, { backgroundColor: item.color || '#B8B8D1' }]} />
            <Text style={[styles.cardTitle, { color: theme.text, textAlign: rtl ? 'right' : 'left' }]} numberOfLines={1}>
              {item.title || t('noteTitle')}
            </Text>
            <Text style={[styles.cardPreview, { color: theme.textSecondary, textAlign: rtl ? 'right' : 'left' }]} numberOfLines={3}>
              {truncate(plainText(item.content), 120)}
            </Text>
            <Text style={[styles.cardDate, { color: theme.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>
              {new Date(item.updated_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { fontSize: 26, fontWeight: '900', paddingHorizontal: 18, paddingTop: 56, paddingBottom: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 14 },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10,
    shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  card: {
    borderRadius: 16, padding: 14, minHeight: 130,
    shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  colorTag: { width: 34, height: 5, borderRadius: 3, marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 5 },
  cardPreview: { fontSize: 12, lineHeight: 18, flex: 1 },
  cardDate: { fontSize: 10, marginTop: 8, fontWeight: '600' },
});
