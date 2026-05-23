# MinimalTask

A local-first, single-user desktop task timer in the Blitzit shape. Flat list, blitz one task at a time, log the time, look at the data later.

Read `/Users/yuann/Powerhouse/agent/RULES.md` and `SOUL.md` at session start (already enforced by the parent project).

---

## Stack

- **Shell**: Tauri 2 (Rust)
- **UI**: React 18 + TypeScript + Vite
- **Storage**: SQLite via `tauri-plugin-sql` (single file in app data dir)
- **Styling**: Tailwind CSS (planned, not yet installed)
- **State**: local SQLite as source of truth; React state for ephemeral UI only

No icons. No icon libraries. Affordances come from typography, spacing, and color. See DESIGN.md.

## Layout

```
src/                React UI (entry: main.tsx, App.tsx)
src-tauri/          Rust shell (tauri.conf.json, Cargo.toml, src/main.rs)
src-tauri/migrations/  SQL schema (slice 2)
public/             static assets
DESIGN.md           visual system
CLAUDE.md           this file
```

## Data model (planned, slice 2)

```sql
tasks
  id            INTEGER PK
  title         TEXT NOT NULL
  note          TEXT
  tag           TEXT
  estimated_minutes INTEGER
  status        TEXT  -- 'backlog' | 'today' | 'done'
  position      REAL  -- fractional for drag-reorder
  created_at    INTEGER
  completed_at  INTEGER

sessions        -- multiple per task, supports stop/resume across days
  id            INTEGER PK
  task_id       INTEGER FK
  started_at    INTEGER
  ended_at      INTEGER
  duration_sec  INTEGER
  ended_reason  TEXT  -- 'stop' | 'complete' | 'app_quit'
```

Task `actual_minutes` = `SUM(sessions.duration_sec) / 60` across all sessions for the task. A task is done only when explicitly completed; stopping just ends the current session and leaves the task in Today.

## Timer states

```
idle ──start──> running ──stop──> paused ──resume──> running
                  │                  │
                  └──complete────────┴──> done
```

App quit while running closes the open session with `ended_reason='app_quit'`. No orphan sessions.

## Build slices

1. **Scaffold** ✅ (Tauri 2 + React + TS, git init, this doc)
2. **SQLite + migrations** — schema, repository functions, dev seed
3. **Main window v1** — Today list, add/edit/delete, drag-reorder, tag + `30m` shorthand
4. **Timer v1** — start/stop/resume/complete, overage color, persistence across app restarts
5. **Tray** — icon, dropdown menu, currently-running indicator, quick start, global hotkey
6. **Backlog + Done views** — second and third routes
7. **Polish** — design review, keyboard shortcuts, app icon, dock behavior
8. **Dogfood 1 week**, then v0.2 analytics

## Commands

```bash
npm run dev          # Vite dev server only
npm run tauri dev    # Tauri shell + Vite (full app, first run compiles Rust ~5min)
npm run build        # Vite production build
npm run tauri build  # full app bundle
```

## Conventions

- Surgical changes only. Match existing style.
- No demo data with real client names. Seed data is fully invented.
- Commit per slice. QA before commit (build → lint → manual check → commit).
- Tray menu and main window stay in sync via a shared store backed by SQLite.
- All time stored as Unix seconds (INTEGER) in SQLite. Format at the UI layer.

## Out of scope (forever, not just MVP)

- Categories, projects, nested grouping
- Sync, cloud, accounts, multi-device
- Recurring tasks
- Mobile
- Calendar/email integration
- AI features

The whole point is that this stays minimal.
