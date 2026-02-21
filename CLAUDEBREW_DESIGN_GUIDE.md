# ClaudeBrew — Design Guide

**Version 1.0 — February 2026**

---

## Brand Identity

ClaudeBrew is warm, technical, and unhurried. It blends coffee culture with developer tooling.

**Tagline:** Brewing answers while you brew coffee

**Three pillars:**

- **Warmth** — Coffee-inspired earth tones, cozy and approachable
- **Intelligence** — Claude sparkle (✦) as rising steam, AI working in the background
- **Simplicity** — One screen, one purpose, zero friction

---

## App Icon

Coffee cup (☕) with Claude sparkle (✦) as rising steam. Amber gradient on dark background for shelf presence.

| Variant | Background                     | Cup        | Steam        |
| ------- | ------------------------------ | ---------- | ------------ |
| Primary | `#D4943A` → `#E8AA4A` gradient | White      | White ✦      |
| Dark    | `#2A1F17`                      | Amber      | Amber ✦      |
| Light   | `#F5E6D3`                      | Dark brown | Dark brown ✦ |

---

## Color Palette

### Brew — Backgrounds & Surfaces

| Token        | Hex       | Usage                               |
| ------------ | --------- | ----------------------------------- |
| Brew Dark    | `#1C1410` | App background                      |
| Brew Rich    | `#2A1F17` | Cards, screens                      |
| Brew Medium  | `#3D2E23` | Message bubbles (Claude), input bar |
| Brew Surface | `#4A382B` | Borders, dividers                   |
| Brew Muted   | `#6B5444` | Disabled states                     |

### Crema — Text & Highlights

| Token       | Hex       | Usage                  |
| ----------- | --------- | ---------------------- |
| Crema Light | `#F5E6D3` | Primary text           |
| Crema       | `#E8D5BC` | Secondary text         |
| Crema Dark  | `#C4A882` | Muted text, timestamps |

### Claude — Accent & Actions

| Token        | Hex       | Usage                                          |
| ------------ | --------- | ---------------------------------------------- |
| Claude Amber | `#D4943A` | Primary buttons, accents, user message bubbles |
| Claude Gold  | `#E8AA4A` | Hover states, active highlights                |
| Claude Light | `#F0C87A` | Subtle glows                                   |

### Status

| Token     | Hex       | Usage                           |
| --------- | --------- | ------------------------------- |
| Connected | `#6BBF6A` | Connected state, success output |
| Waiting   | `#D4943A` | Waiting for answer (pulsing)    |
| Working   | `#5BA4D9` | Claude is processing            |
| Offline   | `#C75B4A` | Disconnected, errors            |

---

## Typography

### Fraunces (Serif) — Display

Used for brand name, headings, and personality moments (e.g. "enjoy your coffee" idle text).

| Weight     | Size | Usage                   |
| ---------- | ---- | ----------------------- |
| 700        | 28px | App title               |
| 600        | 20px | Screen headings         |
| 400 italic | 16px | Taglines, idle messages |

### DM Sans — Body

Used for messages, UI text, descriptions, and all general content.

| Weight | Size | Usage                          |
| ------ | ---- | ------------------------------ |
| 600    | 16px | Question text                  |
| 400    | 14px | Message body, descriptions     |
| 300    | 13px | Subtle labels, connection info |

### JetBrains Mono — Code & Meta

Used for terminal output, timestamps, status labels, and PIN codes.

| Weight | Size | Usage                                                |
| ------ | ---- | ---------------------------------------------------- |
| 500    | 13px | Terminal output lines                                |
| 400    | 12px | Code output, IP addresses                            |
| 400    | 10px | Timestamps, uppercase labels (letter-spacing: 1.5px) |

---

## Spacing Scale

8px base grid with named tokens.

| Token | Value |
| ----- | ----- |
| `xs`  | 4px   |
| `sm`  | 8px   |
| `md`  | 16px  |
| `lg`  | 24px  |
| `xl`  | 32px  |
| `2xl` | 48px  |
| `3xl` | 64px  |

---

## Border Radius

| Token  | Value | Usage                               |
| ------ | ----- | ----------------------------------- |
| `sm`   | 8px   | Quick reply buttons, small elements |
| `md`   | 12px  | Input bars, cards                   |
| `lg`   | 16px  | Message bubbles, panels             |
| `xl`   | 20px  | Phone screen containers             |
| `pill` | 100px | Status pills, badges                |

---

## Components

### Status Indicator

Pill shape with a colored dot and label. Dot pulses for `waiting` and `working` states.

- Background: status color at 12% opacity
- Text: status color at full opacity
- Dot: 8px circle with `box-shadow` glow, `1.5s ease-in-out infinite` pulse

### Message Bubbles

**Claude messages** — left-aligned, `Brew Medium` background with `Brew Surface` border. Sender label "✦ Claude Code" in `Claude Amber` using JetBrains Mono 10px. Bottom-left radius reduced to `4px`.

**User messages** — right-aligned, `Claude Amber` background with `Brew Dark` text. Bottom-right radius reduced to `4px`.

Both have timestamps in 10px muted text below the content.

### Quick Reply Buttons

Auto-detected from prompt patterns (Y/n, 1/2/3, Approve/Reject). Displayed as a row of equal-width buttons above the input bar.

- Background: `Brew Medium`
- Border: 1px `Brew Surface`
- Text: `Crema` in JetBrains Mono 13px
- Hover: border becomes `Claude Amber`, text becomes `Claude Gold`

### Terminal Output

Monospace output tail showing recent Claude Code activity. Dark background (`Brew Dark`) with colored lines:

- Default: `#8A7460` (muted)
- Success (✓): `#6BBF6A` (connected green)
- Info: `#5BA4D9` (working blue)

### Input Bar

`Brew Medium` background with `Brew Surface` border, `radius-md`. Contains text input and amber send button (▶). Visually faded (50% opacity) when no question is pending.

---

## Screens

### 1. Connect

- Centered layout with logo, brand name, tagline
- QR scanner area (dashed border placeholder)
- Manual IP input with JetBrains Mono
- Full-width "Connect" primary button

### 2. Question (Active)

- Header: brand name + status pill ("Waiting")
- Terminal output tail (collapsed, ~3 lines)
- Claude message bubble with question text
- Quick reply button row
- Input bar for custom responses

### 3. Working (Idle)

- Header: brand name + status pill ("Working")
- Terminal output tail (expanded, scrollable)
- Centered idle indicator: ☕ + "Claude is working... enjoy your coffee" in Fraunces italic
- Input bar faded/disabled

---

## Animation

| Moment            | Duration | Easing      | Description                                       |
| ----------------- | -------- | ----------- | ------------------------------------------------- |
| Button press      | 200ms    | ease-out    | Scale + color shift                               |
| Screen transition | 300ms    | ease-out    | Fade + slight slide                               |
| New question      | 300ms    | spring(0.5) | Slide up from bottom with bounce                  |
| Answer sent       | 200ms    | ease-out    | Bubble slides right + subtle glow                 |
| Status dot pulse  | 1.5s     | ease-in-out | Opacity 1 → 0.4 → 1 (infinite)                    |
| Steam animation   | 2.0s     | ease-in-out | TranslateY 0 → -6px, opacity 0.7 → 0.3 (infinite) |
| Idle coffee icon  | 2.0s     | ease-in-out | Gentle breathing scale 1 → 1.03                   |

---

## Do's & Don'ts

### Do

- Use warm, coffee-toned backgrounds
- Keep the interface minimal — one purpose per screen
- Use Claude Amber for primary actions and accents
- Show terminal output in JetBrains Mono
- Use Fraunces for brand moments and headings
- Animate status indicators (pulsing dots)
- Auto-detect quick replies from prompts
- Show the "enjoy your coffee" idle state
- Use generous padding inside message bubbles
- Keep the QR scan flow dead simple

### Don't

- Use cold blues or grays as primary backgrounds
- Add features that don't serve the core Q&A flow
- Use generic system fonts (Inter, SF Pro, Roboto)
- Show raw JSON or technical errors to the user
- Use purple gradients or typical "AI" aesthetics
- Overwhelm with animations — keep them subtle
- Force users to configure anything upfront
- Make the input bar prominent when there's no question
- Use bright white anywhere — warmest light is Crema
- Break the coffee metaphor with tech-bro language
