#!/usr/bin/env bash
# Cut a release: bump version, build, tag, push, attach .dmg to a GitHub Release.
#
# Usage:
#   npm run release -- 0.1.1
#
# Assumes:
#   - working tree is clean (or you intend to commit version bumps)
#   - `gh` is authenticated against this repo
#   - you're on Apple Silicon (the only architecture we ship)
set -euo pipefail

cd "$(dirname "$0")/.."

export PATH="$HOME/.cargo/bin:$PATH"

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "Usage: npm run release -- <version>   e.g. 0.1.1" >&2
  exit 1
fi

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "✗ Version must be semver like 0.1.1, got: $VERSION" >&2
  exit 1
fi

TAG="v${VERSION}"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "✗ Tag $TAG already exists" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "✗ Working tree is dirty. Commit or stash first." >&2
  git status --short
  exit 1
fi

echo "→ Bumping version to $VERSION in package.json, Cargo.toml, tauri.conf.json…"
# package.json
node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json','utf8')); p.version='$VERSION'; fs.writeFileSync('package.json', JSON.stringify(p,null,2)+'\n');"
# tauri.conf.json
node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json','utf8')); p.version='$VERSION'; fs.writeFileSync('src-tauri/tauri.conf.json', JSON.stringify(p,null,2)+'\n');"
# Cargo.toml — replace the first `version = "..."` line under [package]
python3 - <<PY
import re, pathlib
path = pathlib.Path("src-tauri/Cargo.toml")
text = path.read_text()
text = re.sub(r'(?m)^version = "[^"]+"', f'version = "$VERSION"', text, count=1)
path.write_text(text)
PY

# Also update Cargo.lock so it doesn't drift.
( cd src-tauri && cargo update -p minimaltask --offline 2>/dev/null || true )

echo "→ Committing version bump…"
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock 2>/dev/null || true
git commit -m "release: $TAG"

echo "→ Building release bundle…"
npm run tauri build

DMG_PATH=$(ls src-tauri/target/release/bundle/dmg/minimaltask_*_aarch64.dmg | head -1)
if [ ! -f "$DMG_PATH" ]; then
  echo "✗ DMG not found in src-tauri/target/release/bundle/dmg/" >&2
  exit 1
fi

# Stable filename copy so /releases/latest/download/MinimalTask.dmg always resolves.
STABLE_DMG="src-tauri/target/release/bundle/dmg/MinimalTask.dmg"
cp "$DMG_PATH" "$STABLE_DMG"

echo "→ Tagging $TAG and pushing…"
git tag "$TAG"
git push origin HEAD
git push origin "$TAG"

echo "→ Creating GitHub release with $DMG_PATH…"
NOTES=$(cat <<EOF
MinimalTask $TAG

**Apple Silicon only** (M1/M2/M3/M4 Macs). Intel Macs are not supported.

## Install
1. Download \`minimaltask_${VERSION}_aarch64.dmg\` below.
2. Open it, drag MinimalTask to /Applications.
3. First launch: right-click the app → Open (the app is unsigned, so macOS Gatekeeper will warn once).

Updates: re-download a newer .dmg and drag it over the existing /Applications/minimaltask.app.
EOF
)

gh release create "$TAG" "$DMG_PATH" "$STABLE_DMG" \
  --title "MinimalTask $TAG" \
  --notes "$NOTES"

echo "✓ Released $TAG"
gh release view "$TAG" --web 2>/dev/null || true
