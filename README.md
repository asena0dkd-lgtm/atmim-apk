# أتمم (Atmm) — Arabic Task & Notes Manager

A fully **offline** React Native (Expo) app. All data lives in a local **SQLite** database (`expo-sqlite`) — no backend, no internet required.

## Features

- **Tasks tab** (center, raised gradient button)
  - Category chips with colored dots, rounded search bar, swipeable task cards
  - Swipe right → complete (haptic), swipe left → edit / postpone / delete
  - Long-press → duplicate / share / link-to-task menu
  - FAB → Quick Add or Full Add bottom sheet
  - **Emergency mode** 🚨: pulsing red button (when tasks are overdue) → red-tinted screen with *Do it now / Postpone / Cancel forever*, auto-exits when cleared
  - **Pomodoro** ⏳: per-task timer, animated progress bar with moving dot, full-screen controls (pause / reset / +5 min), notification + vibration on finish
- **Notes tab**
  - 2-column grid, color tags, search
  - Editor toolbar: bold / italic / underline / strikethrough, text & highlight colors, checklists, **custom quick-insert buttons**, image insert, **hold-to-record voice notes** with waveform chip, **tables**, **freehand drawing layer**, search-in-note with context, find & replace, waypoints, link-to-task cards, export (Markdown / HTML / TXT / Copy)
- **Stats & Settings tab**
  - This-week vs last-week grouped bars with % badge & best-day suggestion
  - 7-day completion line chart, 12-week activity heatmap, category pie, total points
  - Theme (dark/light/auto), Arabic/English, silent mode + schedule, notifications, JSON export/import, PIN + biometric lock, about
- **Daily summary** 🌙 at 9 PM local notification → circular progress, streak 🔥, tomorrow preview, plan-tomorrow, share
- **Smart templates**: built-in templates, save-your-own, and a typing suggestion based on usage patterns
- Full Arabic (default) + English UI, RTL-aware layouts

## Color palette (enforced in `src/theme/colors.js`)

| Role | Value |
|---|---|
| Primary | `#FF6B6B → #FF8E8E` |
| Secondary | `#4ECDC4 → #6BC5D2` |
| Accent | `#FFB347 → #FFD93D` |
| Dark bg | `#1A1A2E` / Light bg `#F5F5F0` |

## Run it

```bash
cd Atmm
npm install            # or: npx expo install
npx expo start         # scan QR with Expo Go, or press a/i for emulator
```

> Audio recording and SQLite work best in a **development build** or the Expo Go app on a physical device.

## Project structure

```
Atmm/
├── App.js                      # providers, notification setup, PIN lock gate
├── index.js                    # registerRootComponent
├── src/
│   ├── db/database.js          # SQLite schema (8 tables) + all CRUD
│   ├── theme/colors.js         # brand palette, gradients, themes
│   ├── theme/ThemeContext.js   # theme + language + settings context
│   ├── i18n/strings.js         # Arabic / English strings
│   ├── state/TimerContext.js   # global pomodoro timer
│   ├── utils/helpers.js        # dates, encouragement lines, silent check
│   ├── utils/notifications.js  # daily 9PM summary, pomodoro, unlocks
│   ├── components/             # TaskCard, Charts (svg), CustomTabBar,
│   │                           # EmergencyMode, DailySummary, PomodoroModal, …
│   ├── screens/                # Tasks, TaskForm, Notes, NoteEditor, Stats
│   └── navigation/AppNavigator.js
└── app.json / package.json / babel.config.js
```

## Database schema

`tasks`, `notes`, `note_attachments`, `note_tables`, `categories`, `templates`, `settings`, `activity_log` — created and seeded on first launch in `src/db/database.js`. Export/import via JSON from the Stats → Settings section.
