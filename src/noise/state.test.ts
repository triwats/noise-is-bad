import { HEALTHY_CHECKS_TO_CLEAR, emptyState, getItems, isRecovering, update } from './state';
import { CRITICAL, HEALTHY, NoiseSignal, WARNING } from './types';

const at = (name: string, severity: 0 | 1 | 2): NoiseSignal => ({ name, severity });
const minutes = (n: number) => n * 60_000;

const T0 = 1_700_000_000_000;

const names = (state: ReturnType<typeof update>) => state.tracked.map((item) => item.name);

describe('a service breaking', () => {
  it('shows straight away', () => {
    const state = update(emptyState, [at('checkout', CRITICAL)], T0);

    expect(names(state)).toEqual(['checkout']);
    expect(getItems(state, T0)[0]).toMatchObject({ name: 'checkout', severity: CRITICAL, firstSeen: T0 });
  });

  it('ignores healthy services', () => {
    const state = update(emptyState, [at('kafka', HEALTHY)], T0);

    expect(state.tracked).toEqual([]);
  });

  it('tracks each broken service separately', () => {
    const state = update(emptyState, [at('checkout', CRITICAL), at('search', WARNING), at('kafka', HEALTHY)], T0);

    expect(names(state)).toEqual(['checkout', 'search']);
  });
});

describe('how long a problem has lasted', () => {
  it('remembers when the problem started', () => {
    let state = update(emptyState, [at('checkout', CRITICAL)], T0);
    state = update(state, [at('checkout', CRITICAL)], T0 + 30_000);
    state = update(state, [at('checkout', CRITICAL)], T0 + 60_000);

    expect(getItems(state, T0 + 60_000)[0]).toMatchObject({ firstSeen: T0, lastSeen: T0 + 60_000 });
  });

  it('keeps counting between refreshes', () => {
    const state = update(emptyState, [at('checkout', CRITICAL)], T0);

    expect(getItems(state, T0 + 45_000)[0].persistence).toBe(45_000);
    expect(getItems(state, T0 + minutes(10))[0].persistence).toBe(minutes(10));
  });

  it('treats a warning turning critical as the same problem', () => {
    let state = update(emptyState, [at('checkout', WARNING)], T0);
    state = update(state, [at('checkout', CRITICAL)], T0 + minutes(3));

    const [item] = getItems(state, T0 + minutes(3));
    expect(item.severity).toBe(CRITICAL);
    expect(item.firstSeen).toBe(T0);
    expect(item.persistence).toBe(minutes(3));
  });

  it('gives an older problem a higher score', () => {
    const state = update(emptyState, [at('checkout', CRITICAL)], T0);

    expect(getItems(state, T0)[0].pressure).toBe(3);
    expect(getItems(state, T0 + minutes(5))[0].pressure).toBe(6);
  });

  it('never reports a negative age', () => {
    const state = update(emptyState, [at('checkout', CRITICAL)], T0);

    expect(getItems(state, T0 - 5_000)[0].persistence).toBe(0);
  });
});

describe('waiting before clearing a problem', () => {
  it('keeps it after one healthy check', () => {
    let state = update(emptyState, [at('checkout', CRITICAL)], T0);
    state = update(state, [at('checkout', HEALTHY)], T0 + 10_000);

    expect(names(state)).toEqual(['checkout']);
    expect(isRecovering(state, 'checkout')).toBe(true);
  });

  it('clears it after two healthy checks', () => {
    let state = update(emptyState, [at('checkout', CRITICAL)], T0);
    for (let i = 1; i <= HEALTHY_CHECKS_TO_CLEAR; i++) {
      state = update(state, [at('checkout', HEALTHY)], T0 + i * 10_000);
    }

    expect(state.tracked).toEqual([]);
  });

  it('starts counting again if the problem returns', () => {
    let state = update(emptyState, [at('checkout', CRITICAL)], T0);
    state = update(state, [at('checkout', HEALTHY)], T0 + 10_000);
    state = update(state, [at('checkout', CRITICAL)], T0 + 20_000);
    state = update(state, [at('checkout', HEALTHY)], T0 + 30_000);

    expect(names(state)).toEqual(['checkout']);
    expect(isRecovering(state, 'checkout')).toBe(true);
  });

  it('keeps a flickering service on screen the whole time', () => {
    let state = update(emptyState, [at('checkout', CRITICAL)], T0);

    // Alternating bad and good never gives two good readings in a row.
    for (let i = 1; i <= 12; i++) {
      state = update(state, [at('checkout', i % 2 === 0 ? CRITICAL : HEALTHY)], T0 + i * 10_000);
      expect(names(state)).toEqual(['checkout']);
    }
  });

  it('does not reset the age if it returns before clearing', () => {
    let state = update(emptyState, [at('checkout', CRITICAL)], T0);
    state = update(state, [at('checkout', HEALTHY)], T0 + 10_000);
    state = update(state, [at('checkout', CRITICAL)], T0 + 20_000);

    expect(getItems(state, T0 + 20_000)[0].firstSeen).toBe(T0);
  });

  it('starts a new problem if it returns after clearing', () => {
    let state = update(emptyState, [at('checkout', CRITICAL)], T0);
    state = update(state, [at('checkout', HEALTHY)], T0 + 10_000);
    state = update(state, [at('checkout', HEALTHY)], T0 + 20_000);
    state = update(state, [at('checkout', CRITICAL)], T0 + 30_000);

    expect(getItems(state, T0 + 30_000)[0].firstSeen).toBe(T0 + 30_000);
  });

  it('clears each service on its own', () => {
    let state = update(emptyState, [at('checkout', CRITICAL), at('search', WARNING)], T0);
    state = update(state, [at('checkout', HEALTHY), at('search', WARNING)], T0 + 10_000);
    state = update(state, [at('checkout', HEALTHY), at('search', WARNING)], T0 + 20_000);

    expect(names(state)).toEqual(['search']);
  });
});

describe('a service missing from the data', () => {
  it('keeps the problem instead of assuming it is fixed', () => {
    let state = update(emptyState, [at('checkout', CRITICAL)], T0);
    state = update(state, [], T0 + 10_000);
    state = update(state, [], T0 + 20_000);

    expect(names(state)).toEqual(['checkout']);
  });

  it('does not count towards clearing while it is missing', () => {
    let state = update(emptyState, [at('checkout', CRITICAL)], T0);
    state = update(state, [at('checkout', HEALTHY)], T0 + 10_000);
    state = update(state, [], T0 + 20_000);
    state = update(state, [], T0 + 30_000);

    expect(names(state)).toEqual(['checkout']);
    expect(isRecovering(state, 'checkout')).toBe(true);
  });

  it('keeps ageing a problem it can no longer see', () => {
    let state = update(emptyState, [at('checkout', CRITICAL)], T0);
    state = update(state, [], T0 + minutes(5));

    expect(getItems(state, T0 + minutes(5))[0].persistence).toBe(minutes(5));
  });
});

describe('ordering', () => {
  it('keeps existing problems in order and adds new ones at the end', () => {
    let state = update(emptyState, [at('checkout', CRITICAL)], T0);
    state = update(state, [at('checkout', CRITICAL), at('search', WARNING)], T0 + 10_000);
    state = update(state, [at('checkout', CRITICAL), at('search', WARNING), at('kafka', WARNING)], T0 + 20_000);

    expect(names(state)).toEqual(['checkout', 'search', 'kafka']);
  });

  it('does not reorder when one in the middle clears', () => {
    let state = update(emptyState, [at('a', CRITICAL), at('b', CRITICAL), at('c', CRITICAL)], T0);
    state = update(state, [at('a', CRITICAL), at('b', HEALTHY), at('c', CRITICAL)], T0 + 10_000);
    state = update(state, [at('a', CRITICAL), at('b', HEALTHY), at('c', CRITICAL)], T0 + 20_000);

    expect(names(state)).toEqual(['a', 'c']);
  });
});

describe('general behaviour', () => {
  it('does not change the state it was given', () => {
    const first = update(emptyState, [at('checkout', CRITICAL)], T0);
    const snapshot = JSON.stringify(first);

    update(first, [at('checkout', HEALTHY), at('search', CRITICAL)], T0 + 10_000);

    expect(JSON.stringify(first)).toBe(snapshot);
  });

  it('reports nothing when it is empty', () => {
    expect(getItems(emptyState, T0)).toEqual([]);
  });
});
