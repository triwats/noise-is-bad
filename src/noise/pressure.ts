import { CRITICAL, HEALTHY, Severity, WARNING } from './types';

/**
 * How much screen a problem should get (Epic 7).
 *
 * The score is how bad it is multiplied by how long it has lasted.
 *
 * "How bad" is a number on a continuous scale, not one of two buckets. A
 * service that has burned 99% of its error budget and one that has burned 55%
 * are both in trouble, but not equally, and the screen should say so.
 */

/** A warning counts for one, a critical for three. Straight from the plan. */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  [HEALTHY]: 0,
  [WARNING]: 1,
  [CRITICAL]: 3,
};

/**
 * The most one problem can score, however bad it gets.
 *
 * Without a cap, a service burning its budget a hundred times over would take
 * the whole screen and hide everything else. Three times the critical weight
 * still dwarfs its neighbours without erasing them.
 */
export const MAX_SCORE = 9;

const SECOND = 1000;
const MINUTE = 60 * SECOND;

/** Longest first, so the first one that matches is the right one. */
const PERSISTENCE_WEIGHTS: Array<{ after: number; weight: number }> = [
  { after: 5 * MINUTE, weight: 2.0 },
  { after: 2 * MINUTE, weight: 1.5 },
  { after: 30 * SECOND, weight: 1.2 },
  { after: 0, weight: 1.0 },
];

/** The score for a signal that only says warning or critical, with no number behind it. */
export const severityWeight = (severity: Severity): number => SEVERITY_WEIGHT[severity] ?? 0;

/**
 * Turns a reading into a score.
 *
 * Anchored on the plan's numbers: a service sitting exactly on the warning
 * level scores 1, one sitting exactly on the critical level scores 3, and it
 * keeps rising at the same rate beyond that until it hits the cap.
 *
 * Both levels are given in whatever units the query returns, so this works the
 * same for a percentage of error budget burned, a burn rate multiplier, or a
 * plain status number.
 */
export function scoreOf(value: number, warning: number, critical: number): number {
  // A reading of positive infinity is real: a burn rate divided by a zero
  // denominator gives one, and it means burning infinitely fast, not fine. Only
  // an actual non-number counts as no reading.
  if (Number.isNaN(value) || value < warning) {
    return 0;
  }

  const span = critical - warning;
  if (span <= 0) {
    // Nothing between the two levels to interpolate across, so anything at or
    // past them is simply critical.
    return SEVERITY_WEIGHT[CRITICAL];
  }

  const steps = (value - warning) / span;
  return Math.min(MAX_SCORE, 1 + steps * 2);
}

/**
 * How bad a score is, in words.
 *
 * Derived from the score rather than worked out separately, so the colour on
 * screen and the size of the box can never disagree.
 */
export function severityFromScore(score: number): Severity {
  if (score >= SEVERITY_WEIGHT[CRITICAL]) {
    return CRITICAL;
  }
  return score > 0 ? WARNING : HEALTHY;
}

/**
 * Scores a reading when smaller numbers are the worse ones.
 *
 * Everything is negated first: an availability of 0.94 against a warning level
 * of 0.99 becomes -0.94 against -0.99, and the ordinary "bigger is worse"
 * arithmetic then works unchanged.
 */
export const scoreOfLower = (value: number, warning: number, critical: number): number =>
  scoreOf(-value, -warning, -critical);

/** Scores a reading, whichever way the number runs. */
export const scoreFacing = (value: number, warning: number, critical: number, lowerIsWorse: boolean): number =>
  lowerIsWorse ? scoreOfLower(value, warning, critical) : scoreOf(value, warning, critical);

export function persistenceWeight(persistenceMs: number): number {
  const age = Math.max(0, persistenceMs);
  return PERSISTENCE_WEIGHTS.find((band) => age >= band.after)?.weight ?? 1;
}

/**
 * The final score for one problem.
 *
 * Set `useAge` to false to score on how bad it is alone. Epic 7 treats age as
 * an experiment, not a settled rule, so it has to be possible to turn off and
 * compare on a real screen.
 */
export const pressureOf = (score: number, persistenceMs = 0, useAge = true): number =>
  Math.max(0, score) * (useAge ? persistenceWeight(persistenceMs) : 1);
