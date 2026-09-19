// Deterministic 8x8 static. Seeded so a chosen mark is reproducible forever.
const rng = (seed) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

const grid = (seed, density = 0.5, tones = 2) => {
  const r = rng(seed);
  return Array.from({ length: 64 }, () => {
    if (tones === 2) return r() < density ? 1 : 0;
    const v = r();
    return v < density ? Math.min(tones - 1, 1 + Math.floor(r() * (tones - 1))) : 0;
  });
};

// A good static block is evenly spread: no empty quadrant, no empty row or column,
// and close to the intended density. Score seeds rather than trusting one.
const score = (g) => {
  const on = g.filter(Boolean).length;
  const rows = Array.from({ length: 8 }, (_, y) => g.slice(y * 8, y * 8 + 8).filter(Boolean).length);
  const cols = Array.from({ length: 8 }, (_, x) => [0,1,2,3,4,5,6,7].filter(y => g[y * 8 + x]).length);
  const quad = [0,1,2,3].map(q => {
    const ox = (q % 2) * 4, oy = Math.floor(q / 2) * 4;
    let n = 0; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (g[(oy+y)*8 + ox+x]) n++;
    return n;
  });
  const spread = (a) => Math.max(...a) - Math.min(...a);
  return { on, penalty: spread(rows) + spread(cols) + spread(quad) * 2 + Math.abs(on - 32),
           dead: rows.includes(0) || cols.includes(0) };
};

let best = null;
for (let s = 1; s < 60000; s++) {
  const g = grid(s, 0.5, 2), sc = score(g);
  if (sc.dead) continue;
  if (!best || sc.penalty < best.sc.penalty) best = { s, g, sc };
}
console.log('best 2-tone seed', best.s, 'cells on:', best.sc.on, 'penalty:', best.sc.penalty);
console.log(JSON.stringify(best.g));

// A few more, deliberately different in character.
const picks = {};
for (const [name, seed, d, t] of [['balanced', best.s, 0.5, 2], ['sparse', 7, 0.34, 2], ['dense', 21, 0.66, 2]]) {
  picks[name] = grid(seed, d, t);
}
// Four-tone CRT static: richer up close, still reads as noise small.
picks.tonal = grid(1337, 0.82, 4);
// Noise resolving into quiet: dense at the top, clear at the bottom. The product in one mark.
{
  const r = rng(99); const g = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) g.push(r() < (1 - y / 7) * 0.92 ? 1 : 0);
  picks.resolving = g;
}
(await import('fs')).writeFileSync('patterns.json', JSON.stringify(picks, null, 1));
