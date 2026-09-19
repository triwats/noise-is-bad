// Generates docs/brand/sponsor.gif: a banner of TV static around the words
// "Sponsor noise is bad. today", for the README's sponsorship section.
//
//     node design/brand/sponsor-gif.mjs
//
// Needs the playwright chromium that `make setup` installs, plus ffmpeg and
// gifsicle on the path. The output is committed, so nothing else ever needs them.
//
// The static is the brand's: square cells, ink or paper, nothing in between.
// It is seeded, so re-running the script rewrites the same file byte for byte.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/brand/sponsor.gif');

const WIDTH = 960;
const HEIGHT = 240;
const CELL = 12; // divides both edges, so the static never ends on a sliver
const FRAMES = 12;
const FPS = 12;
const INK = '#0b0c0e';
const PAPER = '#f2f1ed';

// The font is the one the panel embeds, read from the generated brand data so
// the banner cannot drift from the lockup.
const brandData = readFileSync(join(ROOT, 'src/render/brandData.ts'), 'utf8');
const font = brandData.match(/BRAND_FONT_WOFF2 = '([^']+)'/)[1];

const html = `<!doctype html>
<style>
  @font-face { font-family: Brand; src: url(${font}) format('woff2'); }
  html, body { margin: 0; background: ${INK}; }
  #stage { position: relative; width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
  canvas { position: absolute; inset: 0; }
  /* The plate sits on the cell grid, so the static frames it cleanly. */
  #plate {
    position: absolute; left: ${CELL * 4}px; right: ${CELL * 4}px; top: ${CELL * 5}px; bottom: ${CELL * 5}px;
    background: ${INK}; color: ${PAPER};
    display: flex; align-items: center; justify-content: center;
    font: 50px/1 Brand; letter-spacing: -0.035em; white-space: nowrap;
  }
</style>
<div id="stage">
  <canvas id="static" width="${WIDTH}" height="${HEIGHT}"></canvas>
  <div id="plate">Sponsor noise is bad. today</div>
</div>
<script>
  // mulberry32: small, seedable, and good enough for snow.
  const rng = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const ctx = document.getElementById('static').getContext('2d');
  window.draw = (frame) => {
    const next = rng(frame + 1);
    ctx.fillStyle = '${INK}';
    ctx.fillRect(0, 0, ${WIDTH}, ${HEIGHT});
    ctx.fillStyle = '${PAPER}';
    for (let y = 0; y < ${HEIGHT}; y += ${CELL}) {
      for (let x = 0; x < ${WIDTH}; x += ${CELL}) {
        if (next() < 0.5) ctx.fillRect(x, y, ${CELL}, ${CELL});
      }
    }
  };
</script>`;

const frames = mkdtempSync(join(tmpdir(), 'nib-sponsor-'));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  for (let i = 0; i < FRAMES; i++) {
    await page.evaluate((n) => window.draw(n), i);
    await page.locator('#stage').screenshot({ path: join(frames, `${String(i).padStart(2, '0')}.png`) });
  }
} finally {
  await browser.close();
}

// Two colours and their antialiasing: a tiny palette keeps the file small.
const raw = join(frames, 'raw.gif');
execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, '%02d.png'),
  '-filter_complex', '[0:v]split[a][b];[a]palettegen=max_colors=16:stats_mode=full[p];[b][p]paletteuse=dither=none',
  '-loop', '0', raw,
]);
execFileSync('gifsicle', ['-O3', raw, '-o', OUT]);
rmSync(frames, { recursive: true });
console.log(`wrote ${OUT}`);
