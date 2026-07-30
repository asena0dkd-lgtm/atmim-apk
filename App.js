import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { TimerProvider } from './src/state/TimerContext';
import AppNavigator from './src/navigation/AppNavigator';
import LockScreen from './src/components/LockScreen';
import { getDB, getSetting } from './src/db/database';
import { setupNotifications, scheduleDailySummary } from './src/utils/notifications';

function Root() {
  const { isDark } = useTheme();
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    // warm up the DB (creates schema + seeds on first run)
    getDB();
    const pin = getSetting('pin', '');
    if (pin) setLocked(true);
    (async () => {
      const granted = await setupNotifications();
      if (granted) await scheduleDailySummary();
    })();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AppNavigator />
      {locked ? <LockScreen onUnlock={() => setLocked(false)} /> : null}
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <TimerProvider>
            <Root />
          </TimerProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
