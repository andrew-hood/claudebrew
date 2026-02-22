# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

React Native (Expo) mobile app for ClaudeBrew — connects to the Mac daemon over WebSocket to surface Claude Code tool permission requests and session output. See the root `CLAUDE.md` for full system architecture.

## Commands

```bash
npm start         # Expo dev server
npm run ios       # iOS simulator
npm run android   # Android device/emulator
```

No test runner or linter is configured. TypeScript checking uses `expo/tsconfig.base` with strict mode.

## Architecture

### Navigation

Three-screen state machine in `App.tsx` — no router library:

```
ConnectScreen → SessionListScreen → SessionScreen (detail)
```

Navigation state is a simple string (`connect` | `list` | `detail`). Auto-navigates to detail when a single pending permission exists; notification taps route to the relevant session.

### State Flow

```
useWebSocket (useReducer — sessions Map + connected flag)
      ↓
useConnection (wraps useWebSocket, manages IP/PIN/connecting state)
      ↓
App.tsx (orchestrates navigation, notifications, font loading)
      ↓
Screens
```

All session state lives in a single `useReducer` inside `useWebSocket`. Sessions are keyed by `sessionId`, auto-created on first activity, and sorted with pending permissions first.

### WebSocket Protocol

Types mirrored from daemon in `src/types/protocol.ts`. Key message types:

- **`hook_event`** — primary data channel; carries tool use info, notifications, stop events
- **`permission_request` / `permission_dismissed`** — permission lifecycle
- **`pair` / `pair_ok`** — PIN-based auth handshake

The daemon's canonical types are in `apps/daemon/src/types.ts` — keep both in sync.

### Session State

Each `SessionState` tracks: `sessionId`, `cwd`, `label` (basename of cwd), `status` (working/waiting/done/null), `outputLines` (max 50, FIFO), `pendingPermission`, `lastActivity`.

### Permission UX

Two interaction patterns for responding to permissions:
1. **Swipe gestures** on session cards in `SessionListScreen` (right = allow, left = deny)
2. **Allow/Deny buttons** in `SessionScreen` detail view

`usePermissionNotifications` fires OS notifications + haptic feedback when new permissions arrive.

## Design System

`src/theme/tokens.ts` — coffee-themed dark palette:
- **Brew** colors (backgrounds): dark browns
- **Crema** colors (text): warm tans
- **Claude** colors (accents): amber/gold
- Fonts: Fraunces (headings), DM Sans (body), JetBrains Mono (terminal)

All animations respect `AccessibilityInfo.isReduceMotionEnabled`.

## Key Conventions

- Portrait-only, dark theme, iOS + Android
- Auto-reconnect on WebSocket disconnect (2s delay)
- Last connected IP persisted in AsyncStorage
- QR code format: URL with hostname + `?pin=xxxx` query param
