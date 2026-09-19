import { CRITICAL, NoiseItem, Unhealthy, WARNING } from '../noise/types';

import { DEFAULT_MAX_BOXES, capProblems } from './cap';

const item = (name: string, pressure: number, severity: Unhealthy = WARNING): NoiseItem => ({
  id: name,
  name,
  severity,
  firstSeen: 0,
  lastSeen: 0,
  persistence: 0,
  pressure,
});

const many = (count: number) => Array.from({ length: count }, (_, i) => item(`service-${String(i).padStart(3, '0')}`, i + 1));

describe('capProblems', () => {
  it('leaves a small board alone', () => {
    const problems = many(5);

    expect(capProblems(problems, 20)).toEqual({ shown: problems, hidden: [] });
  });

  it('leaves a board exactly at the limit alone', () => {
    expect(capProblems(many(20), 20).hidden).toEqual([]);
  });

  it('never puts more boxes on screen than asked, counting the one for the rest', () => {
    const { shown, hidden } = capProblems(many(300), 20);
    const boxes = shown.length + (hidden.length ? 1 : 0);

    expect(boxes).toBe(20);
  });

  it('accounts for every problem, shown or not', () => {
    const { shown, hidden } = capProblems(many(300), 20);

    expect(shown.length + hidden.length).toBe(300);
  });

  it('keeps the worst ones on screen', () => {
    const { shown } = capProblems(many(50), 10);
    const lowestShown = Math.min(...shown.map((s) => s.pressure));

    // Fifty problems scored 1 to 50; nine get their own box.
    expect(lowestShown).toBe(42);
  });

  it('puts the worst of the rest first, so it can speak for them', () => {
    const { hidden } = capProblems(many(50), 10);

    expect(hidden[0].pressure).toBe(41);
    expect(hidden[hidden.length - 1].pressure).toBe(1);
  });

  it('cuts the same way every time when scores tie', () => {
    const tied = ['orders', 'basket', 'checkout', 'shipping', 'search'].map((name) => item(name, 3));

    expect(capProblems(tied, 3)).toEqual(capProblems([...tied].reverse(), 3));
    expect(capProblems(tied, 3).shown.map((s) => s.name)).toEqual(['basket', 'checkout']);
  });

  it('never goes below room for one problem and the rest', () => {
    const { shown, hidden } = capProblems(many(10), 0);

    expect(shown).toHaveLength(1);
    expect(hidden).toHaveLength(9);
  });

  it('treats a nonsense limit as no limit at all', () => {
    expect(capProblems(many(40), NaN).hidden).toEqual([]);
    expect(capProblems(many(40), Infinity).hidden).toEqual([]);
  });

  it('keeps a critical over a warning with the same name order', () => {
    const problems = [item('orders', 1, WARNING), item('basket', 9, CRITICAL), item('search', 2, WARNING)];

    expect(capProblems(problems, 2).shown.map((s) => s.name)).toEqual(['basket']);
  });

  it('defaults to a limit that suits a television', () => {
    expect(DEFAULT_MAX_BOXES).toBe(20);
    expect(capProblems(many(100)).shown).toHaveLength(19);
  });
});
