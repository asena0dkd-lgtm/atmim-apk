// Local notifications: daily 9PM summary, pomodoro completion, dependent-task unlocks.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { isSilentNow } from './helpers';

export async function setupNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: !isSilentNow(),
      shouldSetBadge: false,
    }),
  });
  const { status } = await Notifications.requestPermissionsAsync();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Atmm',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  return status === 'granted';
}

// Schedule (idempotent) the repeating 9PM daily summary.
export async function scheduleDailySummary() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'ملخص يومك جاهز 🌙',
      body: 'اضغط لترى ما أنجزته اليوم',
      sound: 'default',
      data: { type: 'daily-summary' },
    },
    trigger: { hour: 21, minute: 0, repeats: true },
  });
}

export async function notifyPomodoroDone(taskName) {
  if (isSilentNow()) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'انتهى الوقت! ⏰',
      body: `انتهى مؤقت: ${taskName}`,
      sound: 'default',
      vibrate: [0, 300, 200, 300],
    },
    trigger: null, // immediate
  });
}

export async function notifyTaskUnlocked(parentName, childName) {
  if (isSilentNow()) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'مهمة متاحة الآن 🔓',
      body: `«${parentName}» انتهت — حان دور «${childName}»`,
      sound: 'default',
    },
    trigger: null,
  });
}

// While the pomodoro runs, show an ongoing-style notification with the task name.
export async function notifyPomodoroRunning(taskName, remainingText) {
  if (isSilentNow()) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `⏳ ${taskName}`,
      body: remainingText,
      sticky: true,
      sound: false,
    },
    trigger: null,
  });
}
