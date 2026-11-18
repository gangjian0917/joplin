#!/usr/bin/env bash
# Build the Joplin desktop app for this Apple Silicon Mac.
# The .app is written to the parent of this repository.
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SRC/.." && pwd)"
DESKTOP="$SRC/packages/app-desktop"
PKG="$DESKTOP/package.json"
OUT_APP="$ROOT/Joplin.app"

export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"
export CSC_IDENTITY_AUTO_DISCOVERY=false
export npm_config_arch=arm64
export npm_config_target_arch=arm64
export USE_HARD_LINKS=false
export PYTHON_PATH="$(command -v python3)"

if [[ ! -f "$PKG" ]]; then
	echo "找不到桌面工程：$DESKTOP" >&2
	exit 1
fi
if ! command -v yarn >/dev/null 2>&1; then
	echo "找不到 yarn。先执行：corepack enable yarn --install-directory \"\$HOME/.local/bin\"" >&2
	exit 1
fi
if ! pkg-config --exists pangocairo; then
	echo "缺少 pango。先执行：brew install pango pkg-config" >&2
	exit 1
fi

PKG_BAK=""
restore_pkg() {
	if [[ -n "$PKG_BAK" && -f "$PKG_BAK" ]]; then
		mv "$PKG_BAK" "$PKG"
		PKG_BAK=""
	fi
}
trap restore_pkg EXIT

if [[ ! -d "$DESKTOP/node_modules/electron" ]]; then
	echo "依赖未安装，先执行 yarn install"
	(cd "$SRC" && yarn install)
fi

PKG_BAK="$(mktemp)"
cp "$PKG" "$PKG_BAK"

cd "$DESKTOP"
npm pkg set 'build.mac.artifactName'='${productName}-${version}-${arch}.${ext}'
npm pkg delete 'build.mac.target'
npm pkg set 'build.mac.target[0].target'='dmg' 'build.mac.target[0].arch[0]'='arm64'
npm pkg set 'build.mac.target[1].target'='zip' 'build.mac.target[1].arch[0]'='arm64'
npm pkg set 'build.mac.identity'=null --json

echo "开始编译 arm64 正式包"
PYTHON_PATH="$PYTHON_PATH" yarn dist --mac --arm64 --publish=never

APP_SRC="$DESKTOP/dist/mac-arm64/Joplin.app"
if [[ ! -d "$APP_SRC" ]]; then
	echo "没有找到编译结果：$APP_SRC" >&2
	exit 1
fi

rm -rf "$OUT_APP"
ditto "$APP_SRC" "$OUT_APP"
xattr -cr "$OUT_APP"

DMG_SRC="$(find "$DESKTOP/dist" -maxdepth 1 -name 'Joplin-*-arm64.dmg' -print 2>/dev/null | xargs ls -t 2>/dev/null | head -n 1)"
if [[ -n "$DMG_SRC" ]]; then
	cp -f "$DMG_SRC" "$ROOT/$(basename "$DMG_SRC")"
	echo "DMG: $ROOT/$(basename "$DMG_SRC")"
fi

echo "APP: $OUT_APP"
