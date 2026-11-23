#!/bin/sh
# Puts the noise is bad. panel into the shared plugins volume before Grafana
# starts. Runs in a throwaway alpine container (see compose.yaml).
#
# Downloads once per version. On every later start it finds the version stamp
# and exits without touching the network, so a GitHub outage cannot stop the
# demo from coming back after a reboot.
#
#   PLUGIN_VERSION   release to install, e.g. 1.0.0. "local" skips the download
#                    (compose.local.yaml mounts ../dist instead).
#   PLUGIN_URL       optional; overrides the GitHub release URL.
#   PLUGIN_SHA256    optional; when set, the zip must match it.
set -eu

ID=triwats-noiseisbad-panel
DEST=/plugins
VERSION="${PLUGIN_VERSION:?set PLUGIN_VERSION in .env}"

if [ "$VERSION" = "local" ]; then
  echo "PLUGIN_VERSION=local: not downloading, expecting a mounted dist/"
  exit 0
fi

URL="${PLUGIN_URL:-https://github.com/triwats/noise-is-bad/releases/download/v$VERSION/$ID-$VERSION.zip}"
STAMP="$DEST/.$ID.source"
WANT="$VERSION $URL"

if [ -f "$DEST/$ID/plugin.json" ] && [ "$(cat "$STAMP" 2>/dev/null)" = "$WANT" ]; then
  echo "$ID $VERSION already installed"
  exit 0
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "downloading $URL"
wget -q -O "$TMP/plugin.zip" "$URL"

if [ -n "${PLUGIN_SHA256:-}" ]; then
  echo "$PLUGIN_SHA256  $TMP/plugin.zip" | sha256sum -c -
fi

unzip -q "$TMP/plugin.zip" -d "$TMP/x"
if [ ! -f "$TMP/x/$ID/plugin.json" ]; then
  echo "zip does not contain $ID/plugin.json" >&2
  exit 1
fi
if ! grep -q "\"version\": *\"$VERSION\"" "$TMP/x/$ID/plugin.json"; then
  echo "zip is not version $VERSION:" >&2
  grep '"version"' "$TMP/x/$ID/plugin.json" >&2
  exit 1
fi

# Swap in the new copy whole, so Grafana never sees half a plugin.
rm -rf "$DEST/$ID.new"
mv "$TMP/x/$ID" "$DEST/$ID.new"
rm -rf "$DEST/$ID"
mv "$DEST/$ID.new" "$DEST/$ID"
echo "$WANT" > "$STAMP"
echo "installed $ID $VERSION"
