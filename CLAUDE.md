# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

ClaudeBrew is a local WiFi companion for Claude Code. It lets you respond to Claude Code prompts from your phone while away from your Mac — no cloud, no accounts, just two devices on the same WiFi.

Two components:
- **`apps/daemon`** — Node.js/TypeScript daemon that runs on Mac, installs Claude Code hooks, and serves a WebSocket on port 3033
- **`apps/mobile`** — React Native (Expo) app that connects to the daemon and surfaces questions/output

## Commands

### Daemon (`apps/daemon`)

```bash
npm run build   # tsc + copy Python hook to dist/hooks/
npm run dev     # tsc --watch
npm start       # node dist/index.js
```

The daemon is also published as a CLI: `cc-remote "your prompt"` (passes args through to `claude`).

### Mobile (`apps/mobile`)

```bash
npm start         # Expo dev server
npm run ios       # iOS simulator
npm run android   # Android device/emulator
```

## Architecture

```
Mac Daemon (Node.js/TS)
  ├── WebSocket server (:3033) ←→ Mobile App (React Native/Expo)
  ├── Unix socket (/tmp/claudebrew.sock) ←→ Python hook script
  └── Hook installer → ~/.claude/settings.json
```

### Daemon flow

1. `hook-installer.ts` — idempotently merges Python hook entries into `~/.claude/settings.json`
2. `socket-server.ts` (`SocketServer`) — Unix domain socket that receives events from the Python hook, routes `permission_request` events and awaits `permission_response`
3. `server.ts` (`RemoteServer`) — WebSocket server; queues messages when no mobile client connected; enforces single-client via PIN pairing
4. `index.ts` — wires everything together, generates PIN, prints QR

### Hook integration

The Python hook (`src/hooks/claudebrew-hook.py`, copied to `dist/hooks/`) is invoked by Claude Code on hook events. It connects to the Unix socket, sends a JSON `HookEvent`, and for `PreToolUse` events blocks until it receives a `permission_response` decision.

### Mobile flow

- `App.tsx` → manages font loading and connection state, switches between `ConnectScreen` and `SessionScreen`
- `useWebSocket.ts` — WebSocket lifecycle, message dispatch, auto-reconnect (2s)
- `useConnection.ts` — IP/PIN state
- `SessionScreen.tsx` — main UI: output tail, permission request cards, input bar
- `ConnectScreen.tsx` — IP+PIN entry + QR scanner

### Message protocol (JSON over WebSocket)

**Server → Client:** `output`, `status` (working/waiting/done), `pair_ok`, `hook_event`, `permission_request`
**Client → Server:** `pair` (with PIN), `permission_response` (allow/deny with toolUseId)

All types are in `apps/daemon/src/types.ts` and mirrored in `apps/mobile/src/types/protocol.ts`.

### Design tokens

`apps/mobile/src/theme/tokens.ts` — colors, spacing, typography
Fonts: Fraunces (headings), DM Sans (body), JetBrains Mono (terminal output)

## Key Files

| File | Purpose |
|------|---------|
| `apps/daemon/src/types.ts` | Canonical protocol types |
| `apps/daemon/src/hooks/claudebrew-hook.py` | Python hook called by Claude Code |
| `apps/daemon/src/hook-installer.ts` | Merges hooks into `~/.claude/settings.json` |
| `apps/mobile/src/hooks/useWebSocket.ts` | WebSocket state machine |
| `apps/mobile/src/screens/SessionScreen.tsx` | Main interaction screen |
