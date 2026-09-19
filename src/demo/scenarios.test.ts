import { CRITICAL, WARNING, unhealthy } from '../noise/types';

import { SCENARIOS, SERVICES, Scenario, scenarioById, signalsAt } from './scenarios';

const named = (id: string): Scenario => {
  const scenario = scenarioById(id);
  if (!scenario) {
    throw new Error(`no scenario ${id}`);
  }
  return scenario;
};

const severityOf = (signals: ReturnType<typeof signalsAt>, name: string) =>
  signals.find((s) => s.name === name)?.severity;

const brokenAt = (scenario: Scenario, seconds: number) =>
  unhealthy(signalsAt(scenario, seconds * 1000)).map((s) => s.name);

describe('the list of scenarios', () => {
  it('has every scenario the plan asks for, plus the full story', () => {
    expect(SCENARIOS.map((s) => s.name)).toEqual([
      'Shipping Incident',
      'All Quiet',
      'One Warning',
      'One Critical',
      'Two Problems',
      'Growing Incident',
      'Major Incident',
      'Recovery',
      'Chaos',
    ]);
  });

  it.each(SCENARIOS.map((s) => [s.id, s] as const))('%s is set up correctly', (_id, scenario) => {
    expect(scenario.steps.length).toBeGreaterThan(0);
    expect(scenario.steps[0].at).toBe(0);
    expect(scenario.loopMs).toBeGreaterThan(0);

    const times = scenario.steps.map((s) => s.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(times[times.length - 1]).toBeLessThan(scenario.loopMs);

    // Every step reports on every service, so one becoming healthy shows up as
    // a healthy reading rather than as a gap.
    for (const step of scenario.steps) {
      expect(step.signals.map((s) => s.name)).toEqual([...SERVICES]);
    }
  });

  it('gives every scenario its own name', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('scores every unhealthy service, so boxes can be sized by it', () => {
    for (const scenario of SCENARIOS) {
      for (const step of scenario.steps) {
        for (const signal of unhealthy(step.signals)) {
          expect(signal.score).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('signalsAt', () => {
  it('keeps an unchanging scenario the same forever', () => {
    const quiet = named('all-quiet');
    for (const t of [0, 500, 60_000, 86_400_000]) {
      expect(unhealthy(signalsAt(quiet, t))).toHaveLength(0);
    }
  });

  it('uses the first step for any time before the start', () => {
    const growing = named('growing-incident');
    // Five seconds before zero wraps to fifteen seconds into the loop.
    expect(signalsAt(growing, -5_000)).toEqual(signalsAt(growing, 15_000));
  });

  it('steps a growing problem through its stages', () => {
    const growing = named('growing-incident');

    expect(brokenAt(growing, 1)).toHaveLength(0);
    expect(severityOf(signalsAt(growing, 4_000), 'shipping')).toBe(WARNING);
    expect(severityOf(signalsAt(growing, 7_000), 'shipping')).toBe(CRITICAL);
    expect(brokenAt(growing, 11)).toHaveLength(2);
    expect(brokenAt(growing, 15)).toHaveLength(3);
  });

  it('switches exactly on time, not a step late', () => {
    const growing = named('growing-incident');
    expect(severityOf(signalsAt(growing, 6_000), 'shipping')).toBe(CRITICAL);
    expect(severityOf(signalsAt(growing, 5_999), 'shipping')).toBe(WARNING);
  });

  it('loops', () => {
    const growing = named('growing-incident');
    expect(signalsAt(growing, 7_000)).toEqual(signalsAt(growing, 7_000 + growing.loopMs));
    expect(signalsAt(growing, 7_000)).toEqual(signalsAt(growing, 7_000 + growing.loopMs * 3));
  });

  it('clears the recovery scenario down to nothing', () => {
    const recovery = named('recovery');
    expect(brokenAt(recovery, 0)).toHaveLength(4);
    expect(brokenAt(recovery, 7)).toHaveLength(3);
    expect(brokenAt(recovery, 13)).toHaveLength(2);
    expect(brokenAt(recovery, 19)).toHaveLength(0);
  });

  it('makes the chaos scenario flicker up and down', () => {
    const chaos = named('chaos');
    const counts = [0, 2, 4, 5, 7, 8, 10, 11].map((s) => brokenAt(chaos, s).length);

    expect(Math.min(...counts)).toBe(0);
    expect(Math.max(...counts)).toBeGreaterThan(1);
  });
});

describe('the shipping incident', () => {
  const story = named('lifecycle');

  /** Nothing in the shop that has no business being affected by shipping. */
  const UNRELATED = ['search', 'accounts', 'reviews'];

  it('starts and ends with nothing broken', () => {
    expect(brokenAt(story, 0)).toHaveLength(0);
    expect(brokenAt(story, 82)).toHaveLength(0);
  });

  it('never touches the half of the shop that has nothing to do with shipping', () => {
    for (const step of story.steps) {
      const broken = unhealthy(step.signals).map((s) => s.name);
      expect(broken.filter((name) => UNRELATED.includes(name))).toEqual([]);
    }
  });

  it('never puts the whole estate on screen', () => {
    const worst = Math.max(...story.steps.map((step) => unhealthy(step.signals).length));

    // Enough to need a treemap, never so many that nothing is left standing.
    expect(worst).toBeGreaterThanOrEqual(3);
    expect(worst).toBeLessThanOrEqual(SERVICES.length - UNRELATED.length);
  });

  it('starts with the shipping API and nothing else', () => {
    expect(brokenAt(story, 12)).toEqual(['shipping']);
  });

  it('spreads outwards from it, in the order things depend on it', () => {
    expect(brokenAt(story, 20)).toEqual(['shipping', 'checkout']);
    expect(brokenAt(story, 28)).toEqual(['shipping', 'checkout', 'basket']);
    expect(brokenAt(story, 36)).toEqual(['shipping', 'checkout', 'basket', 'orders']);
  });

  it('takes the shipping API critical before the rest follow', () => {
    expect(severityOf(signalsAt(story, 12_000), 'shipping')).toBe(WARNING);
    expect(severityOf(signalsAt(story, 28_000), 'shipping')).toBe(CRITICAL);
    expect(severityOf(signalsAt(story, 28_000), 'basket')).toBe(WARNING);
  });

  it('gives the origin of the trouble the highest score while it is getting worse', () => {
    for (const seconds of [20, 28, 36, 44]) {
      const signals = signalsAt(story, seconds * 1000);
      const origin = signals.find((s) => s.name === 'shipping')!.score!;
      const others = unhealthy(signals).filter((s) => s.name !== 'shipping');

      for (const other of others) {
        expect(origin).toBeGreaterThan(other.score!);
      }
    }
  });

  it('keeps the services behind it broken after the API itself improves', () => {
    // The API is recovering at 52 seconds, but budgets spent behind it do not
    // come back at the same moment: quotes is now the worst thing on screen.
    expect(severityOf(signalsAt(story, 52_000), 'shipping')).toBe(WARNING);
    expect(brokenAt(story, 52)).toHaveLength(4);

    const recovering = signalsAt(story, 52_000);
    const api = recovering.find((s) => s.name === 'shipping')!.score!;
    const quotes = recovering.find((s) => s.name === 'checkout')!.score!;
    expect(quotes).toBeGreaterThan(api);
  });

  it('gets better again after the worst point', () => {
    expect(brokenAt(story, 60).length).toBeLessThan(brokenAt(story, 44).length);
    expect(brokenAt(story, 68).length).toBeLessThan(brokenAt(story, 60).length);
    expect(brokenAt(story, 76).length).toBeLessThan(brokenAt(story, 68).length);
    expect(brokenAt(story, 82).length).toBeLessThan(brokenAt(story, 76).length);
  });

  it('holds each stage long enough to read', () => {
    const gaps = story.steps.slice(1).map((step, i) => step.at - story.steps[i].at);

    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(8_000);
  });
});
