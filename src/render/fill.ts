/**
 * How strongly a colour is painted, from a brand new problem to an old one.
 *
 * Shared by every filled surface, so a single incident and a box in the treemap
 * of the same age and severity look the same.
 */

/** The score at which a fill is at full strength: a critical lasting five minutes. */
const FULL_PRESSURE = 6;

/**
 * The lowest value is deliberately high. A new warning is still a problem and
 * has to show up clearly from across a room. Strength is a second way of
 * showing age, not the main way of showing how bad something is.
 */
export function fillStrength(pressure: number): number {
  const share = Math.min(1, Math.max(0, pressure) / FULL_PRESSURE);
  return 0.42 + share * 0.46;
}
