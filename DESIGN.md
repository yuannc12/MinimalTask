# MinimalTask — Design System

Extremely simple. Light mode only. Mostly black and white. Two accents.

The reference for taste is the screenshot Yuann shared: hollow circle checkboxes, large light-weight section headings, generous whitespace, near-zero chrome. The IA is flatter than the reference — Today / Backlog / Done, not folders + lists.

---

## Color

| Token | Hex | Use |
|---|---|---|
| `bg` | `#FFFFFF` | app background |
| `bg-muted` | `#FAFAFA` | sidebar, tray |
| `ink` | `#111111` | primary text, active nav |
| `ink-2` | `#6B6B6B` | secondary text |
| `ink-3` | `#9A9A9A` | placeholder, inactive nav, est-time |
| `line` | `#ECECEC` | hairline dividers, checkbox border |
| `accent` | `#DEE780` | active/selected state, completed checkbox fill |
| `warn` | `#F38D68` | timer overage, running-timer pulse |

No other colors. No gradients. No shadows beyond a single optional `0 1px 0 rgba(0,0,0,.03)` for the running-task card.

## Typography

One sans family for everything: `Inter` with `system-ui` fallback. No serif, no mono in v1.

| Style | Size / Weight / Tracking | Use |
|---|---|---|
| `h1` | 28 / 400 / -0.01em | view title ("Today") |
| `body` | 15 / 400 / 0 | task title, default text |
| `body-emph` | 15 / 500 / 0 | running task title |
| `meta` | 13 / 400 / 0 | tag, estimate, durations |
| `nav` | 14 / 400 / 0 | sidebar items |
| `nav-active` | 14 / 500 / 0 | sidebar selected |
| `timer-hero` | 56 / 300 / -0.02em | hero timer digits |

Line-height: 1.5 for body, 1.2 for headings, 1 for timer digits.

## Spacing

Base unit 4px. Common: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`.

- View padding: `48px` top, `48px` left/right on main pane
- Sidebar width: `220px`
- Row height (task line): `40px`
- Vertical gap between tasks: `0` (rows are self-spaced)
- Section header → first row: `24px`

## Components

### Checkbox
- 18px circle, 1.5px `line` border, transparent fill
- Hover: border `ink-3`
- Done: filled `accent`, no checkmark glyph (no icons rule)
- Half-state (paused with sessions): half-filled `accent`

### Task row
```
○  Master speaking llama language       #lang  · 25m
```
- Checkbox · title · `meta` tag in `ink-3` · `· ` divider · estimate in `ink-3`
- Hover: row bg `bg-muted`
- Running: title weight 500, left border 2px `accent`, pulse on the `· 25m` block in `warn`

### View header
```
Today                            2h 15m / 8h 00m
```
- `h1` left, totals right in `meta` weight 400, `ink-2`
- Overage (worked > estimated) shows worked total in `warn`

### Sidebar
- `bg-muted` background
- Items vertically stacked, `nav` style, `ink-3` text by default
- Active item: `nav-active`, `ink` text, no chip or icon

### Timer hero (focus mode, optional later)
- Full-window takeover
- Task title in `body-emph` centered
- `timer-hero` digits below
- Stop button as `meta` text underline; Complete as a chip in `accent`

## Motion

- All transitions: `120ms ease-out`
- Pulse on running timer: 1.6s ease-in-out infinite, opacity 1 → 0.5 → 1
- No bouncy spring, no slide-in, no fades-on-mount

## What we never do

- Icons of any kind (no lucide, no heroicons, no emoji glyphs in UI)
- Dark mode (v1)
- AI-generated portraits or imagery
- Shadows beyond the one allowed above
- More than two colors of accent
- Animated illustrations
- Dense one-liners over elaborated layout
