#!/usr/bin/env bash
# Builds the project site into the shared volume Caddy serves at /. Runs in the
# throwaway `site` container (see compose.yaml) before Caddy starts.
#
# Skips the build when nothing the site is made from has changed since the last
# one. When something has, site/build.sh still reuses the encoded clips unless
# the recordings themselves changed, which is the part that takes minutes.
set -euo pipefail

repo=/repo
out=/site
stamp="$out/.built-from"

# Everything site/build.sh reads.
inputs=(
  README.md
  site
  docs/brand/sponsor.gif
  docs/brand/lockup-light.svg
  docs/brand/lockup-dark.svg
  src/img/logo.svg
  src/render/fonts/OFL.txt
  src/render/brandData.ts
  demo/recording/noise-is-bad.gif
  demo/recording/dvd-screensaver.gif
)

want=$(cd "$repo" && find "${inputs[@]}" -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1)

if [ -f "$out/index.html" ] && [ "$(cat "$stamp" 2>/dev/null)" = "$want" ]; then
  echo "site unchanged since the last build"
  exit 0
fi

echo "building the site"
SITE_OUT="$out" bash "$repo/site/build.sh"
echo "$want" > "$stamp"
