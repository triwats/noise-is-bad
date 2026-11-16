import { changedCards, faceOf, fitCards, msUntilNextMinute } from './flip';

/** Local time, so the face reads the same whatever zone the tests run in. */
const at = (hours: number, minutes: number, seconds = 0, ms = 0) => new Date(2026, 8, 20, hours, minutes, seconds, ms);

describe('faceOf', () => {
  it('reads twenty-four hours, two digits each', () => {
    expect(faceOf(at(14, 8))).toEqual({ hours: '14', minutes: '08' });
    expect(faceOf(at(23, 59))).toEqual({ hours: '23', minutes: '59' });
  });

  it('pads midnight and the first minutes of the hour', () => {
    expect(faceOf(at(0, 5))).toEqual({ hours: '00', minutes: '05' });
    expect(faceOf(at(9, 0))).toEqual({ hours: '09', minutes: '00' });
  });

  it('ignores seconds', () => {
    expect(faceOf(at(14, 8, 59, 999))).toEqual(faceOf(at(14, 8)));
  });
});

describe('msUntilNextMinute', () => {
  it('counts down to the boundary', () => {
    expect(msUntilNextMinute(at(14, 8, 59, 0).getTime())).toBe(1_000);
    expect(msUntilNextMinute(at(14, 8, 0, 1).getTime())).toBe(59_999);
  });

  it('never answers zero: on the boundary the next one is a minute away', () => {
    expect(msUntilNextMinute(at(14, 8).getTime())).toBe(60_000);
    expect(msUntilNextMinute(0)).toBe(60_000);
  });

  it('stays in range for any moment, before the epoch included', () => {
    for (const ms of [-1, -59_999, -60_000, 1, 123_456_789, Date.UTC(2038, 0, 19, 3, 14, 7)]) {
      const wait = msUntilNextMinute(ms);
      expect(wait).toBeGreaterThan(0);
      expect(wait).toBeLessThanOrEqual(60_000);
      expect((ms + wait) % 60_000).toBe(0);
    }
  });
});

describe('changedCards', () => {
  it('flips only the minutes most of the time', () => {
    expect(changedCards(faceOf(at(14, 8)), faceOf(at(14, 9)))).toEqual({ hours: false, minutes: true });
  });

  it('flips both on the hour', () => {
    expect(changedCards(faceOf(at(14, 59)), faceOf(at(15, 0)))).toEqual({ hours: true, minutes: true });
  });

  it('flips nothing when nothing changed', () => {
    expect(changedCards(faceOf(at(14, 8)), faceOf(at(14, 8, 30)))).toEqual({ hours: false, minutes: false });
  });

  it('flips just the hours when the minutes happen to match', () => {
    expect(changedCards(faceOf(at(14, 8)), faceOf(at(15, 8)))).toEqual({ hours: true, minutes: false });
  });
});

describe('fitCards', () => {
  const across = (fit: { card: number; gap: number }) => fit.card * 2 + fit.gap;

  it('is bounded by height on a television', () => {
    const fit = fitCards(1920, 1080);

    expect(fit.card).toBeLessThan(1080);
    expect(across(fit)).toBeLessThan(1920);
    expect(fit.card).toBeGreaterThan(1080 * 0.7);
  });

  it('is bounded by width in a tall panel', () => {
    const fit = fitCards(400, 1000);

    expect(across(fit)).toBeLessThanOrEqual(400);
    expect(fit.card).toBeLessThan(400 / 2);
  });

  it('keeps room around the cards at every shape', () => {
    for (const [w, h] of [
      [1920, 1080],
      [800, 600],
      [600, 800],
      [3840, 2160],
      [300, 300],
    ]) {
      const fit = fitCards(w, h);
      expect(across(fit)).toBeLessThan(w);
      expect(fit.card).toBeLessThan(h);
      expect(fit.fontSize).toBeLessThan(fit.card);
      expect(fit.radius).toBeLessThan(fit.card / 2);
    }
  });

  it('never collapses below a readable card', () => {
    expect(fitCards(0, 0).card).toBeGreaterThan(0);
    expect(fitCards(10, 4).card).toBe(fitCards(0, 0).card);
  });

  it('scales everything with the card', () => {
    const small = fitCards(400, 300);
    const large = fitCards(800, 600);

    expect(large.card).toBeCloseTo(small.card * 2, 5);
    expect(large.gap).toBeCloseTo(small.gap * 2, 5);
    expect(large.fontSize).toBeCloseTo(small.fontSize * 2, 5);
    expect(large.radius).toBeCloseTo(small.radius * 2, 5);
  });
});
