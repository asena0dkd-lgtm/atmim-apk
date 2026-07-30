import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { Appearance, I18nManager } from 'react-native';
import { getSetting, setSetting } from '../db/database';
import { lightTheme, darkTheme, gradients, palette } from '../theme/colors';
import { strings } from '../i18n/strings';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeMode, setThemeModeState] = useState('dark'); // 'dark' | 'light' | 'auto'
  const [lang, setLangState] = useState('ar');
  const [sysScheme, setSysScheme] = useState(Appearance.getColorScheme());
  const [settingsVersion, setSettingsVersion] = useState(0);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSysScheme(colorScheme));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    setThemeModeState(getSetting('theme', 'dark'));
    const l = getSetting('language', 'ar');
    setLangState(l);
    // Best-effort RTL. A full flip needs an app reload; we also style per-component.
    const shouldBeRTL = l === 'ar';
    if (I18nManager.isRTL !== shouldBeRTL) {
      try { I18nManager.allowRTL(true); } catch (e) { /* noop */ }
    }
  }, []);

  const isDark = themeMode === 'auto' ? sysScheme !== 'light' : themeMode === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  const t = useCallback(
    (key, params) => {
      let s = (strings[lang] && strings[lang][key]) ?? strings.ar[key] ?? key;
      if (Array.isArray(s)) return s;
      if (params) for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v));
      return s;
    },
    [lang]
  );

  const setThemeMode = useCallback((mode) => {
    setSetting('theme', mode);
    setThemeModeState(mode);
  }, []);

  const setLanguage = useCallback((l) => {
    setSetting('language', l);
    setLangState(l);
  }, []);

  // Generic reactive settings accessor (bump version to re-read).
  const refreshSettings = useCallback(() => setSettingsVersion((v) => v + 1), []);
  const readSetting = useCallback((key, def) => getSetting(key, def), [settingsVersion]);
  const writeSetting = useCallback((key, value) => {
    setSetting(key, value);
    setSettingsVersion((v) => v + 1);
  }, []);

  const value = useMemo(
    () => ({
      theme, isDark, gradients, palette, lang, t, rtl: lang === 'ar',
      themeMode, setThemeMode, setLanguage, readSetting, writeSetting, refreshSettings,
    }),
    [theme, isDark, lang, t, themeMode, setThemeMode, setLanguage, readSetting, writeSetting, refreshSettings]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
