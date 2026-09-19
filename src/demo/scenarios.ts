/**
 * Made-up data for demos (NIB-002).
 *
 * The plan asks for this early so that work on how things look never waits for
 * a real alert. A scenario is a script: a list of steps, each saying how every
 * service is doing from that moment on. `signalsAt` reads the script at a given
 * time. It keeps no state and never reads the clock, so it is easy to test and
 * could be driven by a slider later.
 *
 * Steps are written in the units a real user would send: availability, where 1
 * is perfect and smaller is worse. The demo therefore speaks exactly the
 * language `docs/metrics.md` documents, and the panel's own defaults, rather
 * than a private one.
 */

import { scoreOfLower, severityFromScore } from '../noise/pressure';
import { NoiseSignal } from '../noise/types';

/** The levels the demo is written against, matching the panel's own defaults. */
export const DEMO_WARNING = 0.99;
export const DEMO_CRITICAL = 0.95;

/**
 * The services every scenario uses: a small online shop.
 *
 * Three of them never break in the main story, on purpose. A board that only
 * ever shows the whole estate on fire proves nothing. Watching search,
 * accounts and reviews stay off the screen entirely, while the checkout path
 * lights up, is what shows the idea working.
 */
export const SERVICES = [
  // The checkout path, in rough order of how an order flows through it.
  'shipping',
  'checkout',
  'basket',
  'orders',
  // Everything else, which has nothing to do with shipping.
  'search',
  'accounts',
  'reviews',
] as const;

export type ServiceName = (typeof SERVICES)[number];

/** Availability per service, where 1 is perfect. Anything unnamed is perfect. */
export type Availability = Partial<Record<ServiceName, number>>;

/**
 * Builds the full list of services from a set of availabilities.
 *
 * Severity and score both come from the ratio through the same arithmetic the
 * adapter uses, so a demo and a real query cannot drift apart.
 */
const makeSignals = (availability: Availability = {}): NoiseSignal[] =>
  SERVICES.map((name) => {
    const score = scoreOfLower(availability[name] ?? 1, DEMO_WARNING, DEMO_CRITICAL);
    return { name, severity: severityFromScore(score), score };
  });

export interface ScenarioStep {
  /** How far into the loop this step starts, in milliseconds. */
  at: number;
  signals: NoiseSignal[];
}

export interface Scenario {
  id: string;
  /** Button label, as listed in Epic 3. */
  name: string;
  /** One line on what this scenario is for. */
  description: string;
  /** Loop length in milliseconds. Steps repeat forever on this cycle. */
  loopMs: number;
  steps: ScenarioStep[];
}

const seconds = (n: number) => n * 1000;

/** A scenario that never changes. Most of the buttons in Epic 3 are these. */
const fixed = (id: string, name: string, description: string, availability: Availability): Scenario => ({
  id,
  name,
  description,
  loopMs: seconds(1),
  steps: [{ at: 0, signals: makeSignals(availability) }],
});

/** Turns a table of seconds and availabilities into a scenario. */
const script = (
  id: string,
  name: string,
  description: string,
  loop: number,
  stages: Array<[number, Availability]>
): Scenario => ({
  id,
  name,
  description,
  loopMs: seconds(loop),
  steps: stages.map(([at, availability]) => ({ at: seconds(at), signals: makeSignals(availability) })),
});

/**
 * One dependency fails, and the shop fails around it.
 *
 * The shipping service starts missing its objective. Checkout goes next because
 * it cannot quote a delivery date without it, then the basket because it cannot
 * show a total, then orders because they cannot be placed. Search, accounts and
 * reviews never appear at all, because nothing is wrong with them.
 *
 * Each stage holds for eight seconds. Twelve was tried and bored people watching
 * the demo; three was tried and read as an unexplained total outage. Eight is
 * slow enough that somebody glancing up from a desk can follow what is
 * happening, and a test holds that floor.
 */
const blastRadius = script(
  'lifecycle',
  'Shipping Incident',
  'One dependency degrades and takes the checkout path with it, while the rest of the shop carries on.',
  84,
  [
    [0, {}],
    [8, { shipping: 0.988 }],
    [16, { shipping: 0.962, checkout: 0.989 }],
    [24, { shipping: 0.944, checkout: 0.976, basket: 0.9895 }],
    [32, { shipping: 0.928, checkout: 0.953, basket: 0.978, orders: 0.9897 }],
    // The worst of it.
    [40, { shipping: 0.915, checkout: 0.944, basket: 0.958, orders: 0.983 }],
    // Shipping is being fixed, but what sits behind it has spent availability
    // of its own and does not recover the moment it does.
    [48, { shipping: 0.968, checkout: 0.949, basket: 0.961, orders: 0.985 }],
    [56, { checkout: 0.982, basket: 0.972, orders: 0.9885 }],
    [64, { basket: 0.985, orders: 0.9899 }],
    [72, { basket: 0.9893 }],
    [80, {}],
  ]
);

export const SCENARIOS: Scenario[] = [
  blastRadius,
  fixed('all-quiet', 'All Quiet', 'Nothing is wrong. The screen should go quiet.', {}),
  fixed('one-warning', 'One Warning', 'One warning takes the whole screen.', { shipping: 0.985 }),
  fixed('one-critical', 'One Critical', 'One critical takes the whole screen.', { shipping: 0.93 }),
  fixed('two-problems', 'Two Problems', 'The screen splits in two.', {
    shipping: 0.93,
    checkout: 0.975,
  }),
  script(
    'growing-incident',
    'Growing Incident',
    'One problem appears, gets worse, and pulls others in.',
    20,
    [
      [0, {}],
      [3, { shipping: 0.985 }],
      [6, { shipping: 0.93 }],
      [10, { shipping: 0.92, checkout: 0.988 }],
      [14, { shipping: 0.91, checkout: 0.982, basket: 0.9895 }],
      [17, { shipping: 0.90, checkout: 0.94, basket: 0.988 }],
    ]
  ),
  fixed('major-incident', 'Major Incident', 'The whole checkout path is broken at once.', {
    shipping: 0.90,
    checkout: 0.93,
    basket: 0.955,
    orders: 0.972,
  }),
  script(
    'recovery',
    'Recovery',
    'Problems are fixed one by one and the rest take the space.',
    24,
    [
      [0, { shipping: 0.92, checkout: 0.952, basket: 0.978, orders: 0.988 }],
      [6, { checkout: 0.96, basket: 0.982, orders: 0.9895 }],
      [12, { basket: 0.985, orders: 0.9897 }],
      [18, {}],
    ]
  ),
  script(
    'chaos',
    'Chaos',
    'Services flicking between broken and fixed. The screen should stay calm.',
    12,
    [
      [0, { shipping: 0.93 }],
      [1.5, {}],
      [3, { shipping: 0.93, orders: 0.985 }],
      [4.5, { orders: 0.985 }],
      [6, { basket: 0.988, checkout: 0.93 }],
      [7.5, { checkout: 0.93 }],
      [9, {}],
      [10.5, { basket: 0.985, orders: 0.93 }],
    ]
  ),
];

export const scenarioById = (id: string): Scenario | undefined => SCENARIOS.find((s) => s.id === id);

/**
 * Reads a scenario's script at a given time.
 *
 * Repeats forever, and treats any time before the start as the start, so the
 * caller can pass in elapsed time without checking it first.
 */
export function signalsAt(scenario: Scenario, elapsedMs: number): NoiseSignal[] {
  const cycle = Math.max(1, scenario.loopMs);
  const t = ((elapsedMs % cycle) + cycle) % cycle;

  let current = scenario.steps[0];
  for (const step of scenario.steps) {
    if (step.at <= t) {
      current = step;
    } else {
      break;
    }
  }
  return current.signals;
}
