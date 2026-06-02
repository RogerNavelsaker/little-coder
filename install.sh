#!/usr/bin/env bash
# little-coder installer
# Usage: curl -fsSL https://raw.githubusercontent.com/RogerNavelsaker/little-coder/main/install.sh | sh
# Or:    bash install.sh [--from-source] [--bin-dir ~/.local/bin]
set -euo pipefail

REPO="RogerNavelsaker/little-coder"
BIN_DIR="${LITTLE_CODER_BIN_DIR:-${HOME}/.local/bin}"
FROM_SOURCE=0
for arg in "$@"; do
  case $arg in
    --from-source) FROM_SOURCE=1 ;;
    --bin-dir=*)   BIN_DIR="${arg#*=}" ;;
    --bin-dir)     shift; BIN_DIR="$1" ;;
  esac
done

# ---- Detect platform ----
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
case "$ARCH" in
  x86_64)        ARCH=x64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *)
    echo "little-coder: unsupported arch $ARCH — try --from-source"
    FROM_SOURCE=1
    ;;
esac
case "$OS" in
  linux|darwin) ;;
  *)
    echo "little-coder: unsupported OS $OS — try --from-source"
    FROM_SOURCE=1
    ;;
esac

BINARY_ASSET="little-coder-${OS}-${ARCH}"

# ---- Fetch latest release tag ----
fetch_latest_tag() {
  curl -fsSL \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name"' | head -1 | cut -d'"' -f4
}

# ---- Install pre-built binary ----
install_binary() {
  local TAG="$1"
  local URL="https://github.com/${REPO}/releases/download/${TAG}/${BINARY_ASSET}"
  echo "  Downloading $BINARY_ASSET ($TAG)..."
  mkdir -p "$BIN_DIR"
  curl -fsSL "$URL" -o "$BIN_DIR/little-coder"
  chmod +x "$BIN_DIR/little-coder"
}

# ---- Build from source ----
build_from_source() {
  if ! command -v bun &>/dev/null; then
    echo "little-coder: bun required for --from-source. Install: https://bun.sh"
    exit 1
  fi
  if ! command -v git &>/dev/null; then
    echo "little-coder: git required for --from-source"
    exit 1
  fi
  local TMP
  TMP=$(mktemp -d)
  trap "rm -rf $TMP" EXIT
  echo "  Cloning repository..."
  git clone --depth=1 "https://github.com/${REPO}.git" "$TMP/little-coder"
  echo "  Installing dependencies..."
  (cd "$TMP/little-coder" && bun install --frozen-lockfile)
  echo "  Compiling binary..."
  (cd "$TMP/little-coder" && bun build --compile bin/little-coder.ts --outfile little-coder-bin)
  mkdir -p "$BIN_DIR"
  mv "$TMP/little-coder/little-coder-bin" "$BIN_DIR/little-coder"
  chmod +x "$BIN_DIR/little-coder"
}

# ---- Main ----
echo "Installing little-coder..."

if [ "$FROM_SOURCE" -eq 1 ]; then
  build_from_source
else
  TAG=$(fetch_latest_tag 2>/dev/null || echo "")
  if [ -z "$TAG" ]; then
    echo "  No release found — building from source..."
    build_from_source
  else
    install_binary "$TAG"
  fi
fi

echo "  Binary installed to $BIN_DIR/little-coder"

# ---- PATH check ----
if ! echo "$PATH" | tr ':' '\n' | grep -qx "$BIN_DIR"; then
  echo ""
  echo "  Add to your shell profile:"
  echo "    export PATH=\"\$PATH:$BIN_DIR\""
fi

# ---- Set up data dir ----
echo ""
echo "  Setting up data directory..."
"$BIN_DIR/little-coder" install

echo ""
echo "Done. Run: little-coder"
