#!/usr/bin/env bash
# Build MinimalTask and install/replace it at /Applications/minimaltask.app.
# Use this when you want the built app available outside the dev shell.
set -euo pipefail

cd "$(dirname "$0")/.."

export PATH="$HOME/.cargo/bin:$PATH"

echo "→ Building release bundle…"
npm run tauri build

APP_SRC="src-tauri/target/release/bundle/macos/minimaltask.app"
APP_DST="/Applications/minimaltask.app"

if [ ! -d "$APP_SRC" ]; then
  echo "✗ Build artifact not found at $APP_SRC" >&2
  exit 1
fi

echo "→ Installing to $APP_DST…"
rm -rf "$APP_DST"
cp -R "$APP_SRC" "$APP_DST"

# Refresh LaunchServices so Spotlight + Dock pick up the new icon/version.
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
  -f "$APP_DST" >/dev/null 2>&1 || true

echo "→ Launching…"
# Kill any running instance so the new build replaces it cleanly.
pkill -x minimaltask 2>/dev/null || true
sleep 0.5
open "$APP_DST"

echo "✓ Installed and launched."
