import { writeFileSync, readFileSync } from 'fs';
const P = JSON.parse(readFileSync('patterns.json', 'utf8'));

const INK = '#0b0c0e';      // the panel's own canvas colour, lifted from the code
const PAPER = '#f2f1ed';
const CRIT = '#e5484d';
const TONES = ['#0b0c0e', '#4a4a4a', '#9a9a96', '#f2f1ed'];

/** 8x8, full bleed, no gaps. crispEdges so cells never soften into each other. */
const mark = (cells, { on = PAPER, off = 'none', tonal = false, accent = null } = {}) => {
  let r = '';
  cells.forEach((v, i) => {
    const x = i % 8, y = (i / 8) | 0;
    const fill = accent === i ? CRIT : tonal ? TONES[v] : v ? on : off;
    if (fill === 'none') return;
    r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`;
  });
  return `<svg viewBox="0 0 8 8" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${r}</svg>`;
};

const box = (svg, size, bg) =>
  `<div style="width:${size}px;height:${size}px;background:${bg};display:block">${svg.replace('<svg', `<svg width="${size}" height="${size}"`)}</div>`;

const page = (body, bg, extra = '') => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;600&family=Space+Mono:wght@700&display=swap');
    body { margin: 0; font-family: Archivo, "Helvetica Neue", Helvetica, sans-serif; background: ${bg}; }
    a { color: ${CRIT}; } a:hover { color: #c13438; }
    .wm { font-family: "Archivo Black", "Helvetica Neue", "Arial Black", sans-serif; letter-spacing: -0.035em; line-height: 0.92; }
    .mono { font-family: "Space Mono", ui-monospace, "SF Mono", Menlo, monospace; font-weight: 700; letter-spacing: -0.04em; }
    .lab { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; }
    ${extra}
  </style>
</helmet>
${body}
</x-dc>
</body>
</html>`;

// ---------- Main: the leading lockup ----------
writeFileSync('Main.dc.html', page(`
<div style="display:flex;flex-direction:column;justify-content:space-between;height:560px;box-sizing:border-box;padding:64px">
  <div style="display:flex;align-items:center;gap:36px">
    ${box(mark(P.balanced), 132, INK)}
    <div class="wm" style="color:${PAPER};font-size:76px">noise<br/>is bad.</div>
  </div>
  <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:24px">
    <div style="display:flex;align-items:center;gap:18px">
      ${box(mark(P.balanced), 44, INK)}
      <div class="wm" style="color:${PAPER};font-size:30px">noise is bad.</div>
    </div>
    <div class="lab" style="color:#6a6a68;text-align:right">8&times;8 static<br/>Archivo Black</div>
  </div>
</div>`, INK));

// ---------- Marks: six treatments ----------
const marks = [
  ['A', 'Balanced static', 'Even 32 of 64. The default — reads as noise at every size.', mark(P.balanced)],
  ['B', 'Sparse', 'Lighter, calmer. Holds up small but reads less like static.', mark(P.sparse)],
  ['C', 'Dense', 'Heavier, more aggressive. Can clog below about 20px.', mark(P.dense)],
  ['D', 'Four-tone', 'Closer to real CRT static. Richer large, muddier small.', mark(P.tonal, { tonal: true })],
  ['E', 'Resolving', 'Noisy at the top, quiet at the bottom — what the panel actually does.', mark(P.resolving)],
  ['F', 'One critical', 'Balanced static with a single red cell. The one problem.', mark(P.balanced, { accent: 27 })],
];
writeFileSync('Marks.dc.html', page(`
<div style="padding:56px;box-sizing:border-box">
  <div class="wm" style="color:${PAPER};font-size:34px;margin-bottom:8px">Six marks</div>
  <div style="color:#8a8a86;font-size:14px;max-width:560px;margin-bottom:40px">All 8&times;8, full bleed, no gaps. Each is a fixed pattern, not random at runtime, so whichever you pick stays that pattern forever.</div>
  <div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:40px">
    ${marks.map(([k, name, note, svg]) => `<div style="display:flex;flex-direction:column;gap:14px">
      ${box(svg, 168, INK)}
      <div><span class="wm" style="color:${PAPER};font-size:17px">${k}. ${name}</span></div>
      <div style="color:#8a8a86;font-size:13px;line-height:1.45">${note}</div>
    </div>`).join('')}
  </div>
</div>`, INK));

// ---------- Lockups ----------
writeFileSync('Lockups.dc.html', page(`
<div style="padding:56px;box-sizing:border-box;display:flex;flex-direction:column;gap:48px">
  <div class="wm" style="color:${PAPER};font-size:34px">Lockups</div>
  <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:48px">
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="lab" style="color:#6a6a68">Horizontal</div>
      <div style="display:flex;align-items:center;gap:20px">${box(mark(P.balanced), 64, INK)}<div class="wm" style="color:${PAPER};font-size:42px">noise is bad.</div></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="lab" style="color:#6a6a68">Stacked</div>
      <div style="display:flex;flex-direction:column;gap:18px;align-items:flex-start">${box(mark(P.balanced), 64, INK)}<div class="wm" style="color:${PAPER};font-size:34px">noise<br/>is bad.</div></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="lab" style="color:#6a6a68">Monospace wordmark</div>
      <div style="display:flex;align-items:center;gap:20px">${box(mark(P.balanced), 64, INK)}<div class="mono" style="color:${PAPER};font-size:36px">noise is bad.</div></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="lab" style="color:#6a6a68">Mark alone &mdash; what Grafana shows</div>
      <div style="display:flex;align-items:center;gap:20px">${box(mark(P.balanced), 64, INK)}${box(mark(P.balanced, { on: INK, off: PAPER }), 64, PAPER)}</div>
    </div>
  </div>
</div>`, INK));

// ---------- Sizes: the decisive test ----------
const sizes = [128, 64, 48, 32, 24, 16];
writeFileSync('Sizes.dc.html', page(`
<div style="padding:56px;box-sizing:border-box;display:flex;flex-direction:column;gap:40px">
  <div>
    <div class="wm" style="color:${PAPER};font-size:34px;margin-bottom:8px">At the sizes it will actually be seen</div>
    <div style="color:#8a8a86;font-size:14px;max-width:620px">Grafana draws a plugin logo at about 24 to 40px in its lists. That, not the big version, is the test a logo has to pass.</div>
  </div>
  <div style="display:flex;flex-direction:column;gap:14px">
    <div class="lab" style="color:#6a6a68">On dark</div>
    <div style="display:flex;align-items:flex-end;gap:28px">
      ${sizes.map((s) => `<div style="display:flex;flex-direction:column;gap:8px;align-items:center">${box(mark(P.balanced), s, INK)}<div class="lab" style="color:#6a6a68">${s}</div></div>`).join('')}
    </div>
  </div>
  <div style="display:flex;flex-direction:column;gap:14px;background:${PAPER};padding:28px;margin:0 -28px">
    <div class="lab" style="color:#6a6a68">On light</div>
    <div style="display:flex;align-items:flex-end;gap:28px">
      ${sizes.map((s) => `<div style="display:flex;flex-direction:column;gap:8px;align-items:center">${box(mark(P.balanced, { on: INK, off: PAPER }), s, PAPER)}<div class="lab" style="color:#6a6a68">${s}</div></div>`).join('')}
    </div>
  </div>
  <div style="display:flex;flex-direction:column;gap:14px">
    <div class="lab" style="color:#6a6a68">Four-tone, same sizes &mdash; where it muddies</div>
    <div style="display:flex;align-items:flex-end;gap:28px">
      ${sizes.map((s) => `<div style="display:flex;flex-direction:column;gap:8px;align-items:center">${box(mark(P.tonal, { tonal: true }), s, INK)}<div class="lab" style="color:#6a6a68">${s}</div></div>`).join('')}
    </div>
  </div>
</div>`, INK));

// ---------- In place ----------
writeFileSync('InPlace.dc.html', page(`
<div style="padding:56px;box-sizing:border-box;display:flex;flex-direction:column;gap:40px">
  <div class="wm" style="color:${PAPER};font-size:34px">In place</div>
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="lab" style="color:#6a6a68">Grafana's visualisation picker</div>
    <div style="background:#181b1f;border:1px solid #2e3136;padding:6px;display:flex;flex-direction:column;gap:2px;max-width:420px">
      ${[['Time series', false], ['Noise Is Bad', true], ['Stat', false]].map(([n, me]) => `<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:${me ? '#23262b' : 'transparent'}">
        ${me ? box(mark(P.balanced), 28, INK) : `<div style="width:28px;height:28px;background:#2e3136"></div>`}
        <div style="color:${me ? PAPER : '#9a9a96'};font-size:14px;font-weight:${me ? 600 : 400}">${n}</div>
      </div>`).join('')}
    </div>
  </div>
  <div style="display:flex;gap:48px;flex-wrap:wrap">
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="lab" style="color:#6a6a68">Browser tab</div>
      <div style="display:flex;align-items:center;gap:10px;background:#23262b;padding:9px 14px;max-width:260px">
        ${box(mark(P.balanced), 16, INK)}<div style="color:#c8c8c4;font-size:13px">Noise Is Bad</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="lab" style="color:#6a6a68">README header</div>
      <div style="display:flex;align-items:center;gap:14px">${box(mark(P.balanced), 40, INK)}<div class="wm" style="color:${PAPER};font-size:26px">noise is bad.</div></div>
    </div>
  </div>
</div>`, INK));

console.log('wrote 5 artboards');
