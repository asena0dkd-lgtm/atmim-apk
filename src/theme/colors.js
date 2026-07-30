// Central color system for أتمم — strictly from the brand palette.
export const gradients = {
  primary: ['#FF6B6B', '#FF8E8E'],   // red-pink
  secondary: ['#4ECDC4', '#6BC5D2'], // green-blue
  accent: ['#FFB347', '#FFD93D'],    // orange-yellow
};

export const palette = {
  primary: '#FF6B6B',
  primarySoft: '#FF8E8E',
  secondary: '#4ECDC4',
  secondarySoft: '#6BC5D2',
  accent: '#FFB347',
  accentSoft: '#FFD93D',
  success: '#4ECDC4',
  danger: '#FF6B6B',
  warning: '#FFB347',
};

export const priorityColors = {
  low: palette.secondary,
  medium: palette.accent,
  high: palette.primary,
};

export const lightTheme = {
  mode: 'light',
  background: '#F5F5F0',
  card: '#FFFFFF',
  cardAlt: '#FAF9F4',
  text: '#2D2D3A',
  textSecondary: '#7A7A8C',
  border: '#E9E7DE',
  inputBg: '#FFFFFF',
  overlay: 'rgba(26,26,46,0.45)',
  shadow: '#1A1A2E',
  tabBar: '#FFFFFF',
  dangerBg: '#FFF0F0',
};

export const darkTheme = {
  mode: 'dark',
  background: '#1A1A2E',
  card: '#252544',
  cardAlt: '#2C2C4E',
  text: '#FFFFFF',
  textSecondary: '#A6A6C0',
  border: '#35355C',
  inputBg: '#2C2C4E',
  overlay: 'rgba(0,0,0,0.55)',
  shadow: '#000000',
  tabBar: '#20203A',
  dangerBg: '#3A2030',
};

// Seed categories: name_ar, name_en, color
export const seedCategories = [
  { name_ar: 'عمل', name_en: 'Work', color: '#FF6B6B', icon: '💼' },
  { name_ar: 'دراسة', name_en: 'Study', color: '#4ECDC4', icon: '📚' },
  { name_ar: 'صحة', name_en: 'Health', color: '#FFB347', icon: '💪' },
  { name_ar: 'شخصي', name_en: 'Personal', color: '#6BC5D2', icon: '🌟' },
  { name_ar: 'تسوق', name_en: 'Shopping', color: '#FFD93D', icon: '🛒' },
  { name_ar: 'أخرى', name_en: 'Other', color: '#B8B8D1', icon: '📌' },
];
