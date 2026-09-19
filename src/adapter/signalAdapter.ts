import { DataFrame, Field, FieldType, getFieldDisplayName } from '@grafana/data';

import { scoreFacing, severityFromScore } from '../noise/pressure';
import { NoiseSignal, Severity } from '../noise/types';

/**
 * Turns Grafana query results into signals (NIB-003).
 *
 * This is the only file that knows what Grafana data looks like. Everything
 * else works with `NoiseSignal` on its own.
 *
 * It keeps things simple on purpose: the first text column gives the names, and
 * the first number column says how each one is doing. Letting the user pick the
 * columns and thresholds comes later, in Epic 9.
 */

export type Reducer = 'last' | 'max' | 'mean';

/**
 * Which way the number runs.
 *
 * Error budget burned and burn rate go up as things get worse. Budget
 * remaining and SLI compliance go down. Both are common, so both are supported.
 */
export type Direction = 'higher-is-worse' | 'lower-is-worse';

export interface AdapterOptions {
  /** A value at or above this is a warning. */
  warning: number;
  /** A value at or above this is critical, which beats warning. */
  critical: number;
  /** How to turn a series of readings into one number. */
  reducer: Reducer;
  /** Which column holds the names. Empty means pick the first text column. */
  nameField: string;
  /** Which column holds the numbers. Empty means pick the first number column. */
  valueField: string;
  /** Whether a bigger number means a worse problem. */
  direction: Direction;
}

/**
 * Availability, out of the box.
 *
 * The ordinary shape of an SLO is good events over total events: 1 is perfect
 * and smaller is worse. That is what most people already have, so it is what
 * the panel expects unless told otherwise. Below 99% is a warning and below 95%
 * is critical, which is loose enough not to shout at every blip and tight
 * enough to notice a real one.
 *
 * A plain status number still works. Set the levels to 1 and 2 and flip the
 * direction.
 */
export const DEFAULT_ADAPTER: AdapterOptions = {
  warning: 0.99,
  critical: 0.95,
  reducer: 'last',
  nameField: '',
  valueField: '',
  direction: 'lower-is-worse',
};

export interface AdapterResult {
  signals: NoiseSignal[];
  /**
   * Whether the query had any numbers in it at all.
   *
   * The panel needs this because "there are no numbers to read" is not the same
   * as "everything is fine". Only the second one should make the screen go quiet.
   */
  readable: boolean;
}

export function toSignals(series: DataFrame[], options: Partial<AdapterOptions> = {}): AdapterResult {
  const settings = { ...DEFAULT_ADAPTER, ...options };
  const worst = new Map<string, number>();
  let readable = false;

  for (const frame of series) {
    const valueField = pickField(frame, series, FieldType.number, settings.valueField);
    if (!valueField) {
      continue;
    }
    readable = true;

    for (const [name, numbers] of groupByName(frame, valueField, series, settings.nameField)) {
      const reduced = reduce(numbers, settings.reducer);
      if (reduced === undefined) {
        continue;
      }

      const score = scoreFor(reduced, settings);
      // The same name can turn up more than once. Keep the worse reading,
      // because the screen is there to show how bad things are.
      worst.set(name, Math.max(worst.get(name) ?? 0, score));
    }
  }

  return {
    readable,
    signals: [...worst].map(([name, score]) => ({
      name,
      severity: severityFromScore(score),
      score,
    })),
  };
}

/**
 * Turns one reading into a score.
 *
 * When smaller numbers are worse, everything is negated first: a budget of 20%
 * remaining against a warning level of 50% becomes -20 against -50, and the
 * ordinary "bigger is worse" arithmetic then works unchanged.
 */
export function scoreFor(value: number, settings: AdapterOptions = DEFAULT_ADAPTER): number {
  return scoreFacing(value, settings.warning, settings.critical, settings.direction === 'lower-is-worse');
}

/**
 * Groups the numbers by service name.
 *
 * A text column means one row per service, which is what a table query gives.
 * Without one, the whole result is a single service, which is what Prometheus
 * gives, and its name comes from the column's label.
 */
function groupByName(
  frame: DataFrame,
  valueField: Field,
  series: DataFrame[],
  wanted: string
): Map<string, number[]> {
  const numbers = getValues(valueField);
  const nameField = pickField(frame, series, FieldType.string, wanted);
  const buckets = new Map<string, number[]>();

  if (!nameField) {
    buckets.set(nameOfSeries(valueField, frame, series, wanted), numbers.map(asNumber).filter(isRealNumber));
    return buckets;
  }

  const names = getValues(nameField);
  for (let row = 0; row < numbers.length; row++) {
    const name = names[row];
    const value = asNumber(numbers[row]);
    if (typeof name !== 'string' || name === '' || !isRealNumber(value)) {
      continue;
    }

    const bucket = buckets.get(name);
    if (bucket) {
      bucket.push(value);
    } else {
      buckets.set(name, [value]);
    }
  }
  return buckets;
}

/** How bad one reading is, in words. */
export function severityOf(value: number, settings: AdapterOptions = DEFAULT_ADAPTER): Severity {
  return severityFromScore(scoreFor(value, settings));
}

/** Collapses a series to one number, or undefined when it holds nothing usable. */
function reduce(numbers: number[], reducer: Reducer): number | undefined {
  if (numbers.length === 0) {
    return undefined;
  }

  switch (reducer) {
    case 'max':
      return Math.max(...numbers);
    case 'mean':
      return numbers.reduce((total, n) => total + n, 0) / numbers.length;
    case 'last':
    default:
      return numbers[numbers.length - 1];
  }
}

/**
 * What to call a result that has no text column.
 *
 * Prometheus hangs its labels off the number column rather than giving them
 * columns of their own, so a named label is looked up there. This is what makes
 * a query straight out of Sloth or Pyrra work: name the label, `sloth_service`
 * or `slo`, and the panel has something clean to draw without anyone having to
 * remember to set a legend format.
 *
 * Falling back to the display name keeps a plain query working as before.
 */
function nameOfSeries(valueField: Field, frame: DataFrame, series: DataFrame[], wanted: string): string {
  const label = wanted ? valueField.labels?.[wanted] : undefined;

  return label ?? getFieldDisplayName(valueField, frame, series);
}

/**
 * Finds the column to use.
 *
 * If the user named one, match it by its column name or the name Grafana shows,
 * whichever they typed. Otherwise take the first column of the right kind. A
 * named column that is not in this result is skipped rather than guessed at,
 * because guessing would quietly show the wrong numbers.
 */
function pickField(frame: DataFrame, series: DataFrame[], kind: FieldType, wanted: string): Field | undefined {
  if (wanted) {
    return frame.fields.find(
      (field) => field.name === wanted || getFieldDisplayName(field, frame, series) === wanted
    );
  }
  return frame.fields.find((field) => field.type === kind);
}

const getValues = (field: Field): unknown[] =>
  Array.isArray(field.values) ? field.values : Array.from(field.values as ArrayLike<unknown>);

/**
 * Turns a value into a number, keeping missing values missing.
 *
 * `Number(null)` and `Number('')` are both 0, which would turn a gap in the
 * data into a healthy reading. A screen meant to show how bad things are must
 * never do that, so anything empty becomes NaN and is thrown away.
 */
const asNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === '') {
    return NaN;
  }
  return typeof value === 'number' ? value : Number(value);
};

/** Named rather than shadowing the global `isFinite`, which behaves differently. */
const isRealNumber = (value: number): boolean => Number.isFinite(value);
