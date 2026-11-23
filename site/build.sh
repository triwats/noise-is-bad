#!/usr/bin/env bash
# Assembles the project site into _site/, or into $SITE_OUT when set. The public
# server builds it that way and serves it at the root of noiseisbad.triwats.com
# (see deploy/build-site.sh).
#
# site/ holds only what is written by hand. Everything else is taken from where it
# already lives, so the site can never show a different mark, font or clip from the
# plugin and README: the lockups and logo that design/brand/generate.py writes, the
# Archivo Black subset it embeds in brandData.ts, and the README's demo recordings,
# re-encoded as video because the GIFs are 6-8 MB each.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
out="${SITE_OUT:-$root/_site}"

# Empty it rather than remove it: on the server it is a mounted volume.
mkdir -p "$out"
find "$out" -mindepth 1 -delete
mkdir -p "$out/media"

cp "$root"/site/index.html "$root"/site/style.css "$out/"
cp "$root"/docs/brand/lockup-light.svg "$root"/docs/brand/lockup-dark.svg "$out/media/"
cp "$root"/src/img/logo.svg "$out/media/logo.svg"
cp "$root"/src/render/fonts/OFL.txt "$out/media/archivo-black-OFL.txt"

# The font is a data URI inside generated TypeScript; lift the bytes straight out.
node -e '
  const src = require("fs").readFileSync(process.argv[1], "utf8");
  const m = src.match(/BRAND_FONT_WOFF2 = .data:font\/woff2;base64,([A-Za-z0-9+\/=]+)/);
  if (!m) { console.error("BRAND_FONT_WOFF2 not found in brandData.ts"); process.exit(1); }
  require("fs").writeFileSync(process.argv[2], Buffer.from(m[1], "base64"));
' "$root/src/render/brandData.ts" "$out/media/archivo-black.woff2"

# Each clip with the moment its poster frame is taken from: the incident at its widest
# for the demo, which is also the image a shared link shows, and the logo mid-flight.
for entry in noise-is-bad:20 dvd-screensaver:3; do
  clip="${entry%%:*}"
  at="${entry##*:}"
  gif="$root/demo/recording/$clip.gif"
  # Even dimensions are a requirement of yuv420p, which is what every browser decodes.
  scale='scale=trunc(iw/2)*2:trunc(ih/2)*2'
  ffmpeg -loglevel error -y -i "$gif" -vf "$scale" -c:v libx264 -pix_fmt yuv420p \
    -preset slow -crf 20 -movflags +faststart -an "$out/media/$clip.mp4"
  ffmpeg -loglevel error -y -i "$gif" -vf "$scale" -c:v libvpx-vp9 -pix_fmt yuv420p \
    -b:v 0 -crf 34 -row-mt 1 -an "$out/media/$clip.webm"
  ffmpeg -loglevel error -y -ss "$at" -i "$gif" -frames:v 1 "$out/media/$clip.png"
done

echo "Site assembled in $out"
