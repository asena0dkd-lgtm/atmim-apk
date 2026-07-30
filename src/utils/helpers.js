// Small shared helpers: dates, encouragement lines, silent-mode check.
import { getSetting } from '../db/database';

export function fmtTime(iso, lang = 'ar') {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDateLabel(iso, lang = 'ar', t) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const tom = new Date();
  tom.setDate(tom.getDate() + 1);
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return t ? t('today') : 'اليوم';
  if (sameDay(d, tom)) return t ? t('tomorrow') : 'غداً';
  return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' });
}

export function isOverdue(task) {
  return task.status === 'pending' && task.due_date && new Date(task.due_date) < new Date();
}

export function isDueToday(task) {
  if (!task.due_date) return false;
  const d = new Date(task.due_date);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export function isDueTomorrow(task) {
  if (!task.due_date) return false;
  const d = new Date(task.due_date);
  const n = new Date();
  n.setDate(n.getDate() + 1);
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export function formatDuration(totalSec) {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Auto encouragement / scolding lines per category (Arabic with a wink).
const ENCOURAGEMENT = {
  'عمل': ['يلا، الشغل ما بينتهي لحاله… بس إنت أسرع منه 💪', 'اجتماع؟ مهمة؟ إنت جاهز. كسّرها! 🔥'],
  'دراسة': ['صفحة ورا صفحة وبتوصل 📖', 'المذاكرة مو عدوّتك… المماطلة هي 😏'],
  'صحة': ['جسمك بيشكرك بعدين 🏃', 'رياضة اليوم = طاقة بكرة ⚡'],
  'شخصي': ['وقتك إلك، استثمره صح 🌟', 'خطوة صغيرة اليوم، فرق كبير بكرة'],
  'تسوق': ['اكتب اللي بدك إياه ولا تنسى 🛒', 'التسوق الذكي يبدأ بقائمة 🧾'],
  'أخرى': ['مهمة جديدة؟ يلا بينا 🚀', 'شويّة تركيز وبتخلص ✅'],
};

export function autoEncouragement(category) {
  const pool = ENCOURAGEMENT[category] || ENCOURAGEMENT['أخرى'];
  return pool[Math.floor(Math.random() * pool.length)];
}

// Is silent mode currently active? Reads settings table.
export function isSilentNow() {
  const enabled = getSetting('silent_enabled', '0') === '1';
  if (!enabled) return false;
  const auto = getSetting('silent_auto', '0') === '1';
  if (!auto) return true; // manual silent = always on
  const start = getSetting('silent_start', '22:00');
  const end = getSetting('silent_end', '07:00');
  const n = new Date();
  const cur = n.getHours() * 60 + n.getMinutes();
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  if (s <= e) return cur >= s && cur < e;
  return cur >= s || cur < e; // overnight window
}

export const NOTE_COLORS = ['#FF6B6B', '#FFB347', '#FFD93D', '#4ECDC4', '#6BC5D2', '#B8B8D1'];

export function truncate(str, n) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}
