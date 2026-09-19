import { Bounds, startState, step } from './bounce';

const stage: Bounds = { width: 1000, height: 600, markWidth: 200, markHeight: 100 };
// Room to move: 800 across, 500 down.

const at = (x: number, y: number, vx: number, vy: number, bounces = 0) => ({ x, y, vx, vy, bounces });

describe('startState', () => {
  it('puts the mark inside the box', () => {
    const s = startState(stage);

    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.x).toBeLessThanOrEqual(800);
    expect(s.y).toBeGreaterThanOrEqual(0);
    expect(s.y).toBeLessThanOrEqual(500);
  });

  it('starts with no bounces', () => {
    expect(startState(stage).bounces).toBe(0);
  });

  it('uses different speeds sideways and up so it does not repeat one line', () => {
    const s = startState(stage);
    expect(Math.abs(s.vx)).not.toBeCloseTo(Math.abs(s.vy));
  });

  it('still moves on a tiny box', () => {
    const s = startState({ width: 20, height: 20, markWidth: 10, markHeight: 10 });
    expect(Math.abs(s.vx)).toBeGreaterThan(0);
  });
});

describe('step', () => {
  it('moves in a straight line away from the walls', () => {
    const next = step(at(100, 100, 200, 100), stage, 1000);

    expect(next).toEqual(at(300, 200, 200, 100));
  });

  it('does nothing when no time has passed', () => {
    const s = at(100, 100, 200, 100);
    expect(step(s, stage, 0)).toEqual(s);
  });

  it('ignores a clock that goes backwards', () => {
    const s = at(100, 100, 200, 100);
    expect(step(s, stage, -500)).toEqual(s);
  });

  it('reflects off the right wall', () => {
    // 780 + 200 = 980, which is 180 past the 800 limit, so it lands at 620.
    const next = step(at(780, 100, 200, 0), stage, 1000);

    expect(next.x).toBeCloseTo(620);
    expect(next.vx).toBe(-200);
  });

  it('reflects off the left wall', () => {
    const next = step(at(20, 100, -200, 0), stage, 1000);

    expect(next.x).toBeCloseTo(180);
    expect(next.vx).toBe(200);
  });

  it('reflects off the bottom wall', () => {
    const next = step(at(100, 450, 0, 200), stage, 1000);

    expect(next.y).toBeCloseTo(350);
    expect(next.vy).toBe(-200);
  });

  it('reflects off the top wall', () => {
    const next = step(at(100, 50, 0, -200), stage, 1000);

    expect(next.y).toBeCloseTo(150);
    expect(next.vy).toBe(200);
  });

  it('turns both ways at once in a corner', () => {
    const next = step(at(790, 495, 200, 200), stage, 1000);

    expect(next.vx).toBe(-200);
    expect(next.vy).toBe(-200);
    expect(next.x).toBeLessThanOrEqual(800);
    expect(next.y).toBeLessThanOrEqual(500);
  });

  it('stays inside the box after a long pause', () => {
    // A backgrounded tab for a minute: many bounces in one step.
    const next = step(at(400, 250, 317, 211), stage, 60_000);

    expect(next.x).toBeGreaterThanOrEqual(0);
    expect(next.x).toBeLessThanOrEqual(800);
    expect(next.y).toBeGreaterThanOrEqual(0);
    expect(next.y).toBeLessThanOrEqual(500);
  });

  it('never leaves the box, however long it runs', () => {
    let s = startState(stage);
    for (let frame = 0; frame < 5_000; frame++) {
      s = step(s, stage, 16);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(800);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(500);
    }
  });

  it('moves around instead of sitting still', () => {
    let s = startState(stage);
    const seen = new Set<string>();
    for (let frame = 0; frame < 600; frame++) {
      s = step(s, stage, 16);
      seen.add(`${Math.round(s.x / 100)},${Math.round(s.y / 100)}`);
    }
    expect(seen.size).toBeGreaterThan(4);
  });

  it('sits still when the mark is bigger than the box', () => {
    const cramped: Bounds = { width: 100, height: 100, markWidth: 400, markHeight: 400 };
    const next = step(at(0, 0, 200, 200), cramped, 1000);

    expect(next.x).toBe(0);
    expect(next.y).toBe(0);
  });

  describe('counting bounces', () => {
    // The renderer recolours the DVD logo on every wall hit, so this number has
    // to be right even when a single frame contains several of them.

    it('counts none while the mark is between the walls', () => {
      expect(step(at(100, 100, 200, 100), stage, 1000).bounces).toBe(0);
    });

    it('counts one for a wall', () => {
      expect(step(at(780, 100, 200, 0), stage, 1000).bounces).toBe(1);
    });

    it('counts two for a corner, one per axis', () => {
      expect(step(at(790, 495, 200, 200), stage, 1000).bounces).toBe(2);
    });

    it('keeps counting instead of starting again', () => {
      const once = step(at(780, 100, 200, 0), stage, 1000);

      expect(step(once, stage, 1000).bounces).toBe(1);
      expect(step({ ...once, x: 780, vx: 200 }, stage, 1000).bounces).toBe(2);
    });

    it('counts every bounce that happened during a long pause', () => {
      // 317px/s across 800px of room for a minute is well over a dozen walls.
      const next = step(at(400, 250, 317, 211), stage, 60_000);

      expect(next.bounces).toBeGreaterThan(12);
    });

    it('counts none when the mark cannot move', () => {
      const cramped: Bounds = { width: 100, height: 100, markWidth: 400, markHeight: 400 };

      expect(step(at(0, 0, 200, 200), cramped, 1000).bounces).toBe(0);
    });
  });

  it('pulls the mark back in when the box gets smaller', () => {
    const shrunk: Bounds = { width: 300, height: 300, markWidth: 200, markHeight: 100 };
    // Room is now 100 x 200, but the mark was at 700, 400.
    const next = step(at(700, 400, 0, 0), shrunk, 16);

    expect(next.x).toBeGreaterThanOrEqual(0);
    expect(next.x).toBeLessThanOrEqual(100);
    expect(next.y).toBeGreaterThanOrEqual(0);
    expect(next.y).toBeLessThanOrEqual(200);
  });
});
