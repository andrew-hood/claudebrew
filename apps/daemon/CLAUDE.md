# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See also the root [../../CLAUDE.md](../../CLAUDE.md) for full project overview and mobile app details.

## Commands

```bash
npm run build   # tsc + copy Python hook to dist/hooks/
npm run dev     # tsc --watch
npm start       # node dist/index.js
npm start -- --verbose  # enable debug logging
```

No test framework is configured.

## Architecture

The daemon bridges Claude Code hooks (Python) with a mobile app (React Native) over local WiFi.

```
Claude Code hooks (Python)
    ↓ Unix socket (/tmp/claudebrew.sock)
SocketServer (socket-server.ts) — EventEmitter
    ↓ events: hookEvent, permissionDismissed
RemoteServer (server.ts) — WebSocket :3033
    ↓ JSON messages
Mobile App
```

### Data flow for permission requests

1. Claude Code invokes `claudebrew-hook.py` on `PermissionRequest` events
2. Python hook reads stdin JSON, connects to Unix socket, sends `HookEvent`, blocks waiting for response
3. `SocketServer` stores a pending Promise keyed by `sessionId:toolUseId`, emits `hookEvent`
4. `RemoteServer` receives the event, sends `permission_request` to mobile over WebSocket
5. Mobile user taps allow/deny, sends `permission_response` back
6. `RemoteServer.handleMessage` calls `socketServer.respondToPermission()`
7. `SocketServer` resolves the pending Promise, writes response back to Python hook's socket
8. Python hook outputs `hookSpecificOutput` JSON to stdout for Claude Code

### Key design choices

- **Single mobile client**: `RemoteServer` replaces the previous connection on new connect. PIN-based pairing enforced before any messages flow.
- **Message queue**: Messages are queued when no paired client exists, flushed on successful pairing.
- **Fire-and-forget events**: Non-`PermissionRequest` hook events (`PostToolUse`, `Notification`, `Stop`) are forwarded to mobile but don't block the hook — the Python socket closes immediately.
- **Graceful degradation**: The Python hook silently catches all exceptions so Claude Code is never blocked if the daemon isn't running.

## Protocol types

`src/types.ts` is the canonical source for the WebSocket protocol. Mobile mirrors these in `apps/mobile/src/types/protocol.ts` — keep them in sync.

**Server → Client:** `output`, `status`, `pair_ok`, `hook_event`, `permission_request`, `permission_dismissed`
**Client → Server:** `pair` (with PIN), `permission_response` (allow/deny)

## Hook installation

`hook-installer.ts` idempotently merges entries into `~/.claude/settings.json` for these events: `PreToolUse`, `PostToolUse`, `PermissionRequest`, `Notification`, `Stop`. Each entry invokes `claudebrew-hook.py` with a `CLAUDEBREW_EVENT` env var. Tool-scoped events use `matcher: '*'`.

The Python hook source lives at `src/hooks/claudebrew-hook.py` and is copied to `dist/hooks/` during build, then to `~/.claude/hooks/` at runtime by `install()`.
