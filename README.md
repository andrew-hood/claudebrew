# ClaudeBrew ☕

Answer Claude Code prompts from your phone over local WiFi. No cloud, no accounts — just two devices on the same network.

## How it works

1. Start the daemon on your Mac — it installs Claude Code hooks and starts a WebSocket server
2. Open the mobile app and scan the QR code (or enter IP + PIN manually)
3. Claude Code tool requests and output stream to your phone in real time
4. Approve or deny permission requests from anywhere in the room

```
Mac Daemon (Node.js)
  ├── WebSocket server (:3033) ←→ Mobile App (React Native)
  ├── Unix socket (/tmp/claudebrew.sock) ←→ Python hook script
  └── Hook installer → ~/.claude/settings.json
```

## Requirements

- **Mac**: Node.js 18+, Python 3
- **Phone**: iOS or Android, on the same WiFi network
- **Claude Code** installed and configured

## Setup

### Daemon

```bash
cd apps/daemon
npm install
npm run build
npm start
```

On first run, the daemon installs hooks into `~/.claude/settings.json` automatically. A QR code is printed in the terminal.

### Mobile

```bash
cd apps/mobile
npm install
npm run ios       # iOS simulator
npm run android   # Android device/emulator
```

Scan the QR code from the terminal, or manually enter the IP address and 4-digit PIN.

## Usage

Once connected, the mobile app shows:

- **Live output** — streaming terminal output from Claude Code
- **Permission requests** — tool use approvals with Allow / Deny buttons
- **Status indicator** — working / waiting / done

The daemon queues messages if the phone disconnects and replays them on reconnect.

## Project structure

```
apps/
  daemon/   Node.js/TypeScript — WebSocket server, hook installer, Unix socket bridge
  mobile/   React Native/Expo — connect screen, session screen, WebSocket client
```

### Key files

| File | Purpose |
|------|---------|
| `apps/daemon/src/types.ts` | Canonical protocol types |
| `apps/daemon/src/hooks/claudebrew-hook.py` | Python hook invoked by Claude Code |
| `apps/daemon/src/hook-installer.ts` | Merges hooks into `~/.claude/settings.json` |
| `apps/mobile/src/hooks/useWebSocket.ts` | WebSocket state machine |
| `apps/mobile/src/screens/SessionScreen.tsx` | Main interaction screen |

## Message protocol

All messages are JSON over WebSocket.

**Server → Client:** `output`, `status` (`working` / `waiting` / `done`), `pair_ok`, `hook_event`, `permission_request`
**Client → Server:** `pair` (with PIN), `permission_response` (allow/deny with `toolUseId`)

## Development

```bash
# Daemon (watch mode)
cd apps/daemon && npm run dev

# Mobile
cd apps/mobile && npm start
```

## License

MIT
