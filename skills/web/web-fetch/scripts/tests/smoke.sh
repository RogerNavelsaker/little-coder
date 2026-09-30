#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
search="./skills/web/web-search/scripts/search.nu"
fetch="$root/scripts/bin/fetch.nu"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

nu "$search" 'IANA example domain' --format json --timeout 30 >"$tmp/search.json"
test -s "$tmp/search.json"
grep -q 'iana.org' "$tmp/search.json"
nu "$fetch" 'https://www.iana.org/domains/example' --output "$tmp/page.md" --timeout 30 --retries 1
test -s "$tmp/page.md"
grep -q 'example domains' "$tmp/page.md"
if nu "$fetch" 'https://invalid.example.invalid/' --output "$tmp/fail.md" --timeout 5 --retries 0 >/dev/null 2>&1; then
  echo 'expected invalid fetch to fail' >&2
  exit 1
fi
printf '%s\n' 'web retrieval smoke tests passed'
