import { MAX_SCORE, persistenceWeight, pressureOf, scoreOf, severityWeight } from './pressure';
import { CRITICAL, HEALTHY, WARNING } from './types';

const seconds = (n: number) => n * 1000;
const minutes = (n: number) => n * 60_000;

describe('severityWeight', () => {
  it('uses the weights from the plan', () => {
    expect(severityWeight(HEALTHY)).toBe(0);
    expect(severityWeight(WARNING)).toBe(1);
    expect(severityWeight(CRITICAL)).toBe(3);
  });
});

describe('scoreOf', () => {
  // The shape a user is most likely to send: percent of error budget burned,
  // where half the budget gone is a warning and nearly all of it is critical.
  const budget = (burned: number) => scoreOf(burned, 50, 90);

  it('scores nothing below the warning level', () => {
    expect(budget(0)).toBe(0);
    expect(budget(49.9)).toBe(0);
  });

  it('scores exactly one at the warning level', () => {
    expect(budget(50)).toBe(1);
  });

  it('scores exactly three at the critical level', () => {
    expect(budget(90)).toBe(3);
  });

  it('rises smoothly between the two levels', () => {
    expect(budget(70)).toBe(2);
    expect(budget(60)).toBe(1.5);
  });

  it('keeps rising past the critical level', () => {
    expect(budget(100)).toBeGreaterThan(3);
    expect(budget(130)).toBeGreaterThan(budget(100));
  });

  it('caps, so one disaster cannot hide everything else', () => {
    expect(budget(10_000)).toBe(MAX_SCORE);
    expect(scoreOf(500, 6, 14.4)).toBe(MAX_SCORE);
  });

  it('never goes down as things get worse', () => {
    let previous = -1;
    for (let burned = 0; burned <= 200; burned += 5) {
      const score = budget(burned);
      expect(score).toBeGreaterThanOrEqual(previous);
      previous = score;
    }
  });

  it('works for a burn rate as well as a percentage', () => {
    // The usual multi-burn-rate levels: six times is trouble, 14.4 is a page.
    expect(scoreOf(1, 6, 14.4)).toBe(0);
    expect(scoreOf(6, 6, 14.4)).toBe(1);
    expect(scoreOf(14.4, 6, 14.4)).toBeCloseTo(3);
    expect(scoreOf(30, 6, 14.4)).toBeGreaterThan(3);
  });

  it('treats anything at or past the levels as critical when they are the same', () => {
    expect(scoreOf(5, 5, 5)).toBe(3);
    expect(scoreOf(4, 5, 5)).toBe(0);
  });

  it('ignores a reading that is not a number', () => {
    expect(scoreOf(NaN, 50, 90)).toBe(0);
    expect(scoreOf(Infinity, 50, 90)).toBe(MAX_SCORE);
  });
});

describe('persistenceWeight', () => {
  it('follows the time bands from the plan', () => {
    expect(persistenceWeight(seconds(0))).toBe(1.0);
    expect(persistenceWeight(seconds(29))).toBe(1.0);
    expect(persistenceWeight(seconds(30))).toBe(1.2);
    expect(persistenceWeight(minutes(1))).toBe(1.2);
    expect(persistenceWeight(minutes(2))).toBe(1.5);
    expect(persistenceWeight(minutes(4))).toBe(1.5);
    expect(persistenceWeight(minutes(5))).toBe(2.0);
    expect(persistenceWeight(minutes(90))).toBe(2.0);
  });

  it('ignores a negative age', () => {
    expect(persistenceWeight(-minutes(10))).toBe(1.0);
  });

  it('never goes down as a problem gets older', () => {
    let previous = 0;
    for (let s = 0; s < 600; s += 5) {
      const weight = persistenceWeight(seconds(s));
      expect(weight).toBeGreaterThanOrEqual(previous);
      previous = weight;
    }
  });
});

describe('pressureOf', () => {
  it('matches the example in the plan', () => {
    // A critical lasting five minutes: 3 x 2 = 6.
    expect(pressureOf(severityWeight(CRITICAL), minutes(5))).toBe(6);
    // A new warning: 1 x 1 = 1.
    expect(pressureOf(severityWeight(WARNING), 0)).toBe(1);
  });

  it('gives an old critical six times the score of a new warning', () => {
    expect(pressureOf(3, minutes(5))).toBe(pressureOf(1, 0) * 6);
  });

  it('separates two services that used to look identical', () => {
    // Both critical, but one has burned nearly all its budget.
    const nearlyGone = scoreOf(99, 50, 90);
    const justOver = scoreOf(91, 50, 90);

    expect(pressureOf(nearlyGone)).toBeGreaterThan(pressureOf(justOver));
  });

  it('scores healthy services zero, however long', () => {
    expect(pressureOf(0, minutes(30))).toBe(0);
  });

  it('ignores a negative score', () => {
    expect(pressureOf(-5, minutes(30))).toBe(0);
  });

  it('assumes no age unless told otherwise', () => {
    expect(pressureOf(3)).toBe(3);
  });

  it('can ignore age entirely', () => {
    expect(pressureOf(3, minutes(30), false)).toBe(3);
  });
});
