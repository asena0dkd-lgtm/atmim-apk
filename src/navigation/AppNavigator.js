import React, { useEffect, useRef } from 'react';
import { NavigationContainer, createNavigationContainerRef, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../theme/ThemeContext';
import TasksScreen from '../screens/TasksScreen';
import NotesScreen from '../screens/NotesScreen';
import StatsScreen from '../screens/StatsScreen';
import TaskFormScreen from '../screens/TaskFormScreen';
import NoteEditorScreen from '../screens/NoteEditorScreen';
import DailySummary from '../components/DailySummary';
import CustomTabBar from '../components/CustomTabBar';
import PomodoroModal from '../components/PomodoroModal';

export const navigationRef = createNavigationContainerRef();

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
      initialRouteName="Tasks"
    >
      <Tab.Screen name="Notes" component={NotesScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="Stats" component={StatsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isDark } = useTheme();

  // Open the daily summary when its 9PM notification is tapped.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data && data.type === 'daily-summary' && navigationRef.isReady()) {
        navigationRef.navigate('DailySummary');
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <>
      <NavigationContainer ref={navigationRef} theme={isDark ? DarkTheme : DefaultTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={Tabs} />
          <Stack.Screen name="TaskForm" component={TaskFormScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="NoteEditor" component={NoteEditorScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="DailySummary" component={DailySummary} options={{ presentation: 'modal' }} />
        </Stack.Navigator>
      </NavigationContainer>
      {/* Pomodoro modal floats above everything */}
      <PomodoroModal />
    </>
  );
}
