# Claude Code Remote Companion — Simplified

## Technical Design Document

**Author:** Andrew  
**Date:** February 2026  
**Status:** Draft v2 — Local WiFi Architecture  
**Version:** 0.2

---

## 1. Problem Statement

When using Claude Code on a Mac, stepping away (coffee, lunch, etc.) means Claude Code may block on a question with no way to respond until you return. This creates idle time and breaks flow.

**Goal:** Build a lightweight system where your phone can see Claude Code's questions and send answers back — all over local WiFi with no cloud infrastructure.

---

## 2. Simplified Architecture

Since both devices are on the same WiFi network, we eliminate the relay server entirely. The Mac runs a local WebSocket server that the phone connects to directly.

```
┌──────────────────────────────────────────────────┐
│              LOCAL WIFI NETWORK                    │
│                                                    │
│   ┌──────────────┐         ┌──────────────┐       │
│   │              │   WS    │              │       │
│   │  Mac Daemon  │◄───────►│  Mobile App  │       │
│   │  + WS Server │  local  │  (Expo)      │       │
│   │              │         │              │       │
│   └──────┬───────┘         └──────────────┘       │
│          │                                         │
│          │ stdin/stdout                             │
│          │                                         │
│   ┌──────▼───────┐                                │
│   │  Claude Code │                                │
│   │    (CLI)     │                                │
│   └──────────────┘                                │
│                                                    │
└──────────────────────────────────────────────────┘

Total components: 2 (down from 3)
Cloud infrastructure: none
```

---

## 3. How It Works

### 3.1 Complete Flow

```
  Developer            Phone App           Mac Daemon          Claude Code
      │                    │                    │                    │
      │  1. Start daemon   │                    │                    │
      │───────────────────────────────────────►│                    │
      │                    │                    │  2. Spawn CC       │
      │                    │                    │───────────────────►│
      │                    │                    │                    │
      │                    │                    │  3. Start WS on    │
      │                    │                    │     port 3033      │
      │                    │                    │                    │
      │  4. Show QR / IP   │                    │                    │
      │◄───────────────────────────────────────│                    │
      │                    │                    │                    │
      │    "Connect to     │                    │                    │
      │     192.168.1.42   │                    │                    │
      │     :3033"         │                    │                    │
      │                    │                    │                    │
      │  5. Open app,      │  6. WS connect     │                    │
      │     scan QR        │───────────────────►│                    │
      │                    │                    │                    │
      │                    │  7. Connected!      │                    │
      │                    │◄───────────────────│                    │
      │                    │                    │                    │
      │  ~~~ walks away to get coffee ~~~       │                    │
      │                    │                    │                    │
      │                    │                    │  8. CC asks question│
      │                    │                    │◄───────────────────│
      │                    │                    │                    │
      │                    │  9. WS: question   │                    │
      │                    │◄───────────────────│                    │
      │                    │                    │                    │
      │  *phone buzzes*    │                    │                    │
      │◄───────────────────│                    │                    │
      │                    │                    │                    │
      │  10. Type answer   │                    │                    │
      │───────────────────►│                    │                    │
      │                    │                    │                    │
      │                    │  11. WS: answer    │                    │
      │                    │───────────────────►│                    │
      │                    │                    │                    │
      │                    │                    │  12. Pipe to stdin │
      │                    │                    │───────────────────►│
      │                    │                    │                    │
      │                    │                    │  13. CC continues  │
      │                    │                    │◄───────────────────│
      │                    │                    │                    │
      │                    │  14. WS: output    │                    │
      │                    │◄───────────────────│                    │
      │                    │                    │                    │
```

### 3.2 Discovery & Pairing

No accounts, no cloud, no tokens. Just a local connection:

```
  Mac Terminal                              Phone App
       │                                        │
       │  Daemon starts, prints:                 │
       │  ┌──────────────────────────┐          │
       │  │ CC Remote listening on   │          │
       │  │ ws://192.168.1.42:3033   │          │
       │  │                          │          │
       │  │ ██████████████           │          │
       │  │ ██          ██           │          │
       │  │ ██  QR CODE ██           │          │
       │  │ ██          ██           │          │
       │  │ ██████████████           │          │
       │  │                          │          │
       │  │ Or enter PIN: 8472      │          │
       │  └──────────────────────────┘          │
       │                                        │
       │                      User scans QR or  │
       │                      enters IP manually│
       │                                        │
       │◄───────── WS handshake + PIN ─────────│
       │                                        │
       │──────────── Connection OK ────────────►│
       │                                        │
```

The PIN is a simple 4-digit code valid for that session only — prevents other devices on the same network from connecting accidentally.

---

## 4. Component Design

### 4.1 Mac Daemon (`cc-remote`)

A single Node.js script that does three things:

```
┌──────────────────────────────────────────────┐
│              MAC DAEMON                       │
│                                               │
│  ┌────────────┐                              │
│  │ 1. Wrap    │  Spawn Claude Code            │
│  │    CC I/O  │  Tee stdout to terminal       │
│  │            │  + WebSocket                  │
│  └─────┬──────┘                              │
│        │                                      │
│  ┌─────▼──────┐                              │
│  │ 2. Detect  │  Watch for question patterns  │
│  │    prompts │  in stdout stream             │
│  └─────┬──────┘                              │
│        │                                      │
│  ┌─────▼──────┐                              │
│  │ 3. Serve   │  Local WebSocket server       │
│  │    WS      │  on port 3033                 │
│  └────────────┘                              │
│                                               │
└──────────────────────────────────────────────┘
```

**Question Detection — Keep it simple:**

Rather than complex NLP, use pattern matching on the last few lines of output:

```
Detected as questions:
  ├── Line contains "?" and process stdin is waiting
  ├── Line matches: /\(y\/n\)/i, /\[Y\/n\]/i
  ├── Line matches: /\(yes\/no\)/i
  ├── Line ends with ": " after a question line
  └── Known Claude Code prompts (e.g. tool approval)

NOT detected (just streamed as output):
  ├── Normal code output
  ├── Progress messages
  └── Informational lines with "?"
```

**CLI Usage:**

```bash
# Install globally
npm install -g cc-remote

# Use it exactly like claude, but with remote access
cc-remote "refactor the auth module"

# All args are passed through to claude
cc-remote --model sonnet "fix the tests"
```

### 4.2 Mobile App (`CC Remote`)

Minimal Expo app with essentially one screen:

```
┌─────────────────────────────────┐
│  CC Remote        ● Connected   │
│─────────────────────────────────│
│                                 │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│    Last output:                 │
│  │ Installing deps...        │ │
│    Migrating database...        │
│  │ Running tests... ✓        │ │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│                                 │
│  ┌─────────────────────────┐   │
│  │ 🤖 Claude Code          │   │
│  │                         │   │
│  │ Should I also update    │   │
│  │ the API tests to match  │   │
│  │ the new schema?         │   │
│  │                         │   │
│  │ (Y/n)                   │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌──────┐ ┌──────┐ ┌────────┐ │
│  │  Y   │ │  N   │ │ Custom │ │
│  └──────┘ └──────┘ └────────┘ │
│                                 │
│  ┌───────────────────┐ ┌─────┐ │
│  │ Type response...  │ │Send │ │
│  └───────────────────┘ └─────┘ │
└─────────────────────────────────┘
```

**Key UX features:**

- **Quick reply buttons** — auto-detected from the question (Y/n, 1/2/3, etc.)
- **Output tail** — scrollable view of recent Claude Code output for context
- **Local notifications** — iOS local notification when a new question arrives (no push server needed since the WS connection triggers it)
- **Auto-reconnect** — if WiFi blips, reconnect automatically

---

## 5. Message Protocol

Simple JSON over WebSocket. No auth tokens, no encryption overhead — it's local network only.

```json
// Mac → Phone: Claude Code output stream
{
  "type": "output",
  "text": "Running tests... 14/14 passed ✓\n"
}

// Mac → Phone: Question detected
{
  "type": "question",
  "id": "q1",
  "text": "Should I also update the API tests? (Y/n)",
  "quick_replies": ["Y", "n"],
  "context_lines": [
    "Refactored auth module ✓",
    "Updated 3 files",
    "Running tests... 14/14 passed ✓"
  ]
}

// Phone → Mac: Answer
{
  "type": "answer",
  "id": "q1",
  "text": "Y"
}

// Mac → Phone: Status
{
  "type": "status",
  "state": "working" | "waiting" | "done"
}

// Pairing handshake
{ "type": "pair", "pin": "8472" }
{ "type": "pair_ok" }
```

---

## 6. Technology Stack

```
┌─────────────┬──────────────────────────────────┐
│  Component  │  Technology                       │
├─────────────┼──────────────────────────────────┤
│  Mac Daemon │  Node.js, TypeScript              │
│             │  ws (WebSocket server)            │
│             │  child_process (spawn CC)         │
│             │  qrcode-terminal (display QR)     │
├─────────────┼──────────────────────────────────┤
│  Mobile App │  React Native (Expo)              │
│  (iOS +     │  Built-in WebSocket               │
│   Android)  │  expo-notifications (local only)  │
│             │  expo-camera (QR scanning)        │
├─────────────┼──────────────────────────────────┤
│  Cloud      │  None                             │
│  Infra      │                                   │
└─────────────┴──────────────────────────────────┘
```

**Total dependencies for Mac daemon:** ~3 npm packages  
**Total dependencies for mobile app:** Expo SDK + 2 extras

---

## 7. Build Plan

### Phase 1 — Working Prototype (1 day)

```
┌──────────────────────────────────────────────────┐
│  PHASE 1 — Get it working                         │
│                                                    │
│  Mac Daemon:                                       │
│  ☐ Spawn Claude Code as child process             │
│  ☐ Tee stdout to terminal + WebSocket             │
│  ☐ Basic question detection (regex)               │
│  ☐ Pipe WS answers to stdin                       │
│  ☐ Print local IP + port on startup               │
│                                                    │
│  Mobile App:                                       │
│  ☐ Single screen: connect via IP input            │
│  ☐ Display question text                           │
│  ☐ Text input + send button                        │
│  ☐ Show connection status                          │
│                                                    │
└──────────────────────────────────────────────────┘
```

### Phase 2 — Daily Driver (3-4 days)

```
┌──────────────────────────────────────────────────┐
│  PHASE 2 — Make it nice                           │
│                                                    │
│  ☐ QR code pairing                                │
│  ☐ PIN verification                                │
│  ☐ Quick reply buttons (Y/n, 1/2/3)              │
│  ☐ Output tail view on phone                      │
│  ☐ Local push notifications                        │
│  ☐ Auto-reconnect on WiFi blip                    │
│  ☐ Remember last connection                        │
│  ☐ Haptic feedback on new question                │
│                                                    │
└──────────────────────────────────────────────────┘
```

### Phase 3 — Nice to Have (whenever)

```
┌──────────────────────────────────────────────────┐
│  PHASE 3 — Polish                                 │
│                                                    │
│  ☐ Mac menu bar icon (connection status)          │
│  ☐ Bonjour/mDNS auto-discovery (no IP needed)    │
│  ☐ Multiple session support                        │
│  ☐ Session history                                 │
│  ☐ Sound/vibration customization                  │
│                                                    │
└──────────────────────────────────────────────────┘
```

---

## 8. What We Cut (and Why)

| Removed               | Why                                    |
| --------------------- | -------------------------------------- |
| Relay server          | Same WiFi = direct connection          |
| Cloud hosting         | Nothing to host                        |
| JWT authentication    | PIN on local network is sufficient     |
| End-to-end encryption | Local network, trusted devices         |
| Push notifications    | Local notifications via WS are instant |
| User accounts         | Single user, single Mac                |
| Redis/database        | In-memory on both sides is fine        |
| Complex NLP detection | Regex patterns cover 90% of cases      |

---

## 9. Risks & Mitigations

**Risk: Question detection misses a prompt**  
Mitigation: Always stream output to the phone. Even if auto-detection misses, you can see Claude is stuck and type a response manually.

**Risk: WiFi disconnects briefly**  
Mitigation: Auto-reconnect with exponential backoff. Mac daemon queues any questions asked while phone was disconnected.

**Risk: Multiple devices try to connect**  
Mitigation: Single connection only — new connection kicks the old one with a notification.

**Risk: Phone goes to sleep, misses notification**  
Mitigation: Local notifications work even when the app is backgrounded on both platforms. Android can use a foreground service to keep the WebSocket alive reliably. iOS requires background mode configuration but Expo handles this via `expo-task-manager`. As a fallback, the Mac daemon queues questions until the phone reconnects.

---

## 10. Future Ideas

- **Bonjour/mDNS discovery** — phone auto-finds the Mac, no IP entry needed
- **Watch app** — see questions on Apple Watch or Wear OS, tap quick replies
- **Widget** — iOS home screen widget or Android widget showing current CC status
- **Voice shortcut** — "Hey Siri, tell Claude yes" / "Hey Google, tell Claude yes"
- **Android persistent notification** — show ongoing status in the notification shade with inline reply
- **Claude Code plugin API** — if CC ever exposes hooks, skip stdout parsing entirely

---

## 11. Cost

```
┌──────────────────────┬──────────────┐
│  Item                │  Cost        │
├──────────────────────┼──────────────┤
│  Everything          │  $0          │
└──────────────────────┴──────────────┘

No servers. No subscriptions. No accounts.
Just two devices on the same WiFi.
```
