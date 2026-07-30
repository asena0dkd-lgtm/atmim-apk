// Global pomodoro timer state — shared between task cards, modal and emergency mode.
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { notifyPomodoroDone } from '../utils/notifications';
import { bumpActivity } from '../db/database';

const TimerContext = createContext(null);

export function TimerProvider({ children }) {
  // timer: { taskId, taskName, durationSec, remainingSec, running, done }
  const [timer, setTimer] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (timer && timer.running && !timer.done) {
      intervalRef.current = setInterval(() => {
        setTimer((prev) => {
          if (!prev || !prev.running) return prev;
          const next = prev.remainingSec - 1;
          if (next <= 0) {
            clearInterval(intervalRef.current);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            notifyPomodoroDone(prev.taskName);
            bumpActivity('pomodoro_minutes', Math.round(prev.durationSec / 60));
            return { ...prev, remainingSec: 0, running: false, done: true };
          }
          return { ...prev, remainingSec: next };
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [timer && timer.running, timer && timer.taskId]);

  const startTimer = useCallback((task, durationMinutes) => {
    const mins = durationMinutes || task.pomodoro_duration || 25;
    setTimer({
      taskId: task.id,
      taskName: task.name,
      durationSec: mins * 60,
      remainingSec: mins * 60,
      running: true,
      done: false,
    });
    setExpanded(true);
  }, []);

  const pauseTimer = useCallback(() => {
    setTimer((p) => (p ? { ...p, running: false } : p));
  }, []);

  const resumeTimer = useCallback(() => {
    setTimer((p) => (p && !p.done ? { ...p, running: true } : p));
  }, []);

  const resetTimer = useCallback(() => {
    setTimer((p) => (p ? { ...p, remainingSec: p.durationSec, running: false, done: false } : p));
  }, []);

  const addMinutes = useCallback((m) => {
    setTimer((p) =>
      p ? { ...p, durationSec: p.durationSec + m * 60, remainingSec: p.remainingSec + m * 60, done: false } : p
    );
  }, []);

  const stopTimer = useCallback(() => {
    clearInterval(intervalRef.current);
    setTimer(null);
    setExpanded(false);
  }, []);

  const expand = useCallback(() => setExpanded(true), []);
  const collapse = useCallback(() => setExpanded(false), []);

  return (
    <TimerContext.Provider
      value={{ timer, expanded, startTimer, pauseTimer, resumeTimer, resetTimer, addMinutes, stopTimer, expand, collapse }}
    >
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  return useContext(TimerContext);
}
