import { pressureOf, severityWeight } from './pressure';
import { NoiseItem, NoiseSignal, Unhealthy, isUnhealthy } from './types';

/**
 * Remembers what is broken, and for how long (NIB-009, NIB-010, NIB-011).
 *
 * Grafana refreshes all the time. Starting again on every refresh would make
 * every problem look brand new, and we could never tell how long one had
 * lasted. So this keeps what it already knows and adds to it.
 *
 * The caller passes in the current time, and nothing here reads the clock. That
 * makes ageing and the wait-before-clearing rule easy to test without waiting.
 */

/** How many healthy checks in a row before a problem leaves the screen. */
export const HEALTHY_CHECKS_TO_CLEAR = 2;

interface Tracked {
  name: string;
  severity: Unhealthy;
  /** How bad it is, on the continuous scale. */
  score: number;
  firstSeen: number;
  lastSeen: number;
  /** Healthy checks in a row so far. One bad reading sets this back to zero. */
  healthyCount: number;
}

export interface EngineState {
  readonly tracked: readonly Tracked[];
}

export const emptyState: EngineState = { tracked: [] };

/**
 * Adds one refresh to what we already know.
 *
 * A new problem shows straight away. A problem that looks fixed has to stay
 * healthy for `HEALTHY_CHECKS_TO_CLEAR` checks before it goes, which stops a
 * service that keeps flicking on and off making the screen flash.
 *
 * If a name is simply missing from the refresh, that counts as no news, not
 * good news. A service that stopped reporting is just as likely to be down as
 * fixed, and a screen that quietly drops a problem because its data vanished is
 * lying to the room.
 */
export function update(state: EngineState, signals: NoiseSignal[], now: number): EngineState {
  const observed = new Map(signals.map((signal) => [signal.name, signal]));
  const known = new Set(state.tracked.map((item) => item.name));
  const next: Tracked[] = [];

  // Problems we already knew about keep their place, so the layout stays put.
  for (const item of state.tracked) {
    const signal = observed.get(item.name);

    if (!signal) {
      next.push(item);
      continue;
    }

    if (isUnhealthy(signal)) {
      // A warning turning critical is the same problem, so keep its start time.
      next.push({
        ...item,
        severity: signal.severity as Unhealthy,
        score: scoreFor(signal),
        lastSeen: now,
        healthyCount: 0,
      });
      continue;
    }

    const healthyCount = item.healthyCount + 1;
    if (healthyCount < HEALTHY_CHECKS_TO_CLEAR) {
      next.push({ ...item, lastSeen: now, healthyCount });
    }
  }

  for (const signal of signals) {
    if (!isUnhealthy(signal) || known.has(signal.name)) {
      continue;
    }
    next.push({
      name: signal.name,
      severity: signal.severity as Unhealthy,
      score: scoreFor(signal),
      firstSeen: now,
      lastSeen: now,
      healthyCount: 0,
    });
  }

  return { tracked: next };
}

/**
 * Reads out the current problems, aged as at `now`.
 *
 * Age and score are worked out here rather than saved, so they keep climbing
 * between refreshes instead of only changing when new data arrives.
 */
export function getItems(state: EngineState, now: number, useAge = true): NoiseItem[] {
  return state.tracked.map((item) => {
    const persistence = Math.max(0, now - item.firstSeen);

    return {
      id: item.name,
      name: item.name,
      severity: item.severity,
      firstSeen: item.firstSeen,
      lastSeen: item.lastSeen,
      persistence,
      pressure: pressureOf(item.score, persistence, useAge),
    };
  });
}

/** A source that cannot give a number falls back to the severity alone. */
const scoreFor = (signal: NoiseSignal): number => signal.score ?? severityWeight(signal.severity);

/** True when a problem is reading healthy but has not been cleared yet. */
export const isRecovering = (state: EngineState, name: string): boolean =>
  (state.tracked.find((item) => item.name === name)?.healthyCount ?? 0) > 0;
