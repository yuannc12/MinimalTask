# MinimalTask

A local-first, single-user desktop task timer in the Blitzit shape. Flat list, blitz one task at a time, log the time, look at the data later.

No accounts. No sync. No cloud. Your data lives in one SQLite file on your Mac.

## What it does

- **Today / Backlog / Done** — three flat lists, nothing nested
- **Per-task timer** — start, stop (resume later), or complete. Multiple sessions per task are summed
- **Tags** — lightweight `#tag` filtering on the backlog
- **Estimates** — type `30m` in the input to attach an estimate; the header shows worked / estimated and turns orange when you go over
- **Menu bar tray** — start any "Today" task from the macOS menu bar without opening the window. Shows the running task and elapsed time
- **Global hotkey** — `Cmd+Shift+Space` brings the window forward from anywhere
- **Window shortcuts** — `Cmd+1` Today, `Cmd+2` Backlog, `Cmd+3` Done, `Cmd+B` toggle sidebar

## Install

Apple Silicon (M1/M2/M3/M4) only. The app is unsigned (no Apple Developer account), so macOS will warn you the first time.

1. Download the latest `minimaltask_<version>_aarch64.dmg` from [Releases](https://github.com/yuannc12/MinimalTask/releases).
2. Open the .dmg, drag **MinimalTask** to `/Applications`.
3. **First launch only:** right-click the app in `/Applications` → **Open** → confirm. macOS will remember the choice; subsequent launches work normally.

To update: download a newer .dmg and drag it over the existing install. No auto-updater.

Your data lives at `~/Library/Application Support/cc.yuann.minimaltask/minimaltask.db`. Uninstalling the app does not delete it.

## Build from source

Requires Node 20+, Rust (stable), Xcode Command Line Tools.

```bash
git clone https://github.com/yuannc12/MinimalTask.git
cd MinimalTask
npm install
npm run tauri dev          # dev shell (first run compiles Rust, ~5 min)
npm run tauri build        # release .app + .dmg in src-tauri/target/release/bundle/
```

Other scripts:

```bash
npm run install:local      # build and install to /Applications, then launch
npm run release -- 0.1.1   # bump version, build, tag, push, attach .dmg to a GitHub Release (requires gh auth)
```

## Stack

- **Shell:** Tauri 2 (Rust)
- **UI:** React 19 + TypeScript + Vite
- **Storage:** SQLite via `tauri-plugin-sql`
- **No icon libraries.** Affordances come from typography and spacing — see [DESIGN.md](DESIGN.md).

## Layout

```
src/                React UI (App.tsx entry)
  components/         task list, rows, sidebar, details, tag filter
  db/                 SQLite client, tasks/sessions queries, dev seed
  lib/                timer hook, input parser, tray bridge
src-tauri/          Rust shell (tray, global shortcut, SQL migrations)
  src/lib.rs          tray menu + shortcut wiring
  migrations/         schema
scripts/            install-local.sh, release.sh
DESIGN.md           visual system
CLAUDE.md           internal project guide
```

## Scope

What it will never grow: categories, projects, nested grouping, sync, cloud, accounts, recurring tasks, mobile, calendar/email integration, AI features.

The whole point is that this stays minimal.

## License

MIT.
