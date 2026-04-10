#!/usr/bin/env bash
set -euo pipefail

# Package the extension into a zip suitable for "Load unpacked" in Chrome.
# Output: dist/aatranslator-<version>.zip containing a top-level
# aatranslator-<version>/ folder with manifest.json at its root.

cd "$(dirname "$0")/.."

VERSION=$(awk -F'"' '/"version":/ {print $4; exit}' manifest.json)
if [ -z "$VERSION" ]; then
  echo "error: could not read version from manifest.json" >&2
  exit 1
fi

NAME="aatranslator-${VERSION}"
STAGE="dist/${NAME}"
OUT="dist/${NAME}.zip"

mkdir -p dist
rm -rf "$STAGE" "$OUT"
mkdir -p "$STAGE"

cp manifest.json "$STAGE/"
cp -r icons _locales src "$STAGE/"
[ -f README.md ] && cp README.md "$STAGE/"
[ -f PRIVACY.md ] && cp PRIVACY.md "$STAGE/"
[ -f CHANGELOG.md ] && cp CHANGELOG.md "$STAGE/"

( cd dist && zip -rq "${NAME}.zip" "${NAME}" -x '*.DS_Store' )

rm -rf "$STAGE"

echo "Packaged: $OUT"
ls -lh "$OUT"
