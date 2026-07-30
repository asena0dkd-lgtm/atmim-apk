import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet,
  Modal, Alert, KeyboardAvoidingView, Platform, Image, PanResponder, Share,
} from 'react-native';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import Svg, { Polyline } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import {
  getNote, saveNote, getAttachments, addAttachment, deleteAttachment,
  getNoteTables, createNoteTable, updateNoteTable, listTasks, getTask,
  getSetting, setSetting,
} from '../db/database';
import { NOTE_COLORS } from '../utils/helpers';
import GradientButton from '../components/GradientButton';

const HIGHLIGHTS = ['#FFD93D', '#FF8E8E', '#4ECDC4', '#6BC5D2', '#FFB347'];

// ---------- content helpers (JSON: { text, strokes, waypoints }) ----------
function parseContent(raw) {
  try {
    const p = JSON.parse(raw);
    return { text: p.text || '', strokes: p.strokes || [], waypoints: p.waypoints || [] };
  } catch (e) {
    return { text: raw || '', strokes: [], waypoints: [] };
  }
}

function toMarkdown(text) {
  return text;
}

function toHtml(text) {
  let h = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/(^|\s)_(.+?)_(?=\s|$)/g, '$1<i>$2</i>')
    .replace(/\{h(#[0-9A-Fa-f]{6})\|(.+?)\}/g, '<span style="background:$1">$2</span>')
    .replace(/\{(#[0-9A-Fa-f]{6})\|(.+?)\}/g, '<span style="color:$1">$2</span>')
    .replace(/- \[x\] (.+)/g, '☑ $1')
    .replace(/- \[ \] (.+)/g, '☐ $1')
    .replace(/\[\[(img|audio|table|task):(\d+)\]\]/g, '[$1 #$2]')
    .replace(/\n/g, '<br/>');
  return `<html dir="rtl"><body style="font-family:sans-serif">${h}</body></html>`;
}

export default function NoteEditorScreen({ navigation, route }) {
  const { theme, gradients, t, rtl, lang } = useTheme();
  const { noteId } = route.params || {};

  const [id, setId] = useState(noteId || null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [color, setColor] = useState(NOTE_COLORS[3]);
  const [strokes, setStrokes] = useState([]);
  const [waypoints, setWaypoints] = useState([]);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [attachments, setAttachments] = useState([]);
  const [tables, setTables] = useState([]);
  const [drawing, setDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#FF6B6B');
  const [currentStroke, setCurrentStroke] = useState(null);
  const [recording, setRecording] = useState(null);
  const [recSeconds, setRecSeconds] = useState(0);
  const [playingId, setPlayingId] = useState(null);
  const [customButtons, setCustomButtons] = useState([]);
  const soundRef = useRef(null);
  const inputRef = useRef(null);
  const recTimerRef = useRef(null);

  // modals
  const [modal, setModal] = useState(null); // 'color' | 'highlight' | 'table' | 'search' | 'replace' | 'export' | 'waypoint' | 'link' | 'customBtn' | 'image'
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [replaceWith, setReplaceWith] = useState('');
  const [tableDims, setTableDims] = useState({ rows: '3', cols: '3' });
  const [customBtnText, setCustomBtnText] = useState('');
  const [viewImage, setViewImage] = useState(null);
  const [allTasks, setAllTasks] = useState([]);
  const [savedFlash, setSavedFlash] = useState(false);

  // ---- load ----
  useEffect(() => {
    setCustomButtons(JSON.parse(getSetting('note_toolbar_buttons', '[]')));
    setAllTasks(listTasks({ status: 'pending' }));
    if (noteId) {
      const n = getNote(noteId);
      if (n) {
        const c = parseContent(n.content);
        setTitle(n.title || '');
        setText(c.text);
        setStrokes(c.strokes);
        setWaypoints(c.waypoints);
        setColor(n.color || NOTE_COLORS[3]);
        setAttachments(getAttachments(noteId));
        setTables(getNoteTables(noteId).map((tb) => ({ ...tb, data: JSON.parse(tb.data) })));
      }
    }
  }, [noteId]);

  // ---- persist ----
  const persist = (overrides = {}) => {
    const payload = {
      id: overrides.id !== undefined ? overrides.id : id,
      title: overrides.title !== undefined ? overrides.title : title,
      content: JSON.stringify({
        text: overrides.text !== undefined ? overrides.text : text,
        strokes: overrides.strokes !== undefined ? overrides.strokes : strokes,
        waypoints: overrides.waypoints !== undefined ? overrides.waypoints : waypoints,
      }),
      color: overrides.color !== undefined ? overrides.color : color,
    };
    const savedId = saveNote(payload);
    if (!id) setId(savedId);
    return savedId;
  };

  const ensureId = () => persist();

  const flashSaved = () => {
    persist();
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  };

  // ---- text manipulation ----
  const wrapSelection = (prefix, suffix = prefix) => {
    const { start, end } = selection;
    const sel = text.slice(start, end);
    const next = text.slice(0, start) + prefix + sel + suffix + text.slice(end);
    setText(next);
  };

  const insertAtCursor = (snippet) => {
    const { start } = selection;
    const next = text.slice(0, start) + snippet + text.slice(start);
    setText(next);
  };

  const toggleCheckbox = () => {
    const { start } = selection;
    const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const lineEnd = text.indexOf('\n', start);
    const line = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    let newLine;
    if (line.startsWith('- [ ] ')) newLine = '- [x] ' + line.slice(6);
    else if (line.startsWith('- [x] ')) newLine = line.slice(6);
    else newLine = '- [ ] ' + line;
    setText(text.slice(0, lineStart) + newLine + (lineEnd === -1 ? '' : text.slice(lineEnd)));
  };

  const applyColor = (kind, hex) => {
    const { start, end } = selection;
    const sel = text.slice(start, end) || (lang === 'ar' ? 'نص' : 'text');
    const token = kind === 'highlight' ? `{h${hex}|${sel}}` : `{${hex}|${sel}}`;
    setText(text.slice(0, start) + token + text.slice(end));
    setModal(null);
  };

  // ---- attachments ----
  const insertImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const nid = ensureId();
    const src = result.assets[0].uri;
    const dest = `${FileSystem.documentDirectory}note_img_${Date.now()}.jpg`;
    try { await FileSystem.copyAsync({ from: src, to: dest }); } catch (e) { /* keep src */ }
    const attId = addAttachment(nid, 'image', dest.startsWith('file') ? dest : src, selection.start);
    setAttachments(getAttachments(nid));
    insertAtCursor(`[[img:${attId}]]`);
  };

  const startRecording = async () => {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) return;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    setRecording(rec);
    setRecSeconds(0);
    recTimerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
  };

  const stopRecording = async () => {
    if (!recording) return;
    clearInterval(recTimerRef.current);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    if (!uri) return;
    const nid = ensureId();
    const dest = `${FileSystem.documentDirectory}note_audio_${Date.now()}.m4a`;
    try { await FileSystem.copyAsync({ from: uri, to: dest }); } catch (e) { /* keep uri */ }
    const attId = addAttachment(nid, 'audio', dest.startsWith('file') ? dest : uri, selection.start);
    setAttachments(getAttachments(nid));
    insertAtCursor(`[[audio:${attId}]]`);
  };

  const togglePlay = async (att) => {
    if (playingId === att.id) {
      if (soundRef.current) await soundRef.current.stopAsync();
      setPlayingId(null);
      return;
    }
    if (soundRef.current) await soundRef.current.unloadAsync();
    const { sound } = await Audio.Sound.createAsync({ uri: att.path });
    soundRef.current = sound;
    setPlayingId(att.id);
    sound.setOnPlaybackStatusUpdate((s) => { if (s.didJustFinish) setPlayingId(null); });
    await sound.playAsync();
  };

  const removeAttachment = (att) => {
    Alert.alert('🗑️', '', [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: () => {
          deleteAttachment(att.id);
          const nid = id || noteId;
          setAttachments(getAttachments(nid));
          setText(text.replace(`[[${att.type === 'image' ? 'img' : 'audio'}:${att.id}]]`, ''));
        },
      },
    ]);
  };

  // ---- tables ----
  const insertTable = () => {
    const rows = Math.max(1, Math.min(10, parseInt(tableDims.rows, 10) || 3));
    const cols = Math.max(1, Math.min(6, parseInt(tableDims.cols, 10) || 3));
    const nid = ensureId();
    const tid = createNoteTable(nid, rows, cols);
    const fresh = getNoteTables(nid).map((tb) => ({ ...tb, data: JSON.parse(tb.data) }));
    setTables(fresh);
    insertAtCursor(`[[table:${tid}]]`);
    setModal(null);
  };

  const editCell = (tableId, r, c, val) => {
    setTables((prev) =>
      prev.map((tb) => {
        if (tb.id !== tableId) return tb;
        const data = tb.data.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? val : cell)));
        updateNoteTable(tableId, data);
        return { ...tb, data };
      })
    );
  };

  // ---- drawing ----
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => drawing,
        onMoveShouldSetPanResponder: () => drawing,
        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          setCurrentStroke({ color: penColor, points: [[locationX, locationY]] });
        },
        onPanResponderMove: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          setCurrentStroke((s) => (s ? { ...s, points: [...s.points, [locationX, locationY]] } : s));
        },
        onPanResponderRelease: () => {
          setCurrentStroke((s) => {
            if (s && s.points.length > 1) {
              const next = [...strokes, s];
              setStrokes(next);
              persist({ strokes: next });
            }
            return null;
          });
        },
      }),
    [drawing, penColor, strokes, text, title, color]
  );

  // ---- search & replace ----
  const matches = useMemo(() => {
    if (!searchQuery) return [];
    const out = [];
    let idx = text.indexOf(searchQuery);
    while (idx !== -1 && out.length < 50) {
      const before = text.slice(Math.max(0, idx - 20), idx).split(/\s+/).slice(-2).join(' ');
      const after = text.slice(idx + searchQuery.length, idx + searchQuery.length + 20).split(/\s+/).slice(0, 2).join(' ');
      out.push({ index: idx, before, after });
      idx = text.indexOf(searchQuery, idx + 1);
    }
    return out;
  }, [searchQuery, text]);

  const replaceOne = () => {
    if (!replaceQuery) return;
    const i = text.indexOf(replaceQuery);
    if (i !== -1) setText(text.slice(0, i) + replaceWith + text.slice(i + replaceQuery.length));
  };

  const replaceAll = () => {
    if (!replaceQuery) return;
    setText(text.split(replaceQuery).join(replaceWith));
  };

  // ---- waypoints ----
  const addWaypoint = () => {
    const name = `📍 ${waypoints.length + 1}`;
    const next = [...waypoints, { name, index: selection.start }];
    setWaypoints(next);
    persist({ waypoints: next });
    setModal(null);
  };

  const jumpTo = (index) => {
    setSelection({ start: index, end: index });
    inputRef.current?.focus();
    setModal(null);
  };

  // ---- custom toolbar buttons ----
  const addCustomButton = () => {
    if (!customBtnText.trim()) return;
    const next = [...customButtons, customBtnText.trim()];
    setCustomButtons(next);
    setSetting('note_toolbar_buttons', JSON.stringify(next));
    setCustomBtnText('');
    setModal(null);
  };

  // ---- export ----
  const doExport = async (kind) => {
    setModal(null);
    const full = `${title}\n\n${text}`;
    if (kind === 'copy') {
      await Clipboard.setStringAsync(toMarkdown(full));
      return;
    }
    let content = full;
    let ext = 'txt';
    let mime = 'text/plain';
    if (kind === 'markdown') { content = toMarkdown(full); ext = 'md'; }
    if (kind === 'html') { content = toHtml(full); ext = 'html'; mime = 'text/html'; }
    const path = `${FileSystem.cacheDirectory}note_${id || 'new'}.${ext}`;
    await FileSystem.writeAsStringAsync(path, content);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: mime });
  };

  const linkTask = (task) => {
    insertAtCursor(`[[task:${task.id}]]`);
    setModal(null);
  };

  const taskCards = useMemo(() => {
    const ids = [...text.matchAll(/\[\[task:(\d+)\]\]/g)].map((m) => Number(m[1]));
    return ids.map(getTask).filter(Boolean);
  }, [text]);

  const ToolBtn = ({ label, onPress, onLongPress, active }) => (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={onLongPress ? 400 : undefined}
      style={[styles.toolBtn, { backgroundColor: active ? gradients.primary[0] + '33' : theme.cardAlt }]}
    >
      <Text style={[styles.toolLabel, { color: theme.text }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* header */}
      <View style={[styles.header, rtl && { flexDirection: 'row-reverse' }]}>
        <TouchableOpacity onPress={() => { persist(); navigation.goBack(); }}>
          <Text style={{ color: theme.text, fontSize: 20 }}>‹</Text>
        </TouchableOpacity>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 6 }}>
          {NOTE_COLORS.map((c) => (
            <TouchableOpacity key={c} onPress={() => setColor(c)}
              style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotActive]} />
          ))}
        </ScrollView>
        <TouchableOpacity onPress={flashSaved}>
          <Text style={{ color: savedFlash ? gradients.secondary[0] : theme.textSecondary, fontWeight: '800' }}>
            {savedFlash ? t('saved') : t('save')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" scrollEnabled={!drawing}>
        <View style={{ paddingHorizontal: 18 }}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('noteTitle')}
            placeholderTextColor={theme.textSecondary}
            style={[styles.titleInput, { color: theme.text, textAlign: rtl ? 'right' : 'left' }]}
            onBlur={() => persist()}
          />
        </View>

        {/* editor + drawing layer */}
        <View style={{ flex: 1 }} {...panResponder.panHandlers}>
          {drawing ? (
            <View style={[styles.drawCanvas, { backgroundColor: theme.card }]}>
              <Svg style={StyleSheet.absoluteFill}>
                {strokes.map((s, i) => (
                  <Polyline key={i} points={s.points.map((p) => p.join(',')).join(' ')} fill="none" stroke={s.color} strokeWidth={3} strokeLinecap="round" />
                ))}
                {currentStroke ? (
                  <Polyline points={currentStroke.points.map((p) => p.join(',')).join(' ')} fill="none" stroke={currentStroke.color} strokeWidth={3} strokeLinecap="round" />
                ) : null}
              </Svg>
              <View style={styles.penRow}>
                {HIGHLIGHTS.map((c) => (
                  <TouchableOpacity key={c} onPress={() => setPenColor(c)}
                    style={[styles.colorDot, { backgroundColor: c }, penColor === c && styles.colorDotActive]} />
                ))}
                <TouchableOpacity onPress={() => { setStrokes([]); persist({ strokes: [] }); }}>
                  <Text style={{ color: '#FF6B6B', fontWeight: '800' }}>🧹</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={setText}
              onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
              placeholder={t('startWriting')}
              placeholderTextColor={theme.textSecondary}
              multiline
              style={[styles.bodyInput, { color: theme.text, textAlign: rtl ? 'right' : 'left', writingDirection: rtl ? 'rtl' : 'ltr' }]}
              onBlur={() => persist()}
            />
          )}
        </View>

        {/* attachments strip */}
        {attachments.length > 0 || tables.length > 0 || taskCards.length > 0 ? (
          <View style={{ paddingHorizontal: 18, paddingBottom: 12, gap: 10 }}>
            {taskCards.map((task) => (
              <View key={`task-${task.id}`} style={[styles.linkedTask, { backgroundColor: theme.card }]}>
                <Text style={{ color: theme.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>✅ {task.name}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 11 }}>{t(`status_${task.status}`) !== `status_${task.status}` ? '' : t(task.status === 'completed' ? 'done' : task.status)}</Text>
              </View>
            ))}
            {tables.map((tb) => (
              <View key={`tbl-${tb.id}`} style={[styles.tableCard, { backgroundColor: theme.card }]}>
                {tb.data.map((row, r) => (
                  <View key={r} style={{ flexDirection: 'row' }}>
                    {row.map((cell, c) => (
                      <TextInput
                        key={c}
                        value={cell}
                        onChangeText={(v) => editCell(tb.id, r, c, v)}
                        style={[styles.cell, { borderColor: theme.border, color: theme.text }]}
                      />
                    ))}
                  </View>
                ))}
              </View>
            ))}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, flexDirection: 'row' }}>
              {attachments.map((att) =>
                att.type === 'image' ? (
                  <TouchableOpacity key={att.id} onPress={() => setViewImage(att.path)} onLongPress={() => removeAttachment(att)}>
                    <Image source={{ uri: att.path }} style={styles.thumb} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    key={att.id}
                    onPress={() => togglePlay(att)}
                    onLongPress={() => removeAttachment(att)}
                    style={[styles.audioChip, { backgroundColor: theme.card }]}
                  >
                    <Text style={{ fontSize: 16 }}>{playingId === att.id ? '⏸' : '▶️'}</Text>
                    {/* fake waveform */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      {[6, 12, 8, 14, 9, 12, 5].map((h, i) => (
                        <View key={i} style={{ width: 3, height: h, borderRadius: 2, backgroundColor: playingId === att.id ? gradients.primary[0] : theme.textSecondary }} />
                      ))}
                    </View>
                  </TouchableOpacity>
                )
              )}
            </ScrollView>
          </View>
        ) : null}
        <View style={{ height: 12 }} />
      </ScrollView>

      {/* recording indicator */}
      {recording ? (
        <View style={[styles.recBar, { backgroundColor: '#FF6B6B22' }]}>
          <View style={styles.recDot} />
          <Text style={{ color: '#FF6B6B', fontWeight: '800' }}>{t('recording')} {recSeconds}s</Text>
        </View>
      ) : null}

      {/* toolbar */}
      <View style={[styles.toolbar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always"
          contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingHorizontal: 10, alignItems: 'center' }}>
          <ToolBtn label="B" onPress={() => wrapSelection('**')} />
          <ToolBtn label="I" onPress={() => wrapSelection('_')} />
          <ToolBtn label="U" onPress={() => wrapSelection('__')} />
          <ToolBtn label="S̶" onPress={() => wrapSelection('~~')} />
          <ToolBtn label="🎨" onPress={() => setModal('color')} />
          <ToolBtn label="🖍" onPress={() => setModal('highlight')} />
          <ToolBtn label="☑" onPress={toggleCheckbox} />
          <ToolBtn label="🖼" onPress={insertImage} />
          <ToolBtn label={recording ? '⏹' : '🎙'} onLongPress={startRecording} onPress={recording ? stopRecording : undefined} active={!!recording} />
          <ToolBtn label="⊞" onPress={() => setModal('table')} />
          <ToolBtn label="✏️" onPress={() => setDrawing((d) => !d)} active={drawing} />
          <ToolBtn label="🔍" onPress={() => setModal('search')} />
          <ToolBtn label="⇄" onPress={() => setModal('replace')} />
          <ToolBtn label="📍" onPress={() => setModal('waypoint')} />
          <ToolBtn label="🔗" onPress={() => setModal('link')} />
          <ToolBtn label="📤" onPress={() => setModal('export')} />
          {customButtons.map((b, i) => (
            <ToolBtn key={i} label={b} onPress={() => insertAtCursor(b)} />
          ))}
          <ToolBtn label="＋" onPress={() => setModal('customBtn')} />
        </ScrollView>
      </View>

      {/* ---- modals ---- */}
      <EditorModal visible={modal === 'color' || modal === 'highlight'} onClose={() => setModal(null)} theme={theme} title="🎨">
        <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', paddingVertical: 10 }}>
          {(modal === 'highlight' ? HIGHLIGHTS : NOTE_COLORS.concat(['#FFFFFF'])).map((c) => (
            <TouchableOpacity key={c} onPress={() => applyColor(modal, c)}
              style={[styles.colorDot, { backgroundColor: c, width: 36, height: 36, borderRadius: 18 }]} />
          ))}
        </View>
      </EditorModal>

      <EditorModal visible={modal === 'table'} onClose={() => setModal(null)} theme={theme} title={`⊞ ${t('insertTable')}`}>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          <Field label={t('rows')} value={tableDims.rows} onChange={(v) => setTableDims((d) => ({ ...d, rows: v }))} theme={theme} />
          <Field label={t('cols')} value={tableDims.cols} onChange={(v) => setTableDims((d) => ({ ...d, cols: v }))} theme={theme} />
        </View>
        <GradientButton title={t('insert')} onPress={insertTable} />
      </EditorModal>

      <EditorModal visible={modal === 'search'} onClose={() => setModal(null)} theme={theme} title={`🔍 ${t('searchInNote')}`}>
        <TextInput
          value={searchQuery} onChangeText={setSearchQuery} placeholder={t('find')}
          placeholderTextColor={theme.textSecondary} autoFocus
          style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text }]}
        />
        <ScrollView style={{ maxHeight: 260, marginTop: 10 }}>
          {searchQuery && matches.length === 0 ? (
            <Text style={{ color: theme.textSecondary, textAlign: 'center', padding: 14 }}>{t('noResults')}</Text>
          ) : null}
          {matches.map((m, i) => (
            <TouchableOpacity key={i} onPress={() => jumpTo(m.index)} style={[styles.matchRow, { borderColor: theme.border }]}>
              <Text style={{ color: theme.textSecondary, flex: 1 }} numberOfLines={1}>
                …{m.before} <Text style={{ color: gradients.primary[0], fontWeight: '900' }}>{searchQuery}</Text> {m.after}…
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </EditorModal>

      <EditorModal visible={modal === 'replace'} onClose={() => setModal(null)} theme={theme} title={`⇄ ${t('findReplace')}`}>
        <TextInput value={replaceQuery} onChangeText={setReplaceQuery} placeholder={t('find')}
          placeholderTextColor={theme.textSecondary} style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text }]} />
        <TextInput value={replaceWith} onChangeText={setReplaceWith} placeholder={t('replaceWith')}
          placeholderTextColor={theme.textSecondary} style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text, marginTop: 8 }]} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <GradientButton title={t('replaceOne')} small outline onPress={replaceOne} style={{ flex: 1 }} />
          <GradientButton title={t('replaceAll')} small onPress={replaceAll} style={{ flex: 1 }} />
        </View>
      </EditorModal>

      <EditorModal visible={modal === 'export'} onClose={() => setModal(null)} theme={theme} title={`📤 ${t('export')}`}>
        {['markdown', 'html', 'txt', 'copy'].map((k) => (
          <TouchableOpacity key={k} onPress={() => doExport(k)} style={[styles.exportRow, { borderColor: theme.border }]}>
            <Text style={{ color: theme.text, fontWeight: '700' }}>{t(k)}</Text>
          </TouchableOpacity>
        ))}
      </EditorModal>

      <EditorModal visible={modal === 'waypoint'} onClose={() => setModal(null)} theme={theme} title={`📍 ${t('waypoint')}`}>
        <GradientButton title={`＋ ${t('addWaypoint')}`} small onPress={addWaypoint} />
        <View style={{ marginTop: 12, gap: 6 }}>
          {waypoints.map((w, i) => (
            <TouchableOpacity key={i} onPress={() => jumpTo(w.index)} style={[styles.exportRow, { borderColor: theme.border }]}>
              <Text style={{ color: theme.text, fontWeight: '700' }}>{w.name} — @{w.index}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </EditorModal>

      <EditorModal visible={modal === 'link'} onClose={() => setModal(null)} theme={theme} title={`🔗 ${t('linkToTask')}`}>
        <ScrollView style={{ maxHeight: 300 }}>
          {allTasks.map((task) => (
            <TouchableOpacity key={task.id} onPress={() => linkTask(task)} style={[styles.exportRow, { borderColor: theme.border }]}>
              <Text style={{ color: theme.text, fontWeight: '700' }}>{task.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </EditorModal>

      <EditorModal visible={modal === 'customBtn'} onClose={() => setModal(null)} theme={theme} title={`＋ ${t('customButton')}`}>
        <TextInput value={customBtnText} onChangeText={setCustomBtnText} placeholder={t('customButtonHint')}
          placeholderTextColor={theme.textSecondary} autoFocus
          style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text }]} />
        <View style={{ height: 12 }} />
        <GradientButton title={t('add')} small onPress={addCustomButton} />
      </EditorModal>

      {/* full image viewer */}
      <Modal visible={!!viewImage} transparent animationType="fade" onRequestClose={() => setViewImage(null)}>
        <TouchableOpacity style={styles.imageViewer} activeOpacity={1} onPress={() => setViewImage(null)}>
          {viewImage ? <Image source={{ uri: viewImage }} style={styles.fullImage} resizeMode="contain" /> : null}
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function EditorModal({ visible, onClose, theme, title, children }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={[styles.modalBg, { backgroundColor: theme.overlay }]} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.modalCard, { backgroundColor: theme.card }]} onPress={() => {}}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>{title}</Text>
          {children}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function Field({ label, value, onChange, theme }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChange} keyboardType="number-pad"
        style={[styles.modalInput, { backgroundColor: theme.inputBg, color: theme.text, textAlign: 'center' }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 10 },
  colorDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'transparent' },
  colorDotActive: { borderColor: '#fff', transform: [{ scale: 1.15 }] },
  titleInput: { fontSize: 22, fontWeight: '900', marginBottom: 8 },
  bodyInput: { fontSize: 15, lineHeight: 24, paddingHorizontal: 18, minHeight: 300, textAlignVertical: 'top' },
  drawCanvas: { height: 380, marginHorizontal: 14, borderRadius: 16, overflow: 'hidden' },
  penRow: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 10 },
  toolbar: { borderTopWidth: 1, paddingVertical: 8 },
  toolBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  toolLabel: { fontWeight: '800', fontSize: 14 },
  recBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, justifyContent: 'center' },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF6B6B' },
  linkedTask: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12 },
  tableCard: { borderRadius: 12, padding: 8 },
  cell: { flex: 1, borderWidth: 1, padding: 6, fontSize: 12, minWidth: 70 },
  thumb: { width: 74, height: 74, borderRadius: 12 },
  audioChip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12 },
  modalBg: { flex: 1, justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 34, maxHeight: '80%' },
  modalTitle: { fontSize: 16, fontWeight: '900', textAlign: 'center', marginBottom: 14 },
  modalInput: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14 },
  matchRow: { paddingVertical: 11, borderBottomWidth: 1 },
  exportRow: { paddingVertical: 13, borderBottomWidth: 1 },
  imageViewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  fullImage: { width: '92%', height: '80%' },
});
