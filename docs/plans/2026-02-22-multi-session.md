# Multi-Session Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single-session mobile UI with a session list + detail navigation model, so multiple concurrent Claude instances are all visible and manageable from the phone.

**Architecture:** Refactor `useWebSocket.ts` state from flat fields to a `Map<sessionId, SessionState>`, derive a sorted sessions array, and add two-level navigation (list → detail) in `App.tsx` with no additional navigation library. All existing daemon protocol messages already carry `sessionId`, so no daemon changes are required.

**Tech Stack:** React Native (Expo), TypeScript, React hooks (useReducer), no new dependencies

---

## Context

The daemon broadcasts all Claude hook events over WebSocket. Every `hook_event`, `permission_request`, and `permission_dismissed` message already carries a `sessionId`. The current mobile state ignores multi-session: it holds a single `pendingPermission`, a single `status`, and a flat `outputLines[]`. This plan wires all those fields up per-session.

Key invariants:
- `output` and `status` message types exist in the protocol but the daemon does not currently send them — all live data comes via `hook_event` / `permission_request` / `permission_dismissed`
- Session label = `basename(cwd)` from the first `hook_event` that carries a `cwd`
- Sessions with `pendingPermission !== null` sort to the top of the list
- Sessions live until next WS disconnect (no TTL/auto-cleanup in this plan)

---

## Task 1: Add `SessionState` type to mobile protocol file

**Files:**
- Modify: `apps/mobile/src/types/protocol.ts`

**What:** Add a `SessionState` interface that describes one Claude session's state on the mobile side.

**Step 1: Edit `protocol.ts`**

Add at the bottom of the file (after existing exports):

```ts
export interface SessionState {
  sessionId: string;
  cwd: string;
  label: string; // basename(cwd) or short sessionId fallback
  status: 'working' | 'waiting' | 'done' | null;
  outputLines: string[];
  pendingPermission: PermissionRequestMessage | null;
  lastActivity: number; // Date.now() timestamp
}
```

**Step 2: Commit**

```bash
git add apps/mobile/src/types/protocol.ts
git commit -m "feat(mobile): add SessionState type"
```

---

## Task 2: Refactor `useWebSocket.ts` to session-keyed state

**Files:**
- Modify: `apps/mobile/src/hooks/useWebSocket.ts`

**What:** Replace the flat `State` (single `outputLines`, `pendingPermission`, `status`) with a `sessions` map keyed by `sessionId`. Each incoming message is routed to the correct session.

**Step 1: Replace the State/Action types and reducer**

The new state shape:

```ts
interface State {
  sessions: Map<string, SessionState>;
  connected: boolean;
}
```

Helper to get or create a session entry:

```ts
function getOrCreate(sessions: Map<string, SessionState>, sessionId: string, cwd?: string): SessionState {
  const existing = sessions.get(sessionId);
  if (existing) return existing;
  const label = cwd ? cwd.split('/').filter(Boolean).at(-1) ?? sessionId.slice(0, 8) : sessionId.slice(0, 8);
  return {
    sessionId,
    cwd: cwd ?? '',
    label,
    status: null,
    outputLines: [],
    pendingPermission: null,
    lastActivity: Date.now(),
  };
}
```

New reducer (replace existing one entirely):

```ts
const MAX_OUTPUT_LINES = 50;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'connected':
      return state;
    case 'disconnected':
      return { sessions: new Map(), connected: false };
    case 'pair_ok':
      return { ...state, connected: true };

    case 'hook_activity': {
      const sessions = new Map(state.sessions);
      const session = { ...getOrCreate(sessions, action.sessionId, action.cwd) };
      session.lastActivity = Date.now();

      if (action.cwd && !session.cwd) {
        session.cwd = action.cwd;
        session.label = action.cwd.split('/').filter(Boolean).at(-1) ?? session.sessionId.slice(0, 8);
      }

      if (action.line) {
        const lines = [...session.outputLines, action.line];
        if (lines.length > MAX_OUTPUT_LINES) lines.shift();
        session.outputLines = lines;
      }

      if (action.statusChange) {
        session.status = action.statusChange;
        if (action.statusChange === 'working') session.pendingPermission = null;
      }

      // If we see PostToolUse/PreToolUse for a session that had a pending permission, clear it
      if (
        session.pendingPermission &&
        (action.event === 'PostToolUse' || action.event === 'PreToolUse')
      ) {
        session.pendingPermission = null;
      }

      sessions.set(action.sessionId, session);
      return { ...state, sessions };
    }

    case 'permission': {
      const sessions = new Map(state.sessions);
      const session = { ...getOrCreate(sessions, action.msg.sessionId) };
      session.pendingPermission = action.msg;
      session.status = 'waiting';
      session.lastActivity = Date.now();
      sessions.set(action.msg.sessionId, session);
      return { ...state, sessions };
    }

    case 'clear_permission': {
      const sessions = new Map(state.sessions);
      const session = sessions.get(action.sessionId);
      if (!session) return state;
      if (session.pendingPermission?.toolUseId !== action.toolUseId) return state;
      sessions.set(action.sessionId, { ...session, pendingPermission: null });
      return { ...state, sessions };
    }

    default:
      return state;
  }
}
```

New Action type (replace existing):

```ts
type Action =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'pair_ok' }
  | {
      type: 'hook_activity';
      sessionId: string;
      cwd?: string;
      event: string;
      line: string | null;
      statusChange: 'working' | 'waiting' | 'done' | null;
    }
  | { type: 'permission'; msg: PermissionRequestMessage }
  | { type: 'clear_permission'; sessionId: string; toolUseId: string };
```

New initial state:

```ts
const initialState: State = {
  sessions: new Map(),
  connected: false,
};
```

**Step 2: Update the message handler in `useWebSocket`**

Replace the `ws.onmessage` switch with:

```ts
ws.onmessage = (event) => {
  try {
    const msg: ServerMessage = JSON.parse(event.data as string);
    switch (msg.type) {
      case 'output':
        // Currently unused by daemon — ignore
        break;
      case 'hook_event': {
        const line = formatHookLine(msg);
        const statusChange =
          msg.event === 'Stop' ? 'done' : null;
        dispatch({
          type: 'hook_activity',
          sessionId: msg.sessionId,
          cwd: msg.cwd,
          event: msg.event,
          line,
          statusChange,
        });
        break;
      }
      case 'permission_request':
        dispatch({ type: 'permission', msg });
        break;
      case 'permission_dismissed':
        dispatch({ type: 'clear_permission', sessionId: msg.sessionId, toolUseId: msg.toolUseId });
        break;
      case 'status':
        // Currently unused by daemon — ignore
        break;
      case 'pair_ok':
        dispatch({ type: 'pair_ok' });
        break;
    }
  } catch {
    // Ignore malformed messages
  }
};
```

**Step 3: Update the hook's return value**

The hook should return a sorted `sessions` array instead of flat fields. Add a helper to derive sorted sessions (pending first, then by lastActivity desc):

```ts
function sortedSessions(map: Map<string, SessionState>): SessionState[] {
  return [...map.values()].sort((a, b) => {
    const aPending = a.pendingPermission ? 1 : 0;
    const bPending = b.pendingPermission ? 1 : 0;
    if (aPending !== bPending) return bPending - aPending;
    return b.lastActivity - a.lastActivity;
  });
}
```

Update the `sendPermissionResponse` callback — it still sends the same `permission_response` message, no change needed there.

Update the return:

```ts
return {
  sessions: sortedSessions(state.sessions),
  connected: state.connected,
  connect,
  disconnect,
  sendPermissionResponse,
};
```

**Step 4: Commit**

```bash
git add apps/mobile/src/hooks/useWebSocket.ts
git commit -m "feat(mobile): refactor useWebSocket to session-keyed state"
```

---

## Task 3: Update `useConnection.ts` to expose sessions

**Files:**
- Modify: `apps/mobile/src/hooks/useConnection.ts`

**What:** Replace the flat fields (outputLines, pendingPermission, status) with `sessions: SessionState[]`.

**Step 1: Edit `useConnection.ts`**

```ts
import { useState, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';

const DEFAULT_PORT = 3033;

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export function useConnection() {
  const [ip, setIp] = useState('');
  const [pin, setPin] = useState('');
  const [connecting, setConnecting] = useState(false);

  const url = connecting ? `ws://${ip}:${DEFAULT_PORT}` : null;
  const ws = useWebSocket(url, pin);

  const state: ConnectionState = ws.connected
    ? 'connected'
    : connecting
      ? 'connecting'
      : 'disconnected';

  const connectTo = useCallback(
    (targetIp: string, targetPin: string) => {
      setIp(targetIp);
      setPin(targetPin);
      setConnecting(true);
    },
    [],
  );

  const disconnectFrom = useCallback(() => {
    setConnecting(false);
    ws.disconnect();
  }, [ws]);

  return {
    state,
    ip,
    pin,
    connectTo,
    disconnect: disconnectFrom,
    sessions: ws.sessions,
    sendPermissionResponse: ws.sendPermissionResponse,
  };
}
```

**Step 2: Commit**

```bash
git add apps/mobile/src/hooks/useConnection.ts
git commit -m "feat(mobile): expose sessions array from useConnection"
```

---

## Task 4: Create `SessionListScreen.tsx`

**Files:**
- Create: `apps/mobile/src/screens/SessionListScreen.tsx`

**What:** New primary screen shown when connected. Lists active sessions as cards with status dots and pending permission badges. Tapping a card calls `onSelectSession`.

```tsx
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { colors, spacing, radii, typography } from '../theme/tokens';
import { SessionState } from '../types/protocol';

interface Props {
  sessions: SessionState[];
  onSelectSession: (sessionId: string) => void;
  onDisconnect: () => void;
}

export function SessionListScreen({ sessions, onSelectSession, onDisconnect }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>ClaudeBrew</Text>
        <TouchableOpacity onPress={onDisconnect}>
          <Text style={styles.disconnectText}>Disconnect</Text>
        </TouchableOpacity>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>☕</Text>
          <Text style={styles.emptyText}>No active sessions{'\n'}start claude to begin</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {sessions.map((session) => (
            <SessionCard key={session.sessionId} session={session} onPress={() => onSelectSession(session.sessionId)} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function SessionCard({ session, onPress }: { session: SessionState; onPress: () => void }) {
  const hasPending = !!session.pendingPermission;
  const statusColor =
    hasPending
      ? colors.waiting
      : session.status === 'working'
        ? colors.working
        : session.status === 'done'
          ? colors.connected
          : colors.brewMuted;

  const statusLabel = hasPending
    ? 'Waiting'
    : session.status === 'working'
      ? 'Working'
      : session.status === 'done'
        ? 'Done'
        : 'Idle';

  const lastLine = session.outputLines.at(-1) ?? '';

  return (
    <TouchableOpacity style={[styles.card, hasPending && styles.cardPending]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={styles.cardLabel} numberOfLines={1}>{session.label}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusColor + '1F' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {hasPending ? (
        <View style={styles.permBadge}>
          <Text style={styles.permBadgeText}>PERMISSION REQUEST  · {session.pendingPermission!.tool}</Text>
        </View>
      ) : lastLine ? (
        <Text style={styles.lastLine} numberOfLines={1}>{lastLine}</Text>
      ) : null}

      {session.cwd ? (
        <Text style={styles.cwd} numberOfLines={1}>{session.cwd}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: (Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 0) + spacing.sm,
    paddingBottom: spacing.sm,
  },
  logo: {
    fontFamily: typography.fraunces.bold,
    fontSize: 20,
    color: colors.cremaLight,
  },
  disconnectText: {
    fontFamily: typography.dmSans.light,
    fontSize: 13,
    color: colors.brewMuted,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyIcon: { fontSize: 48 },
  emptyText: {
    fontFamily: typography.fraunces.italic,
    fontSize: 16,
    color: colors.cremaDark,
    textAlign: 'center',
    lineHeight: 24,
  },
  list: { flex: 1 },
  listContent: { padding: spacing.md, gap: spacing.sm },
  card: {
    backgroundColor: colors.brewMedium,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.brewSurface,
  },
  cardPending: {
    borderColor: colors.waiting,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  cardLabel: {
    fontFamily: typography.dmSans.semibold,
    fontSize: 16,
    color: colors.cremaLight,
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  statusText: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  permBadge: {
    backgroundColor: colors.waiting + '22',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  permBadgeText: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 11,
    color: colors.waiting,
    letterSpacing: 0.5,
  },
  lastLine: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 11,
    color: colors.terminalMuted,
  },
  cwd: {
    fontFamily: typography.dmSans.light,
    fontSize: 11,
    color: colors.brewMuted,
  },
});
```

**Step 2: Commit**

```bash
git add apps/mobile/src/screens/SessionListScreen.tsx
git commit -m "feat(mobile): add SessionListScreen with session cards"
```

---

## Task 5: Refactor `SessionScreen.tsx` → `SessionDetailScreen.tsx`

**Files:**
- Modify: `apps/mobile/src/screens/SessionScreen.tsx` (rename + update props)

**What:** The existing `SessionScreen` becomes `SessionDetailScreen`. Instead of receiving flat props, it receives a single `SessionState`. Add a back button.

**Step 1: Replace the file contents**

The new component signature:

```tsx
interface SessionDetailScreenProps {
  session: SessionState;
  onPermissionResponse: (sessionId: string, toolUseId: string, decision: 'allow' | 'deny') => void;
  onBack: () => void;
}

export function SessionDetailScreen({ session, onPermissionResponse, onBack }: SessionDetailScreenProps) {
  // ...
}
```

Key changes from the existing `SessionScreen`:
- Replace all `status`, `pendingPermission`, `outputLines` prop references with `session.status`, `session.pendingPermission`, `session.outputLines`
- Replace `onDisconnect` button with a back button (`←  Sessions`) in the header
- Show `session.label` next to the logo (e.g. `ClaudeBrew / my-project`)
- The `onAllow`/`onDeny` callbacks already pass `sessionId` and `toolUseId`, no change needed

Full replacement for `SessionScreen.tsx`:

```tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Animated,
} from 'react-native';
import { colors, spacing, radii, typography } from '../theme/tokens';
import { PermissionRequestMessage, SessionState } from '../types/protocol';

interface SessionDetailScreenProps {
  session: SessionState;
  onPermissionResponse: (sessionId: string, toolUseId: string, decision: 'allow' | 'deny') => void;
  onBack: () => void;
}

function getTerminalLineColor(line: string): string {
  if (line.includes('✓') || line.startsWith('✔')) return colors.terminalSuccess;
  if (line.startsWith('🔧') || line.startsWith('→') || line.includes('[info]') || line.startsWith('💬'))
    return colors.terminalInfo;
  if (line.startsWith('✗') || line.includes('[error]')) return colors.offline;
  return colors.terminalMuted;
}

export function SessionDetailScreen({ session, onPermissionResponse, onBack }: SessionDetailScreenProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const breathAnim = useRef(new Animated.Value(1)).current;

  const isActive = session.status === 'waiting' || session.status === 'working';

  useEffect(() => {
    if (!isActive) {
      pulseAnim.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 750, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [isActive, pulseAnim]);

  useEffect(() => {
    if (session.pendingPermission) {
      breathAnim.setValue(1);
      return;
    }
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1.03, duration: 2000, useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ]),
    );
    breathe.start();
    return () => breathe.stop();
  }, [session.pendingPermission, breathAnim]);

  const statusColor =
    session.status === 'waiting'
      ? colors.waiting
      : session.status === 'working'
        ? colors.working
        : session.status === 'done'
          ? colors.connected
          : colors.connected;

  const statusLabel =
    session.status === 'waiting'
      ? 'Waiting'
      : session.status === 'working'
        ? 'Working'
        : session.status === 'done'
          ? 'Done'
          : 'Connected';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Sessions</Text>
        </TouchableOpacity>
        <View style={[styles.statusPill, { backgroundColor: statusColor + '1F' }]}>
          <Animated.View
            style={[styles.statusDot, { backgroundColor: statusColor, opacity: pulseAnim }]}
          />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Session label */}
      <Text style={styles.sessionLabel} numberOfLines={1}>{session.label}</Text>

      {/* Terminal output */}
      {session.outputLines.length > 0 && (
        <ScrollView style={styles.terminal} contentContainerStyle={styles.terminalContent}>
          {session.outputLines.slice(-10).map((line, i) => (
            <Text
              key={i}
              style={[styles.terminalLine, { color: getTerminalLineColor(line) }]}
              numberOfLines={1}
            >
              {line}
            </Text>
          ))}
        </ScrollView>
      )}

      {/* Main content */}
      <View style={styles.content}>
        {session.pendingPermission ? (
          <PermissionPrompt
            msg={session.pendingPermission}
            onAllow={() =>
              onPermissionResponse(session.pendingPermission!.sessionId, session.pendingPermission!.toolUseId, 'allow')
            }
            onDeny={() =>
              onPermissionResponse(session.pendingPermission!.sessionId, session.pendingPermission!.toolUseId, 'deny')
            }
          />
        ) : (
          <View style={styles.idle}>
            <Animated.Text style={[styles.idleIcon, { transform: [{ scale: breathAnim }] }]}>
              ☕
            </Animated.Text>
            <Text style={styles.idleText}>Claude is working...{'\n'}enjoy your coffee</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function PermissionPrompt({
  msg,
  onAllow,
  onDeny,
}: {
  msg: PermissionRequestMessage;
  onAllow: () => void;
  onDeny: () => void;
}) {
  const inputPreview = msg.toolInput
    ? Object.entries(msg.toolInput)
        .map(([k, v]) => `${k}: ${String(v).slice(0, 80)}`)
        .join('\n')
    : '';

  return (
    <View style={styles.permissionCard}>
      <Text style={styles.permissionLabel}>PERMISSION REQUEST</Text>
      <Text style={styles.permissionTool}>{msg.tool}</Text>
      {inputPreview ? (
        <Text style={styles.permissionInput}>{inputPreview}</Text>
      ) : null}
      <View style={styles.permissionButtons}>
        <TouchableOpacity style={[styles.permBtn, styles.denyBtn]} onPress={onDeny}>
          <Text style={styles.denyText}>Deny</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.permBtn, styles.allowBtn]} onPress={onAllow}>
          <Text style={styles.allowText}>Allow</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: (Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 0) + spacing.sm,
    paddingBottom: spacing.xs,
  },
  backBtn: { paddingVertical: spacing.xs },
  backText: {
    fontFamily: typography.dmSans.regular,
    fontSize: 14,
    color: colors.claudeAmber,
  },
  sessionLabel: {
    fontFamily: typography.fraunces.bold,
    fontSize: 18,
    color: colors.cremaLight,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    gap: spacing.xs,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  terminal: {
    maxHeight: 100,
    backgroundColor: colors.brewDark,
    marginHorizontal: spacing.md,
    borderRadius: radii.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.brewSurface,
  },
  terminalContent: { gap: 2 },
  terminalLine: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 12,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  idle: { alignItems: 'center', gap: spacing.md },
  idleIcon: { fontSize: 48 },
  idleText: {
    fontFamily: typography.fraunces.italic,
    fontSize: 16,
    color: colors.cremaDark,
    textAlign: 'center',
    lineHeight: 24,
  },
  permissionCard: {
    backgroundColor: colors.brewMedium,
    borderWidth: 1,
    borderColor: colors.waiting,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  permissionLabel: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 10,
    color: colors.waiting,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  permissionTool: {
    fontFamily: typography.dmSans.semibold,
    fontSize: 18,
    color: colors.cremaLight,
  },
  permissionInput: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 11,
    color: colors.terminalMuted,
    lineHeight: 16,
  },
  permissionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  permBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    alignItems: 'center',
  },
  denyBtn: {
    backgroundColor: colors.brewDark,
    borderWidth: 1,
    borderColor: colors.offline,
  },
  denyText: {
    fontFamily: typography.jetbrainsMono.medium,
    fontSize: 14,
    color: colors.offline,
  },
  allowBtn: { backgroundColor: colors.claudeAmber },
  allowText: {
    fontFamily: typography.jetbrainsMono.medium,
    fontSize: 14,
    color: colors.brewDark,
  },
});
```

**Step 2: Commit**

```bash
git add apps/mobile/src/screens/SessionScreen.tsx
git commit -m "feat(mobile): refactor SessionScreen into SessionDetailScreen"
```

---

## Task 6: Update `App.tsx` to wire session navigation

**Files:**
- Modify: `apps/mobile/App.tsx`

**What:** Add `selectedSessionId: string | null` state. When connected, show `SessionListScreen` if null, or `SessionDetailScreen` for the selected session. Auto-navigate to the selected session when a new permission arrives (if not already viewing a session with a pending permission).

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useAppFonts } from './src/theme/fonts';
import { colors } from './src/theme/tokens';
import { useConnection } from './src/hooks/useConnection';
import { ConnectScreen } from './src/screens/ConnectScreen';
import { SessionListScreen } from './src/screens/SessionListScreen';
import { SessionDetailScreen } from './src/screens/SessionDetailScreen';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const fontsLoaded = useAppFonts();
  const connection = useConnection();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Clear selection on disconnect
  useEffect(() => {
    if (connection.state !== 'connected') {
      setSelectedSessionId(null);
    }
  }, [connection.state]);

  // Auto-navigate: if viewing the list and exactly one session has a pending permission, select it
  useEffect(() => {
    if (selectedSessionId !== null) return;
    const withPending = connection.sessions.filter(s => s.pendingPermission !== null);
    if (withPending.length === 1) {
      setSelectedSessionId(withPending[0].sessionId);
    }
  }, [connection.sessions, selectedSessionId]);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  const selectedSession = selectedSessionId
    ? connection.sessions.find(s => s.sessionId === selectedSessionId) ?? null
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      {connection.state === 'connected' ? (
        selectedSession ? (
          <SessionDetailScreen
            session={selectedSession}
            onPermissionResponse={connection.sendPermissionResponse}
            onBack={() => setSelectedSessionId(null)}
          />
        ) : (
          <SessionListScreen
            sessions={connection.sessions}
            onSelectSession={setSelectedSessionId}
            onDisconnect={connection.disconnect}
          />
        )
      ) : (
        <ConnectScreen
          connecting={connection.state === 'connecting'}
          onConnect={connection.connectTo}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brewDark,
  },
});
```

Note: `SessionDetailScreen` is imported from the new path. The file is still named `SessionScreen.tsx` but exports `SessionDetailScreen`. If you prefer, rename the file to `SessionDetailScreen.tsx` and update the import — but the export name change alone is sufficient.

**Step 2: Commit**

```bash
git add apps/mobile/App.tsx
git commit -m "feat(mobile): wire multi-session navigation in App"
```

---

## Task 7: Verify end-to-end

**What:** Run the mobile app and manually verify the multi-session flow.

**Step 1: Start the mobile dev server**

```bash
cd apps/mobile && npm start
```

**Step 2: Start the daemon**

```bash
cd apps/daemon && npm start
```

**Step 3: Test scenarios**

- Single session: app should auto-navigate to SessionDetailScreen when a permission arrives, back navigates to list
- Multiple sessions (open two terminal tabs running `claude`): list should show both cards, pending permissions float to top, tapping navigates correctly
- Session with pending permission while viewing another session's detail: back button returns to list showing the badge
- Disconnect: selection clears, returns to ConnectScreen

**Step 4: Commit any fixups**

```bash
git commit -am "fix(mobile): multi-session edge case fixes"
```
