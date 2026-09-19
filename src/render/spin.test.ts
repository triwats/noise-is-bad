import { SpinState, Vec3, faceNormal, shade, startSpin, step } from './spin';

/** A predictable stand-in for `Math.random`. */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

const at = (x: number, y: number, z: number, v: Partial<SpinState> = {}): SpinState => ({
  x,
  y,
  z,
  vx: 10,
  vy: 20,
  vz: 5,
  ...v,
});

const close = (a: Vec3, b: Vec3) => a.forEach((value, i) => expect(value).toBeCloseTo(b[i], 9));

describe('startSpin', () => {
  it('starts somewhere different each run', () => {
    const a = startSpin(sequence(0.1, 0.5, 0.9, 0.3, 0.7, 0.2, 0.8, 0.4, 0.6));
    const b = startSpin(sequence(0.6, 0.2, 0.4, 0.9, 0.1, 0.7, 0.3, 0.5, 0.8));

    expect([a.x, a.y, a.z]).not.toEqual([b.x, b.y, b.z]);
  });

  it('turns every axis at a different speed, so the three never fall back into step', () => {
    const s = startSpin(sequence(0.5));
    const speeds = [Math.abs(s.vx), Math.abs(s.vy), Math.abs(s.vz)];

    expect(new Set(speeds.map((v) => v.toFixed(3))).size).toBe(3);
    // No pair forms a ratio of small whole numbers.
    for (const [a, b] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ]) {
      const ratio = speeds[a] / speeds[b];
      for (let q = 1; q <= 8; q++) {
        expect(Math.abs(ratio * q - Math.round(ratio * q))).toBeGreaterThan(0.01);
      }
    }
  });

  it('dices speed and direction within limits, so runs vary without going wild', () => {
    for (let i = 0; i < 200; i++) {
      const s = startSpin();
      for (const [v, base] of [
        [s.vx, 7.3],
        [s.vy, 12.9],
        [s.vz, 4.1],
      ]) {
        expect(Math.abs(v)).toBeGreaterThanOrEqual(base * 0.8 - 1e-9);
        expect(Math.abs(v)).toBeLessThanOrEqual(base * 1.2 + 1e-9);
      }
    }
  });

  it('can turn either way on each axis', () => {
    // Below a half turns one way, at or above it the other.
    const one = startSpin(sequence(0.9));
    const other = startSpin(sequence(0.1));

    expect(Math.sign(one.vx)).toBe(-Math.sign(other.vx));
    expect(Math.sign(one.vy)).toBe(-Math.sign(other.vy));
    expect(Math.sign(one.vz)).toBe(-Math.sign(other.vz));
  });
});

describe('step', () => {
  it('turns each axis at its own constant speed, with no easing', () => {
    const next = step(at(0, 0, 0), 1000);

    expect([next.x, next.y, next.z]).toEqual([10, 20, 5]);
  });

  it('is driven by time, not by how often it is called', () => {
    const once = step(at(0, 0, 0), 100);
    let many = at(0, 0, 0);
    for (let i = 0; i < 10; i++) {
      many = step(many, 10);
    }

    expect(many.x).toBeCloseTo(once.x, 9);
    expect(many.y).toBeCloseTo(once.y, 9);
    expect(many.z).toBeCloseTo(once.z, 9);
  });

  it('never changes direction or speed', () => {
    let s = at(0, 0, 0);
    for (let i = 0; i < 1000; i++) {
      s = step(s, 16);
    }

    expect([s.vx, s.vy, s.vz]).toEqual([10, 20, 5]);
  });

  it('stays within one turn however long it runs', () => {
    const next = step(at(350, 5, 359, { vx: 17, vy: -23, vz: 3 }), 3_600_000);

    for (const angle of [next.x, next.y, next.z]) {
      expect(angle).toBeGreaterThanOrEqual(0);
      expect(angle).toBeLessThan(360);
    }
  });

  it('scales every axis together with the speed setting', () => {
    const normal = step(at(0, 0, 0), 1000, 1);
    const doubled = step(at(0, 0, 0), 1000, 2);

    expect([doubled.x, doubled.y, doubled.z]).toEqual([normal.x * 2, normal.y * 2, normal.z * 2]);
  });

  it('does nothing when no time passes, time runs backwards, or speed is zero', () => {
    const s = at(10, 20, 30);

    expect(step(s, 0)).toEqual(s);
    expect(step(s, -500)).toEqual(s);
    expect(step(s, 1000, 0)).toEqual(s);
  });
});

describe('faceNormal', () => {
  it('points at the viewer when the lockup is square on', () => {
    close(faceNormal(at(0, 0, 0)), [0, 0, 1]);
  });

  it('points away when turned round', () => {
    close(faceNormal(at(0, 180, 0)), [0, 0, -1]);
    close(faceNormal(at(180, 0, 0)), [0, 0, -1]);
  });

  it('lies flat across the screen when turned edge-on', () => {
    close(faceNormal(at(0, 90, 0)), [1, 0, 0]);
    close(faceNormal(at(90, 0, 0)), [0, -1, 0]);
  });

  it('ignores roll, which only spins the face within its own plane', () => {
    close(faceNormal(at(30, 40, 0)), faceNormal(at(30, 40, 123)));
  });
});

describe('shade', () => {
  const lit = (x: number, y: number) => shade(faceNormal(at(x, y, 0)));

  it('lights the front brightly and leaves the sides dark when the lockup faces the room', () => {
    const light = lit(0, 0);

    expect(light.front).toBeGreaterThan(0.8);
    expect(light.side).toBeLessThan(0.3);
  });

  it('lights the sides as the lockup turns edge-on, so front and extrusion stay distinct', () => {
    const light = lit(0, 80);

    expect(light.side).toBeGreaterThan(light.front);
  });

  it('lights the back cap when the lockup has turned round', () => {
    const light = lit(0, 180);

    expect(light.back).toBeGreaterThan(0.8);
    expect(light.front).toBeLessThan(0.3);
  });

  it('never goes fully black, so a surface facing away still reads as one', () => {
    for (let y = 0; y < 360; y += 5) {
      const light = lit(20, y);
      expect(Math.min(light.front, light.back, light.side)).toBeGreaterThan(0.2);
    }
  });

  it('gives metal a highlight and solid colour none', () => {
    const normal = faceNormal(at(0, 0, 0));

    expect(shade(normal, 'metallic').frontShine).toBeGreaterThan(0.3);
    expect(shade(normal, 'solid').frontShine).toBe(0);
    expect(shade(normal, 'solid').front).toBe(shade(normal, 'metallic').front);
  });

  it('never jumps: every output changes smoothly as the lockup turns', () => {
    // The regression test for the old reflection, which wrapped its angle and
    // leapt most of the way across the face twice a cycle. Walk each axis in
    // quarter-degree steps, including straight through edge-on and back, and
    // insist no output moves more than a small amount between neighbours.
    const outputs = (x: number, y: number, z: number) => {
      const l = shade(faceNormal(at(x, y, z)));
      return [l.front, l.back, l.side, l.frontShine, l.backShine, ...l.frontShineAt, ...l.backShineAt];
    };

    let worst = 0;
    for (const [dx, dy, dz, fx, fy, fz] of [
      [0.25, 0, 0, 0, 37, 0],
      [0, 0.25, 0, 23, 0, 0],
      [0.25, 0.25, 0.25, 0, 0, 0],
      [0.25, 0.1, 0, 71, 13, 0],
    ]) {
      let previous = outputs(fx, fy, fz);
      for (let i = 1; i <= 1440 * 2; i++) {
        const next = outputs(fx + dx * i, fy + dy * i, fz + dz * i);
        next.forEach((value, k) => (worst = Math.max(worst, Math.abs(value - previous[k]))));
        previous = next;
      }
    }

    // A quarter of a degree moves nothing by more than a few hundredths.
    expect(worst).toBeLessThan(0.06);
  });

  it('keeps the highlight near the cap, sliding off its edge rather than leaping', () => {
    for (let y = 0; y < 360; y += 3) {
      const { frontShineAt, backShineAt } = lit(15, y);
      for (const v of [...frontShineAt, ...backShineAt]) {
        expect(v).toBeGreaterThanOrEqual(-0.3);
        expect(v).toBeLessThanOrEqual(1.3);
      }
    }
  });
});
