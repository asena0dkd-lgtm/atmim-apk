// SQLite data layer for أتمم — all local, no backend.
import * as SQLite from 'expo-sqlite';
import { seedCategories } from '../theme/colors';

let db = null;

export function getDB() {
  if (!db) {
    db = SQLite.openDatabaseSync('atmm.db');
    initSchema(db);
  }
  return db;
}

function initSchema(database) {
  database.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      priority TEXT DEFAULT 'medium',
      due_date TEXT,
      repeat_type TEXT DEFAULT 'none',
      repeat_interval INTEGER DEFAULT 1,
      pomodoro_duration INTEGER DEFAULT 0,
      pomodoro_active INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      parent_task_id INTEGER,
      trigger_type TEXT,
      attachment_path TEXT,
      encouragement_text TEXT,
      created_at TEXT,
      updated_at TEXT,
      completion_count INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      content TEXT,
      color TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS note_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER,
      type TEXT,
      path TEXT,
      position_in_text INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS note_tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER,
      rows INTEGER,
      cols INTEGER,
      data TEXT
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      name_en TEXT,
      color TEXT,
      icon TEXT
    );
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      task_data TEXT,
      usage_count INTEGER DEFAULT 0,
      last_used TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS activity_log (
      date TEXT PRIMARY KEY,
      tasks_completed INTEGER DEFAULT 0,
      tasks_created INTEGER DEFAULT 0,
      pomodoro_minutes INTEGER DEFAULT 0,
      streak_count INTEGER DEFAULT 0
    );
  `);

  const catCount = database.getFirstSync('SELECT COUNT(*) AS n FROM categories');
  if (catCount.n === 0) {
    for (const c of seedCategories) {
      database.runSync(
        'INSERT INTO categories (name, name_en, color, icon) VALUES (?, ?, ?, ?)',
        [c.name_ar, c.name_en, c.color, c.icon]
      );
    }
  }

  const tplCount = database.getFirstSync('SELECT COUNT(*) AS n FROM templates');
  if (tplCount.n === 0) {
    const seeds = [
      { name: 'جلسة مذاكرة | Study session', task_data: { category: 'دراسة', priority: 'high', pomodoro_active: 1, pomodoro_duration: 50, description: '' } },
      { name: 'تمرين رياضة | Gym workout', task_data: { category: 'صحة', priority: 'medium', pomodoro_active: 1, pomodoro_duration: 60, description: '' } },
      { name: 'شرب ماء | Drink water', task_data: { category: 'صحة', priority: 'low', repeat_type: 'daily', pomodoro_active: 0, pomodoro_duration: 0, description: '' } },
      { name: 'نوم مبكر | Sleep early', task_data: { category: 'صحة', priority: 'medium', repeat_type: 'daily', pomodoro_active: 0, pomodoro_duration: 0, description: '' } },
      { name: 'اجتماع | Meeting', task_data: { category: 'عمل', priority: 'high', pomodoro_active: 0, pomodoro_duration: 0, description: '' } },
    ];
    for (const t of seeds) {
      database.runSync(
        'INSERT INTO templates (name, task_data, usage_count, last_used) VALUES (?, ?, 0, NULL)',
        [t.name, JSON.stringify(t.task_data)]
      );
    }
  }
}

const now = () => new Date().toISOString();
export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ---------- Tasks ----------
export function listTasks({ status, category, search, overdueOnly, futureOnly } = {}) {
  const where = [];
  const args = [];
  if (status) { where.push('status = ?'); args.push(status); }
  if (category && category !== 'all') { where.push('category = ?'); args.push(category); }
  if (search) { where.push('(name LIKE ? OR description LIKE ?)'); args.push(`%${search}%`, `%${search}%`); }
  if (overdueOnly) {
    where.push("status = 'pending' AND due_date IS NOT NULL AND due_date < ?");
    args.push(now());
  }
  if (futureOnly) {
    where.push('due_date >= ?');
    args.push(now());
  }
  const sql = `SELECT * FROM tasks ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC, created_at DESC`;
  return getDB().getAllSync(sql, args);
}

export function getTask(id) {
  return getDB().getFirstSync('SELECT * FROM tasks WHERE id = ?', [id]);
}

export function createTask(data) {
  const t = now();
  const res = getDB().runSync(
    `INSERT INTO tasks (name, description, category, priority, due_date, repeat_type, repeat_interval,
      pomodoro_duration, pomodoro_active, status, parent_task_id, trigger_type, attachment_path,
      encouragement_text, created_at, updated_at, completion_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name || '', data.description || '', data.category || null, data.priority || 'medium',
      data.due_date || null, data.repeat_type || 'none', data.repeat_interval ?? 1,
      data.pomodoro_duration || 0, data.pomodoro_active ? 1 : 0, data.status || 'pending',
      data.parent_task_id || null, data.trigger_type || null, data.attachment_path || null,
      data.encouragement_text || '', t, t, 0,
    ]
  );
  const dueDay = data.due_date ? data.due_date.slice(0, 10) : null;
  bumpActivity('tasks_created', 1);
  if (dueDay && dueDay !== todayKey()) bumpActivity('tasks_created', 1, dueDay);
  return res.lastInsertRowId;
}

export function updateTask(id, data) {
  const fields = [];
  const args = [];
  const allowed = ['name', 'description', 'category', 'priority', 'due_date', 'repeat_type',
    'repeat_interval', 'pomodoro_duration', 'pomodoro_active', 'status', 'parent_task_id',
    'trigger_type', 'attachment_path', 'encouragement_text', 'completion_count'];
  for (const k of allowed) {
    if (data[k] !== undefined) {
      fields.push(`${k} = ?`);
      args.push(k === 'pomodoro_active' ? (data[k] ? 1 : 0) : data[k]);
    }
  }
  if (!fields.length) return;
  fields.push('updated_at = ?');
  args.push(now(), id);
  getDB().runSync(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, args);
}

export function deleteTask(id) {
  getDB().runSync('DELETE FROM tasks WHERE id = ?', [id]);
}

export function duplicateTask(id) {
  const t = getTask(id);
  if (!t) return null;
  return createTask({ ...t, id: undefined, name: t.name + ' (2)', status: 'pending', completion_count: 0 });
}

function advanceDueDate(iso, type, interval) {
  if (!iso) return null;
  const d = new Date(iso);
  const n = Math.max(1, interval || 1);
  if (type === 'daily') d.setDate(d.getDate() + n);
  else if (type === 'weekly') d.setDate(d.getDate() + 7 * n);
  else if (type === 'monthly') d.setMonth(d.getMonth() + n);
  else if (type === 'custom') {
    // repeat_interval is a 7-bit day mask (bit 0 = Sunday)
    const mask = n;
    for (let i = 1; i <= 7; i++) {
      const cand = new Date(d);
      cand.setDate(d.getDate() + i);
      if (mask & (1 << cand.getDay())) return cand.toISOString();
    }
    d.setDate(d.getDate() + 7);
  } else return null;
  return d.toISOString();
}

// Sets status; handles repeats, dependent triggers and activity logging.
// Returns { dependents: [tasks...] } fired by this change.
export function setTaskStatus(id, status) {
  const task = getTask(id);
  if (!task) return { dependents: [] };
  updateTask(id, { status });
  const dependents = [];

  if (status === 'completed') {
    getDB().runSync('UPDATE tasks SET completion_count = completion_count + 1 WHERE id = ?', [id]);
    bumpActivity('tasks_completed', 1);
    // repeat → spawn next occurrence
    if (task.repeat_type && task.repeat_type !== 'none') {
      const nextDue = advanceDueDate(task.due_date, task.repeat_type, task.repeat_interval);
      if (nextDue) {
        createTask({ ...task, id: undefined, due_date: nextDue, status: 'pending' });
      }
    }
  }
  // dependent tasks: fire children whose trigger matches this outcome
  const triggerMap = { completed: 'complete', failed: 'fail', cancelled: 'cancel' };
  const trigger = triggerMap[status];
  if (trigger) {
    const children = getDB().getAllSync(
      "SELECT * FROM tasks WHERE parent_task_id = ? AND trigger_type = ? AND status = 'pending'",
      [id, trigger]
    );
    for (const c of children) {
      dependents.push(c);
      if (!c.due_date) updateTask(c.id, { due_date: now() });
    }
  }
  return { dependents };
}

export function postponeTask(id, days = 1) {
  const t = getTask(id);
  if (!t) return;
  const base = t.due_date ? new Date(t.due_date) : new Date();
  base.setDate(base.getDate() + days);
  updateTask(id, { due_date: base.toISOString(), status: 'pending' });
}

export function overdueCount() {
  const r = getDB().getFirstSync(
    "SELECT COUNT(*) AS n FROM tasks WHERE status = 'pending' AND due_date IS NOT NULL AND due_date < ?",
    [now()]
  );
  return r.n;
}

// ---------- Notes ----------
export function listNotes(search) {
  if (search) {
    return getDB().getAllSync(
      'SELECT * FROM notes WHERE title LIKE ? OR content LIKE ? ORDER BY updated_at DESC',
      [`%${search}%`, `%${search}%`]
    );
  }
  return getDB().getAllSync('SELECT * FROM notes ORDER BY updated_at DESC');
}

export function getNote(id) {
  return getDB().getFirstSync('SELECT * FROM notes WHERE id = ?', [id]);
}

export function saveNote({ id, title, content, color }) {
  const t = now();
  if (id) {
    getDB().runSync(
      'UPDATE notes SET title = ?, content = ?, color = ?, updated_at = ? WHERE id = ?',
      [title, content, color, t, id]
    );
    return id;
  }
  const res = getDB().runSync(
    'INSERT INTO notes (title, content, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [title, content, color, t, t]
  );
  return res.lastInsertRowId;
}

export function deleteNote(id) {
  getDB().runSync('DELETE FROM notes WHERE id = ?', [id]);
  getDB().runSync('DELETE FROM note_attachments WHERE note_id = ?', [id]);
  getDB().runSync('DELETE FROM note_tables WHERE note_id = ?', [id]);
}

// ---------- Note attachments ----------
export function addAttachment(noteId, type, path, position = 0) {
  const res = getDB().runSync(
    'INSERT INTO note_attachments (note_id, type, path, position_in_text) VALUES (?, ?, ?, ?)',
    [noteId, type, path, position]
  );
  return res.lastInsertRowId;
}

export function getAttachments(noteId) {
  return getDB().getAllSync('SELECT * FROM note_attachments WHERE note_id = ?', [noteId]);
}

export function deleteAttachment(id) {
  getDB().runSync('DELETE FROM note_attachments WHERE id = ?', [id]);
}

// ---------- Note tables ----------
export function createNoteTable(noteId, rows, cols) {
  const data = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
  const res = getDB().runSync(
    'INSERT INTO note_tables (note_id, rows, cols, data) VALUES (?, ?, ?, ?)',
    [noteId, rows, cols, JSON.stringify(data)]
  );
  return res.lastInsertRowId;
}

export function getNoteTables(noteId) {
  return getDB().getAllSync('SELECT * FROM note_tables WHERE note_id = ?', [noteId]);
}

export function updateNoteTable(id, data) {
  getDB().runSync('UPDATE note_tables SET data = ? WHERE id = ?', [JSON.stringify(data), id]);
}

// ---------- Categories ----------
export function listCategories() {
  return getDB().getAllSync('SELECT * FROM categories ORDER BY id ASC');
}

export function addCategory(name, nameEn, color, icon) {
  const res = getDB().runSync(
    'INSERT INTO categories (name, name_en, color, icon) VALUES (?, ?, ?, ?)',
    [name, nameEn || name, color, icon || '🏷️']
  );
  return res.lastInsertRowId;
}

// ---------- Templates ----------
export function listTemplates() {
  return getDB().getAllSync('SELECT * FROM templates ORDER BY usage_count DESC, id ASC');
}

export function addTemplate(name, taskData) {
  const res = getDB().runSync(
    'INSERT INTO templates (name, task_data, usage_count, last_used) VALUES (?, ?, 0, NULL)',
    [name, JSON.stringify(taskData)]
  );
  return res.lastInsertRowId;
}

export function touchTemplate(id) {
  getDB().runSync('UPDATE templates SET usage_count = usage_count + 1, last_used = ? WHERE id = ?', [now(), id]);
}

export function deleteTemplate(id) {
  getDB().runSync('DELETE FROM templates WHERE id = ?', [id]);
}

// ---------- Settings ----------
export function getSetting(key, def = null) {
  const r = getDB().getFirstSync('SELECT value FROM settings WHERE key = ?', [key]);
  return r ? r.value : def;
}

export function setSetting(key, value) {
  getDB().runSync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, String(value)]
  );
}

export function allSettings() {
  const rows = getDB().getAllSync('SELECT key, value FROM settings');
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

// ---------- Activity log ----------
export function bumpActivity(field, amount = 1, date = todayKey()) {
  getDB().runSync(
    `INSERT INTO activity_log (date, ${field}) VALUES (?, ?)
     ON CONFLICT(date) DO UPDATE SET ${field} = ${field} + excluded.${field}`,
    [date, amount]
  );
}

export function getActivityRange(days = 84) {
  const from = new Date();
  from.setDate(from.getDate() - days + 1);
  return getDB().getAllSync(
    'SELECT * FROM activity_log WHERE date >= ? ORDER BY date ASC',
    [todayKey(from)]
  );
}

export function getActivityForDate(date) {
  return getDB().getFirstSync('SELECT * FROM activity_log WHERE date = ?', [date]);
}

export function getStreak() {
  let streak = 0;
  const d = new Date();
  // allow today not-yet-counted without breaking the chain
  const todayRow = getActivityForDate(todayKey(d));
  if (!todayRow || !todayRow.tasks_completed) d.setDate(d.getDate() - 1);
  while (true) {
    const row = getActivityForDate(todayKey(d));
    if (row && row.tasks_completed > 0) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

export function totalPoints() {
  const r = getDB().getFirstSync(
    'SELECT COALESCE(SUM(tasks_completed * 10 + pomodoro_minutes), 0) AS p FROM activity_log'
  );
  return r.p;
}

// ---------- Export / Import ----------
export function exportAll() {
  const tables = ['tasks', 'notes', 'note_attachments', 'note_tables', 'categories', 'templates', 'settings', 'activity_log'];
  const out = { app: 'atmm', version: 1, exported_at: now(), data: {} };
  for (const t of tables) out.data[t] = getDB().getAllSync(`SELECT * FROM ${t}`);
  return JSON.stringify(out, null, 2);
}

export function importAll(json) {
  const parsed = JSON.parse(json);
  if (!parsed || parsed.app !== 'atmm' || !parsed.data) throw new Error('invalid backup');
  const tables = ['tasks', 'notes', 'note_attachments', 'note_tables', 'categories', 'templates', 'settings', 'activity_log'];
  const database = getDB();
  database.execSync('BEGIN');
  try {
    for (const t of tables) {
      database.runSync(`DELETE FROM ${t}`);
      const rows = parsed.data[t] || [];
      for (const row of rows) {
        const keys = Object.keys(row);
        if (!keys.length) continue;
        const sql = `INSERT INTO ${t} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
        database.runSync(sql, keys.map((k) => row[k]));
      }
    }
    database.execSync('COMMIT');
  } catch (e) {
    database.execSync('ROLLBACK');
    throw e;
  }
}
