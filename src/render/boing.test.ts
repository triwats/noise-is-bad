import {
  MAX_FRAME_PX,
  SEGMENTS,
  SHEET_COLUMNS,
  SPIN_FRAMES,
  SPIN_PERIOD,
  ballAt,
  facetsAt,
  frameOf,
  gridOf,
  roomOf,
  spinOfFrame,
} from './boing';

const room = roomOf(1920, 1080);
const sample = (fromMs: number, toMs: number, stepMs: number) => {
  const out = [];
  for (let t = fromMs; t <= toMs; t += stepMs) {
    out.push({ t, ...ballAt(t, room) });
  }
  return out;
};

describe('roomOf', () => {
  it('fits the grid and the floor on the stage, centred', () => {
    const { wall, floorDepth } = room;

    expect(wall.left).toBeGreaterThan(0);
    expect(wall.top).toBeGreaterThan(0);
    expect(wall.left + wall.width).toBeLessThan(1920);
    expect(wall.top + wall.height + floorDepth).toBeLessThan(1080);
    expect(wall.left).toBeCloseTo(1920 - (wall.left + wall.width));
  });

  it('keeps a square grid whatever the stage shape', () => {
    for (const [w, h] of [
      [1920, 1080],
      [800, 1200],
      [3000, 400],
    ]) {
      const r = roomOf(w, h);
      expect(r.wall.width / 16).toBeCloseTo(r.wall.height / 12);
    }
  });

  it('survives a stage with no size at all', () => {
    const empty = roomOf(0, 0);
    const ball = ballAt(5000, empty);

    expect([empty.radius, ball.x, ball.y, ball.spin].every(Number.isFinite)).toBe(true);
  });
});

describe('gridOf', () => {
  it('draws every wall line and the floor', () => {
    // 17 columns down the wall and 17 across the floor, 13 rows, 4 floor lines.
    expect(gridOf(room)).toHaveLength(17 + 17 + 13 + 4);
  });

  it('spreads the floor wider at the front than at the back', () => {
    const lines = gridOf(room);
    const front = lines[lines.length - 1];

    expect(front[2] - front[0]).toBeGreaterThan(room.wall.width);
  });
});

describe('ballAt', () => {
  const path = sample(0, 60_000, 16);

  it('keeps the whole ball inside the room', () => {
    for (const b of path) {
      expect(b.x - room.radius).toBeGreaterThanOrEqual(room.wall.left - 1e-6);
      expect(b.x + room.radius).toBeLessThanOrEqual(room.wall.left + room.wall.width + 1e-6);
      expect(b.y - room.radius).toBeGreaterThanOrEqual(room.wall.top - 1e-6);
      expect(b.y).toBeLessThanOrEqual(room.yFloor + 1e-6);
    }
  });

  it('reaches both side walls and turns round at each', () => {
    const near = (a: number, b: number) => Math.abs(a - b) < room.cell * 0.1;

    expect(path.some((b) => near(b.x, room.xMin))).toBe(true);
    expect(path.some((b) => near(b.x, room.xMax))).toBe(true);
    expect(new Set(path.map((b) => b.heading)).size).toBe(2);
  });

  it('bounces off the floor to the same height every time, for ever', () => {
    const lowest = (from: number) => Math.max(...sample(from, from + 1400, 5).map((b) => b.y));
    const highest = (from: number) => Math.min(...sample(from, from + 1400, 5).map((b) => b.y));
    const aWeekLater = 7 * 24 * 3600 * 1000;

    expect(lowest(0)).toBeCloseTo(room.yFloor, 0);
    expect(highest(0)).toBeCloseTo(room.yTop, 0);
    expect(lowest(aWeekLater)).toBeCloseTo(room.yFloor, 0);
    expect(highest(aWeekLater)).toBeCloseTo(room.yTop, 0);
  });

  it('spins the way it travels, so the spin reverses at the walls', () => {
    for (let i = 1; i < path.length; i++) {
      const [a, b] = [path[i - 1], path[i]];
      if (a.heading === b.heading) {
        expect(Math.sign(b.spin - a.spin) || a.heading).toBe(a.heading);
      }
    }
  });

  it('never jumps: position and spin are continuous, walls included', () => {
    for (let i = 1; i < path.length; i++) {
      const [a, b] = [path[i - 1], path[i]];
      expect(Math.abs(b.x - a.x)).toBeLessThan(room.cell);
      expect(Math.abs(b.y - a.y)).toBeLessThan(room.cell);
      expect(Math.abs(b.spin - a.spin)).toBeLessThan(0.1);
    }
  });

  it('is the same ball at the same moment, however it got there', () => {
    expect(ballAt(123_456, room)).toEqual(ballAt(123_456, room));
  });
});

describe('the sprite frames', () => {
  it('repeats the pattern every two segments, which is all the frames it needs', () => {
    expect(SPIN_PERIOD).toBeCloseTo((2 * 2 * Math.PI) / SEGMENTS);

    const colours = (spin: number) =>
      facetsAt(spin).map((f) => `${f.red} ${f.points[0].map((v) => v.toFixed(6))}`);
    expect(colours(0.1 + SPIN_PERIOD).sort()).toEqual(colours(0.1).sort());
  });

  it('maps any spin onto one of the frames, and each frame back onto its own', () => {
    for (let spin = -10; spin < 10; spin += 0.01) {
      const frame = frameOf(spin);
      expect(frame).toBeGreaterThanOrEqual(0);
      expect(frame).toBeLessThan(SPIN_FRAMES);
    }
    for (let frame = 0; frame < SPIN_FRAMES; frame++) {
      expect(frameOf(spinOfFrame(frame) + 1e-9)).toBe(frame);
    }
  });

  it('fits the sheet in the texture an older Raspberry Pi can hold', () => {
    expect(SHEET_COLUMNS * SHEET_COLUMNS).toBeGreaterThanOrEqual(SPIN_FRAMES);
    expect(SHEET_COLUMNS * MAX_FRAME_PX).toBeLessThanOrEqual(2048);
  });
});

describe('facetsAt', () => {
  const facets = facetsAt(0.3);

  it('draws only the half facing the room, about half the ball', () => {
    expect(facets.length).toBeGreaterThan(50);
    expect(facets.length).toBeLessThan(90);
  });

  it('is red and white in roughly equal measure', () => {
    const red = facets.filter((f) => f.red).length;

    expect(Math.abs(red - (facets.length - red))).toBeLessThan(facets.length * 0.2);
  });

  it('stays inside the ball', () => {
    for (const f of facets) {
      for (const [x, y] of f.points) {
        expect(Math.hypot(x, y)).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it('comes back to front, for painting', () => {
    for (let i = 1; i < facets.length; i++) {
      expect(facets[i].depth).toBeGreaterThanOrEqual(facets[i - 1].depth);
    }
  });

  it('covers the whole disc between them', () => {
    // Shoelace area of each facet's outline: together they should tile π.
    const area = facets.reduce((sum, f) => {
      let a = 0;
      f.points.forEach(([x1, y1], i) => {
        const [x2, y2] = f.points[(i + 1) % f.points.length];
        a += x1 * y2 - x2 * y1;
      });
      return sum + Math.abs(a) / 2;
    }, 0);

    expect(area).toBeGreaterThan(Math.PI * 0.95);
    expect(area).toBeLessThan(Math.PI * 1.02);
  });
});
