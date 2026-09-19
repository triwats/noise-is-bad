/**
 * The domain contract, as defined in Epic 2 of the plan.
 *
 * Nothing in this directory may import from `@grafana/*`. The Signal Adapter is
 * the only place that knows Grafana exists; everything downstream of it works
 * on these types alone, so the state, layout and rendering engines could be
 * lifted out of the plugin unchanged.
 */

/** 0 healthy, 1 warning, 2 critical. */
export type Severity = 0 | 1 | 2;

export const HEALTHY = 0 satisfies Severity;
export const WARNING = 1 satisfies Severity;
export const CRITICAL = 2 satisfies Severity;

/** A severity that actually deserves the screen. */
export type Unhealthy = typeof WARNING | typeof CRITICAL;

/** One named thing and how it is doing, as delivered by a source. */
export interface NoiseSignal {
  name: string;
  severity: Severity;
  /**
   * How bad it is on a continuous scale, where 1 is exactly at the warning
   * level and 3 exactly at the critical level.
   *
   * Optional, because a source may only be able to say "warning" or "critical".
   * When it is missing, the severity alone decides the score.
   */
  score?: number;
}

/**
 * A problem the State Engine is tracking, from Epic 2.
 *
 * Signals are what a refresh said; items are what has been going on. Only
 * unhealthy things become items, which is why the severity narrows here.
 */
export interface NoiseItem extends NoiseSignal {
  id: string;
  severity: Unhealthy;
  /** When this problem was first observed, in epoch milliseconds. */
  firstSeen: number;
  /** The most recent observation of it, healthy or not. */
  lastSeen: number;
  /** How long it has been going on, in milliseconds. */
  persistence: number;
  /** How much screen it deserves. */
  pressure: number;
}

/** Healthy things are never drawn, so this is the only filter that matters. */
export function isUnhealthy(signal: NoiseSignal): boolean {
  return signal.severity > HEALTHY;
}

export function unhealthy(signals: NoiseSignal[]): NoiseSignal[] {
  return signals.filter(isUnhealthy);
}

export function severityLabel(severity: Severity): string {
  return severity === CRITICAL ? 'critical' : severity === WARNING ? 'warning' : 'healthy';
}
