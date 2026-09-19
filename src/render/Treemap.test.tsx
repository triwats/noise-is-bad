import React from 'react';

import { act, render, screen } from '@testing-library/react';

import { CRITICAL, NoiseItem, Unhealthy, WARNING } from '../noise/types';
import { pressureOf, severityWeight } from '../noise/pressure';
import { Treemap } from './Treemap';
import { fillStrength } from './fill';
import { NoiseTheme } from './theme';

const theme: NoiseTheme = {
  canvas: '#0b0c0e',
  mark: '#ffffff',
  dim: '#aaaaaa',
  faint: '#555555',
  warning: '#ffaa00',
  critical: '#ff0000',
  edge: '#333333',
};

const item = (name: string, severity: Unhealthy, persistence = 0): NoiseItem => ({
  id: name,
  name,
  severity,
  firstSeen: 0,
  lastSeen: 0,
  persistence,
  pressure: pressureOf(severityWeight(severity), persistence),
});

const warn = (name: string, persistence = 0) => item(name, WARNING, persistence);
const crit = (name: string, persistence = 0) => item(name, CRITICAL, persistence);

const show = (problems: NoiseItem[], props: Partial<{ transitionMs: number }> = {}) =>
  render(<Treemap problems={problems} width={1000} height={600} theme={theme} {...props} />);

const tile = (name: string) => document.querySelector(`[data-name="${name}"]`) as HTMLElement;
const areaOf = (name: string) => parseFloat(tile(name).style.width) * parseFloat(tile(name).style.height);

describe('Treemap', () => {
  it('draws one box per broken service', () => {
    show([crit('checkout'), warn('search'), warn('kafka')]);

    expect(screen.getAllByTestId('treemap-tile')).toHaveLength(3);
  });

  it('shows each name and how bad it is', () => {
    show([crit('checkout'), warn('search')]);

    expect(tile('checkout')).toHaveTextContent('checkout');
    expect(tile('checkout')).toHaveTextContent('critical');
    expect(tile('search')).toHaveTextContent('warning');
  });

  it('gives a critical service more space than a warning', () => {
    show([crit('checkout'), warn('search')]);

    expect(areaOf('checkout')).toBeGreaterThan(areaOf('search'));
  });

  it('splits space evenly when two are equally bad', () => {
    show([warn('checkout'), warn('search')]);

    expect(areaOf('checkout')).toBeCloseTo(areaOf('search'), -2);
  });

  it('marks how bad each one is on the element', () => {
    show([crit('checkout'), warn('search')]);

    expect(tile('checkout')).toHaveAttribute('data-severity', 'critical');
    expect(tile('search')).toHaveAttribute('data-severity', 'warning');
  });

  it('uses the animation time it is given', () => {
    show([crit('checkout'), warn('search')], { transitionMs: 800 });

    expect(tile('checkout').style.transitionDuration).toBe('800ms');
  });

  it('uses an animation time the plan asks for', () => {
    show([crit('checkout'), warn('search')]);

    const ms = parseInt(tile('checkout').style.transitionDuration, 10);
    expect(ms).toBeGreaterThanOrEqual(300);
    expect(ms).toBeLessThanOrEqual(800);
  });

  it('reuses the same box so it can slide instead of flashing', () => {
    const { rerender } = show([crit('checkout'), warn('search')]);
    const before = tile('checkout');

    rerender(<Treemap problems={[crit('checkout'), warn('search'), warn('kafka')]} width={1000} height={600} theme={theme} />);

    expect(tile('checkout')).toBe(before);
  });

  it('gives the space back to the others when one is fixed', () => {
    const { rerender } = show([crit('checkout'), warn('search'), warn('kafka')]);
    const crowded = areaOf('checkout');

    rerender(<Treemap problems={[crit('checkout'), warn('search')]} width={1000} height={600} theme={theme} />);

    expect(screen.getAllByTestId('treemap-tile')).toHaveLength(2);
    expect(areaOf('checkout')).toBeGreaterThan(crowded);
  });

  it('draws nothing when nothing is broken', () => {
    show([]);

    expect(screen.queryAllByTestId('treemap-tile')).toHaveLength(0);
  });

  it('copes with a panel of no size', () => {
    expect(() => render(<Treemap problems={[crit('checkout')]} width={0} height={0} theme={theme} />)).not.toThrow();
  });
});

describe('sizing boxes by how long a problem has lasted', () => {
  it('gives an old warning more space than a new one', () => {
    show([warn('checkout', 6 * 60_000), warn('search', 0)]);

    expect(areaOf('checkout')).toBeGreaterThan(areaOf('search'));
  });

  it('still gives a new critical more space than an old warning', () => {
    // A warning at five minutes is 1 x 2 = 2; a fresh critical is 3 x 1 = 3.
    show([warn('checkout', 6 * 60_000), crit('search', 0)]);

    expect(areaOf('search')).toBeGreaterThan(areaOf('checkout'));
    expect(areaOf('search')).toBeLessThan(areaOf('checkout') * 2);
  });
});

describe('how strongly a box is filled', () => {
  it('keeps a new problem clearly coloured', () => {
    expect(fillStrength(1)).toBeGreaterThan(0.4);
  });

  it('gets stronger the longer a problem lasts', () => {
    expect(fillStrength(6)).toBeGreaterThan(fillStrength(3));
    expect(fillStrength(3)).toBeGreaterThan(fillStrength(1));
  });

  it('always returns a usable opacity', () => {
    for (const pressure of [-5, 0, 1, 6, 50, 1000]) {
      expect(fillStrength(pressure)).toBeGreaterThanOrEqual(0);
      expect(fillStrength(pressure)).toBeLessThanOrEqual(1);
    }
  });
});

describe('boxes too small for text', () => {
  const many = (count: number) =>
    Array.from({ length: count }, (_, i) => warn(`service-number-${i}`));

  it('drops the name but keeps the colour', () => {
    // No cap here: this is about small boxes losing their text, and capping is
    // tested on its own.
    render(<Treemap problems={many(40)} width={400} height={240} theme={theme} maxBoxes={Infinity} />);

    const tiles = screen.getAllByTestId('treemap-tile');
    const unlabelled = tiles.filter((t) => t.dataset.labelled === 'no');

    expect(tiles).toHaveLength(40);
    expect(unlabelled.length).toBeGreaterThan(0);
  });

  it('shows every name when there is room', () => {
    render(<Treemap problems={many(4)} width={1600} height={900} theme={theme} />);

    expect(screen.getAllByTestId('treemap-tile').every((t) => t.dataset.labelled === 'yes')).toBe(true);
  });
});

describe('the board background', () => {
  it('is always painted, so the gaps are lines rather than holes', () => {
    show([crit('checkout'), warn('search')]);

    expect(screen.getByTestId('treemap')).toHaveStyle({ background: '#0b0c0e' });
  });

  it('is still painted when nothing is broken', () => {
    show([]);

    expect(screen.getByTestId('treemap')).toHaveStyle({ background: '#0b0c0e' });
  });
});

describe('how boxes come and go', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const board = (problems: NoiseItem[], style?: 'fade' | 'grow' | 'flash' | 'none') => (
    <Treemap problems={problems} width={1000} height={600} theme={theme} transitionStyle={style} />
  );

  const leaving = () => screen.queryAllByTestId('treemap-tile-leaving');

  it('keeps a box on screen for a moment after its problem clears', () => {
    const { rerender } = render(board([crit('checkout'), warn('search')]));
    expect(leaving()).toHaveLength(0);

    rerender(board([crit('checkout')]));

    expect(leaving()).toHaveLength(1);
    expect(leaving()[0].dataset.name).toBe('search');
  });

  it('lets go of it once the animation has finished', () => {
    const { rerender } = render(board([crit('checkout'), warn('search')]));
    rerender(board([crit('checkout')]));
    expect(leaving()).toHaveLength(1);

    act(() => {
      jest.advanceTimersByTime(600);
    });

    expect(leaving()).toHaveLength(0);
  });

  it('gives the space to the survivors straight away, without waiting', () => {
    const { rerender } = render(board([crit('checkout'), warn('search')]));
    const before = areaOf('checkout');

    rerender(board([crit('checkout')]));

    expect(areaOf('checkout')).toBeGreaterThan(before);
  });

  it('animates nothing at all when told not to', () => {
    const { rerender } = render(board([crit('checkout'), warn('search')], 'none'));
    rerender(board([crit('checkout')], 'none'));

    expect(leaving()).toHaveLength(0);
  });

  it('draws several departures at once', () => {
    const { rerender } = render(board([crit('checkout'), warn('search'), warn('kafka')]));
    rerender(board([crit('checkout')]));

    expect(leaving().map((t) => t.dataset.name).sort()).toEqual(['kafka', 'search']);
  });

  it('does not leave a ghost behind when a box only changes size', () => {
    const { rerender } = render(board([crit('checkout'), warn('search')]));
    rerender(board([crit('checkout'), crit('search')]));

    expect(leaving()).toHaveLength(0);
  });

  // jsdom does not work out what an animation shorthand resolves to, so these
  // check the classes actually applied. Whether they look right is a question
  // for a television, which is the reason this is a setting in the first place.
  const classCount = (name: string) => tile(name).className.split(' ').filter(Boolean).length;

  it.each(['fade', 'grow', 'flash'] as const)('%s adds an animation to an arriving box', (style) => {
    render(board([crit('checkout'), warn('search')], style));

    expect(classCount('checkout')).toBeGreaterThan(1);
  });

  it('none leaves an arriving box with no animation', () => {
    render(board([crit('checkout'), warn('search')], 'none'));

    expect(classCount('checkout')).toBe(1);
  });

  it('tells the styles apart', () => {
    const { unmount } = render(board([crit('checkout'), warn('search')], 'grow'));
    const grow = tile('checkout').className;
    unmount();

    render(board([crit('checkout'), warn('search')], 'flash'));

    expect(tile('checkout').className).not.toBe(grow);
  });
});

describe('when there are more problems than fit', () => {
  const lots = (count: number) =>
    Array.from({ length: count }, (_, i) => warn(`service-${String(i).padStart(3, '0')}`, i * 1000));

  const boxes = () => screen.getAllByTestId('treemap-tile');
  const overflowBox = () => document.querySelector('[data-overflow]') as HTMLElement | null;

  it('never draws more boxes than asked, counting the one for the rest', () => {
    render(<Treemap problems={lots(300)} width={1600} height={900} theme={theme} maxBoxes={12} />);

    expect(boxes()).toHaveLength(12);
  });

  it('says how many more there are rather than hiding them', () => {
    render(<Treemap problems={lots(300)} width={1600} height={900} theme={theme} maxBoxes={12} />);

    expect(overflowBox()).not.toBeNull();
    expect(overflowBox()!.dataset.overflow).toBe('289');
    expect(overflowBox()).toHaveTextContent('+289 more');
  });

  it('colours the rest by the worst thing among them', () => {
    const problems = [...lots(20), crit('hidden-critical', 0)];
    // The critical scores 3, but twenty warnings aged a long time can outscore
    // it, so force it to be the worst of the hidden ones by capping hard.
    render(<Treemap problems={problems} width={1600} height={900} theme={theme} maxBoxes={2} />);

    const shown = boxes().filter((b) => !b.hasAttribute('data-overflow'));
    expect(shown).toHaveLength(1);
    expect(overflowBox()).not.toBeNull();
  });

  it('draws no extra box when everything fits', () => {
    render(<Treemap problems={lots(5)} width={1600} height={900} theme={theme} maxBoxes={12} />);

    expect(boxes()).toHaveLength(5);
    expect(overflowBox()).toBeNull();
  });

  it('keeps the named boxes as the worst ones', () => {
    // Twenty-six warnings and four criticals. A critical scores three times a
    // warning, so with room for four named boxes the criticals take all four.
    const problems = [
      ...lots(26),
      crit('shipping'),
      crit('checkout'),
      crit('basket'),
      crit('orders'),
    ];
    render(<Treemap problems={problems} width={1600} height={900} theme={theme} maxBoxes={5} />);

    const names = boxes()
      .filter((b) => !b.hasAttribute('data-overflow'))
      .map((b) => b.dataset.name)
      .sort();

    expect(names).toEqual(['basket', 'checkout', 'orders', 'shipping']);
  });

  it('keeps the same box for the rest as its count changes, so it slides instead of flashing', () => {
    const { rerender } = render(<Treemap problems={lots(30)} width={1600} height={900} theme={theme} maxBoxes={5} />);
    const before = overflowBox();

    rerender(<Treemap problems={lots(40)} width={1600} height={900} theme={theme} maxBoxes={5} />);

    expect(overflowBox()).toBe(before);
    expect(overflowBox()).toHaveTextContent('+36 more');
  });
});
