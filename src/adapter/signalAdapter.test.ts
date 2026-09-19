import { FieldType, toDataFrame } from '@grafana/data';

import { CRITICAL, HEALTHY, WARNING } from '../noise/types';

import { DEFAULT_ADAPTER, severityOf, toSignals } from './signalAdapter';

const table = (rows: Array<[string, number | null]>) =>
  toDataFrame({
    fields: [
      { name: 'service', type: FieldType.string, values: rows.map(([name]) => name) },
      { name: 'status', type: FieldType.number, values: rows.map(([, value]) => value) },
    ],
  });

/** What a Prometheus query gives: one frame per series, no string field. */
const timeSeries = (name: string, values: number[]) =>
  toDataFrame({
    name,
    fields: [
      { name: 'Time', type: FieldType.time, values: values.map((_, i) => i * 1000) },
      { name: 'Value', type: FieldType.number, values },
    ],
  });

/**
 * The panel now expects availability by default, where 1 is perfect and smaller
 * is worse. These tests describe the other supported shape, a plain status
 * number, so they say so rather than leaning on whatever the defaults happen to
 * be.
 */
const STATUS = { ...DEFAULT_ADAPTER, warning: 1, critical: 2, direction: 'higher-is-worse' as const };

const severities = (signals: ReturnType<typeof toSignals>['signals']) =>
  Object.fromEntries(signals.map((s) => [s.name, s.severity]));

describe('severityOf', () => {
  it('uses the thresholds from the plan', () => {
    expect(severityOf(0, STATUS)).toBe(HEALTHY);
    expect(severityOf(1, STATUS)).toBe(WARNING);
    expect(severityOf(2, STATUS)).toBe(CRITICAL);
    expect(severityOf(7, STATUS)).toBe(CRITICAL);
  });

  it('treats anything below the warning level as healthy', () => {
    expect(severityOf(0.9, STATUS)).toBe(HEALTHY);
    expect(severityOf(-3, STATUS)).toBe(HEALTHY);
  });

  it('uses custom thresholds', () => {
    const settings = { ...DEFAULT_ADAPTER, direction: 'higher-is-worse' as const, warning: 70, critical: 90 };

    expect(severityOf(50, settings)).toBe(HEALTHY);
    expect(severityOf(70, settings)).toBe(WARNING);
    expect(severityOf(95, settings)).toBe(CRITICAL);
  });
});

describe('whether the query can be read', () => {
  it('reports nothing to read for an empty result', () => {
    expect(toSignals([], STATUS)).toEqual({ signals: [], readable: false });
  });

  it('reports nothing to read when there are no numbers', () => {
    const noNumbers = toDataFrame({
      fields: [{ name: 'service', type: FieldType.string, values: ['checkout'] }],
    });

    expect(toSignals([noNumbers], STATUS).readable).toBe(false);
  });

  it('can be read but finds nothing when every number is missing', () => {
    const result = toSignals([table([['checkout', null]])], STATUS);

    expect(result.readable).toBe(true);
    expect(result.signals).toEqual([]);
  });
});

describe('a table of services', () => {
  it('turns the example from the plan into signals', () => {
    const result = toSignals(
      [
        table([
          ['checkout', 2],
          ['search', 1],
          ['kafka', 0],
        ]),
      ],
      STATUS
    );

    expect(result.signals).toMatchObject([
      { name: 'checkout', severity: CRITICAL },
      { name: 'search', severity: WARNING },
      { name: 'kafka', severity: HEALTHY },
    ]);
  });

  it('keeps healthy services, because something later needs them', () => {
    const result = toSignals([table([['kafka', 0]])], STATUS);

    expect(result.signals).toMatchObject([{ name: 'kafka', severity: HEALTHY }]);
  });

  it('skips rows missing a name or a number', () => {
    const ragged = toDataFrame({
      fields: [
        { name: 'service', type: FieldType.string, values: ['checkout', '', 'search'] },
        { name: 'status', type: FieldType.number, values: [2, 2, null] },
      ],
    });

    expect(toSignals([ragged], STATUS).signals).toMatchObject([{ name: 'checkout', severity: CRITICAL }]);
  });
});

describe('turning a series of readings into one', () => {
  it('uses the last reading by default', () => {
    expect(severities(toSignals([timeSeries('checkout', [2, 2, 0])], STATUS).signals)).toEqual({ checkout: HEALTHY });
  });

  it('can use the worst reading instead', () => {
    expect(severities(toSignals([timeSeries('checkout', [2, 2, 0])], { ...STATUS, reducer: 'max' }).signals)).toEqual({
      checkout: CRITICAL,
    });
  });

  it('can use the average', () => {
    // Mean of 0, 1, 2 is 1, a warning.
    expect(severities(toSignals([timeSeries('checkout', [0, 1, 2])], { ...STATUS, reducer: 'mean' }).signals)).toEqual({
      checkout: WARNING,
    });
  });

  it('ignores missing readings', () => {
    const gappy = toDataFrame({
      name: 'checkout',
      fields: [
        { name: 'Time', type: FieldType.time, values: [0, 1000, 2000] },
        { name: 'Value', type: FieldType.number, values: [2, null, null] },
      ],
    });

    expect(severities(toSignals([gappy], STATUS).signals)).toEqual({ checkout: CRITICAL });
  });

  it('handles each service separately in a long table', () => {
    const result = toSignals(
      [
        table([
          ['checkout', 0],
          ['search', 0],
          ['checkout', 2],
          ['search', 1],
        ]),
      ],
      { ...STATUS, reducer: 'last' }
    );

    expect(severities(result.signals)).toEqual({ checkout: CRITICAL, search: WARNING });
  });
});

describe('more than one set of results', () => {
  it('reads one set per service', () => {
    const result = toSignals([timeSeries('checkout', [2]), timeSeries('search', [1])], STATUS);

    expect(severities(result.signals)).toEqual({ checkout: CRITICAL, search: WARNING });
  });

  it('uses the worse reading when a service appears twice', () => {
    const result = toSignals([table([['checkout', 0]]), table([['checkout', 2]])], STATUS);

    expect(result.signals).toMatchObject([{ name: 'checkout', severity: CRITICAL }]);
  });

  it('does not let a healthy reading hide an earlier problem', () => {
    const result = toSignals([table([['checkout', 2]]), table([['checkout', 0]])], STATUS);

    expect(result.signals).toMatchObject([{ name: 'checkout', severity: CRITICAL }]);
  });

  it('skips what it cannot read and keeps the rest', () => {
    const unreadable = toDataFrame({ fields: [{ name: 'note', type: FieldType.string, values: ['hello'] }] });
    const result = toSignals([unreadable, table([['checkout', 2]])], STATUS);

    expect(result.readable).toBe(true);
    expect(result.signals).toMatchObject([{ name: 'checkout', severity: CRITICAL }]);
  });
});

describe('choosing which columns to use', () => {
  const twoOfEach = toDataFrame({
    fields: [
      { name: 'region', type: FieldType.string, values: ['eu', 'us'] },
      { name: 'service', type: FieldType.string, values: ['checkout', 'search'] },
      { name: 'latency', type: FieldType.number, values: [0, 0] },
      { name: 'status', type: FieldType.number, values: [2, 1] },
    ],
  });

  it('uses the first text and number columns when nothing is chosen', () => {
    expect(toSignals([twoOfEach], STATUS).signals).toMatchObject([
      { name: 'eu', severity: HEALTHY },
      { name: 'us', severity: HEALTHY },
    ]);
  });

  it('uses the columns the user names', () => {
    const result = toSignals([twoOfEach], { ...STATUS, nameField: 'service', valueField: 'status' });

    expect(result.signals).toMatchObject([
      { name: 'checkout', severity: CRITICAL },
      { name: 'search', severity: WARNING },
    ]);
  });

  it('can take the names from one column and leave the numbers automatic', () => {
    const result = toSignals([twoOfEach], { ...STATUS, nameField: 'service' });

    expect(result.signals.map((s) => s.name)).toEqual(['checkout', 'search']);
  });

  it('skips a result that does not have the number column asked for', () => {
    const result = toSignals([twoOfEach], { ...STATUS, valueField: 'not-here' });

    expect(result).toEqual({ signals: [], readable: false });
  });

  it('treats the whole result as one service if the name column is missing', () => {
    const result = toSignals([twoOfEach], { ...STATUS, nameField: 'not-here', valueField: 'status' });

    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].severity).toBe(WARNING);
  });
});

describe('SLO-shaped inputs', () => {
  const oneService = (value: number) =>
    toDataFrame({
      fields: [
        { name: 'service', type: FieldType.string, values: ['checkout'] },
        { name: 'value', type: FieldType.number, values: [value] },
      ],
    });

  describe('error budget burned, as a percentage', () => {
    const settings = { warning: 50, critical: 90, direction: 'higher-is-worse' as const };
    const read = (burned: number) => toSignals([oneService(burned)], settings).signals[0];

    it('is healthy while most of the budget is left', () => {
      expect(read(20).severity).toBe(HEALTHY);
    });

    it('warns once half the budget has gone', () => {
      expect(read(55)).toMatchObject({ severity: WARNING });
    });

    it('is critical once nearly all of it has gone', () => {
      expect(read(95)).toMatchObject({ severity: CRITICAL });
    });

    it('scores a service that has burned more budget higher', () => {
      expect(read(99).score).toBeGreaterThan(read(91).score!);
    });
  });

  describe('burn rate', () => {
    // The usual multi-burn-rate levels.
    const settings = { warning: 6, critical: 14.4, direction: 'higher-is-worse' as const };
    const read = (rate: number) => toSignals([oneService(rate)], settings).signals[0];

    it('is healthy while burning at the budgeted pace', () => {
      expect(read(1).severity).toBe(HEALTHY);
    });

    it('is critical at the level that would normally page someone', () => {
      expect(read(14.4).severity).toBe(CRITICAL);
    });

    it('gives a service burning far faster a much higher score', () => {
      expect(read(60).score).toBeGreaterThan(read(15).score!);
    });
  });

  describe('budget remaining, where a smaller number is worse', () => {
    const settings = { warning: 50, critical: 10, direction: 'lower-is-worse' as const };
    const read = (left: number) => toSignals([oneService(left)], settings).signals[0];

    it('is healthy with most of the budget left', () => {
      expect(read(80).severity).toBe(HEALTHY);
    });

    it('warns once half of it has gone', () => {
      expect(read(40).severity).toBe(WARNING);
    });

    it('is critical when almost none is left', () => {
      expect(read(5).severity).toBe(CRITICAL);
    });

    it('scores a service with less left higher', () => {
      expect(read(1).score).toBeGreaterThan(read(9).score!);
    });

    it('does not get the direction backwards', () => {
      expect(read(100).severity).toBe(HEALTHY);
      expect(read(0).severity).toBe(CRITICAL);
    });
  });

  describe('SLI compliance against a target', () => {
    // Warn below three nines, critical below two.
    const settings = { warning: 99.9, critical: 99, direction: 'lower-is-worse' as const };
    const read = (pct: number) => toSignals([oneService(pct)], settings).signals[0];

    it('is healthy while meeting the target', () => {
      expect(read(99.99).severity).toBe(HEALTHY);
    });

    it('warns just below the target', () => {
      expect(read(99.5).severity).toBe(WARNING);
    });

    it('is critical well below it', () => {
      expect(read(98).severity).toBe(CRITICAL);
    });
  });

  it('always agrees between the score and the severity', () => {
    for (const value of [0, 49, 50, 70, 89, 90, 120, 1000]) {
      const signal = toSignals([oneService(value)], {
        warning: 50,
        critical: 90,
        direction: 'higher-is-worse',
      }).signals[0];
      const score = signal.score ?? 0;

      if (signal.severity === CRITICAL) {
        expect(score).toBeGreaterThanOrEqual(3);
      } else if (signal.severity === WARNING) {
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThan(3);
      } else {
        expect(score).toBe(0);
      }
    }
  });
});

describe('a query straight out of an SLO generator', () => {
  /** What Sloth's recording rules look like: labels, no text column. */
  const slothSeries = (service: string, remaining: number) =>
    toDataFrame({
      name: 'slo:period_error_budget_remaining:ratio',
      fields: [
        { name: 'Time', type: FieldType.time, values: [0] },
        {
          name: 'Value',
          type: FieldType.number,
          values: [remaining],
          labels: { sloth_service: service, sloth_slo: 'requests-availability' },
        },
      ],
    });

  const settings = {
    nameField: 'sloth_service',
    warning: 0.5,
    critical: 0.1,
    direction: 'lower-is-worse' as const,
  };

  it('names each service from the label it is told to use', () => {
    const result = toSignals([slothSeries('checkout', 0.2), slothSeries('search', 0.9)], settings);

    expect(result.signals.map((s) => s.name)).toEqual(['checkout', 'search']);
  });

  it('reads a budget left as a ratio rather than a percentage', () => {
    const result = toSignals([slothSeries('checkout', 0.05), slothSeries('search', 0.8)], settings);

    expect(result.signals.find((s) => s.name === 'checkout')!.severity).toBe(CRITICAL);
    expect(result.signals.find((s) => s.name === 'search')!.severity).toBe(HEALTHY);
  });

  it('handles a budget that has gone past zero into the red', () => {
    const result = toSignals([slothSeries('checkout', -0.4)], settings);

    expect(result.signals[0].severity).toBe(CRITICAL);
    expect(result.signals[0].score).toBeGreaterThan(3);
  });

  it('scores a service with less budget left higher', () => {
    const result = toSignals([slothSeries('checkout', 0.02), slothSeries('cart', 0.08)], settings);
    const score = (name: string) => result.signals.find((s) => s.name === name)!.score!;

    expect(score('checkout')).toBeGreaterThan(score('cart'));
  });

  it('falls back to the series name when the label is not there', () => {
    const result = toSignals([slothSeries('checkout', 0.2)], { ...settings, nameField: 'not_a_label' });

    expect(result.signals[0].name).not.toBe('');
    expect(result.signals).toHaveLength(1);
  });

  it('reads a burn rate the same way', () => {
    const burnRate = (service: string, rate: number) =>
      toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [0] },
          { name: 'Value', type: FieldType.number, values: [rate], labels: { sloth_service: service } },
        ],
      });

    const result = toSignals([burnRate('checkout', 20), burnRate('search', 0.5)], {
      nameField: 'sloth_service',
      direction: 'higher-is-worse',
      warning: 6,
      critical: 14.4,
    });

    expect(result.signals.find((s) => s.name === 'checkout')!.severity).toBe(CRITICAL);
    expect(result.signals.find((s) => s.name === 'search')!.severity).toBe(HEALTHY);
  });
});

describe('what the panel expects with no configuration at all', () => {
  const availability = (service: string, ratio: number) =>
    toDataFrame({
      fields: [
        { name: 'service', type: FieldType.string, values: [service] },
        { name: 'availability', type: FieldType.number, values: [ratio] },
      ],
    });

  // Good events over total events is the ordinary shape of an SLO, so it is
  // what the panel assumes unless told otherwise. Someone who points it at an
  // availability query and changes nothing should get a sensible board.
  it('assumes availability, where 1 is perfect and smaller is worse', () => {
    expect(DEFAULT_ADAPTER.direction).toBe('lower-is-worse');
    expect(DEFAULT_ADAPTER.warning).toBe(0.99);
    expect(DEFAULT_ADAPTER.critical).toBe(0.95);
  });

  it('draws nothing for a perfect service', () => {
    expect(toSignals([availability('checkout', 1)]).signals[0].severity).toBe(HEALTHY);
    expect(toSignals([availability('checkout', 0.9999)]).signals[0].severity).toBe(HEALTHY);
  });

  it('warns below three nines and a bit', () => {
    expect(toSignals([availability('checkout', 0.985)]).signals[0].severity).toBe(WARNING);
  });

  it('is critical below 95%', () => {
    expect(toSignals([availability('checkout', 0.94)]).signals[0].severity).toBe(CRITICAL);
  });

  it('treats a total outage as the worst it can be', () => {
    const outage = toSignals([availability('checkout', 0)]).signals[0];
    const bad = toSignals([availability('checkout', 0.94)]).signals[0];

    expect(outage.severity).toBe(CRITICAL);
    expect(outage.score).toBeGreaterThan(bad.score!);
  });

  it('scores a worse availability higher', () => {
    const score = (ratio: number) => toSignals([availability('checkout', ratio)]).signals[0].score!;

    expect(score(0.90)).toBeGreaterThan(score(0.94));
    expect(score(0.94)).toBeGreaterThan(score(0.98));
  });
});
