import React from 'react';

import { DataFrame, FieldType, LoadingState, PanelProps, toDataFrame } from '@grafana/data';
import { render, screen } from '@testing-library/react';

import { NoisePanel } from './NoisePanel';
import { NoiseOptions } from './types';

const query = (rows: Array<[string, number]>) =>
  toDataFrame({
    fields: [
      { name: 'service', type: FieldType.string, values: rows.map(([name]) => name) },
      { name: 'status', type: FieldType.number, values: rows.map(([, value]) => value) },
    ],
  });

const propsWith = (
  series: DataFrame[] = [],
  size = { width: 800, height: 600 },
  options: Partial<NoiseOptions> = {}
) =>
  ({
    ...size,
    data: { series, state: LoadingState.Done, timeRange: {} },
    options,
  }) as unknown as PanelProps<NoiseOptions>;

const inScenario = (id: string, options: Partial<NoiseOptions> = {}) =>
  propsWith([], { width: 800, height: 600 }, { demoScenario: id, ...options });

describe('when the query has no numbers', () => {
  it('says it cannot read the data', () => {
    render(<NoisePanel {...propsWith([])} />);

    expect(screen.getByTestId('noise-panel-no-source')).toBeInTheDocument();
    expect(screen.queryByTestId('quiet-mode')).not.toBeInTheDocument();
  });

  it('says so when the query has only text', () => {
    const textOnly = toDataFrame({ fields: [{ name: 'note', type: FieldType.string, values: ['hello'] }] });
    render(<NoisePanel {...propsWith([textOnly])} />);

    expect(screen.getByTestId('noise-panel-no-source')).toBeInTheDocument();
  });

  it('fills the whole panel', () => {
    render(<NoisePanel {...propsWith([], { width: 1920, height: 1080 })} />);

    expect(screen.getByTestId('noise-panel-no-source')).toHaveStyle({ width: '1920px', height: '1080px' });
  });
});

describe('reading a real query', () => {
  it('shows only the services that are unhealthy', () => {
    render(
      <NoisePanel
        {...propsWith([
          query([
            ['checkout', 0.9],
            ['search', 0.985],
            ['kafka', 1],
          ]),
        ])}
      />
    );

    const problems = screen.getByTestId('treemap');
    expect(problems).toHaveTextContent('checkout');
    expect(problems).toHaveTextContent('critical');
    expect(problems).toHaveTextContent('search');
    expect(problems).not.toHaveTextContent('kafka');
  });

  it('goes quiet when every service is healthy', () => {
    render(
      <NoisePanel
        {...propsWith([
          query([
            ['checkout', 1],
            ['kafka', 1],
          ]),
        ])}
      />
    );

    expect(screen.getByTestId('quiet-mode')).toBeInTheDocument();
  });
});

describe('demo scenarios', () => {
  it('are used instead of the query', () => {
    render(<NoisePanel {...propsWith([query([['checkout', 0.9]])], { width: 800, height: 600 }, { demoScenario: 'all-quiet' })} />);

    expect(screen.getByTestId('quiet-mode')).toBeInTheDocument();
  });

  it('fall back to the query if the name is unknown', () => {
    render(<NoisePanel {...propsWith([query([['checkout', 0.9]])], { width: 800, height: 600 }, { demoScenario: 'nonsense' })} />);

    expect(screen.getByTestId('single-incident')).toHaveTextContent('checkout');
  });

  it('leave quiet mode as soon as a service breaks', () => {
    render(<NoisePanel {...inScenario('one-critical')} />);

    expect(screen.queryByTestId('quiet-mode')).not.toBeInTheDocument();
    expect(screen.getByTestId('single-incident')).toHaveTextContent('shipping');
  });

  it('show every broken service', () => {
    render(<NoisePanel {...inScenario('major-incident')} />);

    expect(screen.getAllByTestId('treemap-tile')).toHaveLength(4);
  });

  it('never show the half of the shop that is fine', () => {
    render(<NoisePanel {...inScenario('major-incident')} />);

    const board = screen.getByTestId('treemap');
    for (const untouched of ['search', 'reviews', 'accounts']) {
      expect(board).not.toHaveTextContent(untouched);
    }
  });
});

describe('the quiet mode setting', () => {
  it('gives quiet mode the whole panel', () => {
    render(<NoisePanel {...propsWith([], { width: 1920, height: 1080 }, { demoScenario: 'all-quiet' })} />);

    expect(screen.getByTestId('quiet-mode')).toHaveStyle({ width: '1920px', height: '1080px' });
  });

  it('shows an empty screen when turned off', () => {
    render(<NoisePanel {...inScenario('all-quiet', { quietMode: false })} />);

    expect(screen.queryByTestId('quiet-mode')).not.toBeInTheDocument();
    expect(screen.queryAllByTestId('treemap-tile')).toHaveLength(0);
  });
});

describe('picking a layout by how many services are broken', () => {
  it('gives one broken service the whole screen', () => {
    render(<NoisePanel {...propsWith([query([['checkout', 0.9]])])} />);

    expect(screen.getByTestId('single-incident')).toBeInTheDocument();
    expect(screen.queryByTestId('treemap')).not.toBeInTheDocument();
  });

  it('splits the screen for two or more', () => {
    render(
      <NoisePanel
        {...propsWith([
          query([
            ['checkout', 0.9],
            ['search', 0.985],
          ]),
        ])}
      />
    );

    expect(screen.queryByTestId('single-incident')).not.toBeInTheDocument();
    expect(screen.getByTestId('treemap')).toBeInTheDocument();
  });

  it('counts unhealthy services, not all of them', () => {
    render(
      <NoisePanel
        {...propsWith([
          query([
            ['checkout', 0.9],
            ['search', 1],
            ['kafka', 1],
            ['auth', 1],
          ]),
        ])}
      />
    );

    expect(screen.getByTestId('single-incident')).toHaveTextContent('checkout');
  });
});

describe('remembering between refreshes', () => {
  const refresh = (rows: Array<[string, number]>) => propsWith([query(rows)]);

  it('keeps a service on screen after one healthy check', () => {
    const { rerender } = render(<NoisePanel {...refresh([['checkout', 0.9]])} />);
    expect(screen.getByTestId('single-incident')).toHaveTextContent('checkout');

    rerender(<NoisePanel {...refresh([['checkout', 1]])} />);

    expect(screen.getByTestId('single-incident')).toHaveTextContent('checkout');
    expect(screen.queryByTestId('quiet-mode')).not.toBeInTheDocument();
  });

  it('removes it after two healthy checks', () => {
    const { rerender } = render(<NoisePanel {...refresh([['checkout', 0.9]])} />);

    rerender(<NoisePanel {...refresh([['checkout', 1]])} />);
    rerender(<NoisePanel {...refresh([['checkout', 1]])} />);

    expect(screen.getByTestId('quiet-mode')).toBeInTheDocument();
  });

  it('keeps a flickering service on screen', () => {
    const { rerender } = render(<NoisePanel {...refresh([['checkout', 0.9]])} />);

    for (let i = 0; i < 6; i++) {
      rerender(<NoisePanel {...refresh([['checkout', i % 2 === 0 ? 0 : 2]])} />);
      expect(screen.queryByTestId('quiet-mode')).not.toBeInTheDocument();
    }
  });

  it('shows a new problem straight away', () => {
    const { rerender } = render(<NoisePanel {...refresh([['checkout', 1]])} />);
    expect(screen.getByTestId('quiet-mode')).toBeInTheDocument();

    rerender(<NoisePanel {...refresh([['checkout', 0.9]])} />);

    expect(screen.getByTestId('single-incident')).toHaveTextContent('checkout');
  });

  it('does not treat a missing service as fixed', () => {
    const { rerender } = render(<NoisePanel {...refresh([['checkout', 0.9]])} />);

    rerender(<NoisePanel {...propsWith([query([['search', 1]])])} />);
    rerender(<NoisePanel {...propsWith([query([['search', 1]])])} />);

    expect(screen.getByTestId('single-incident')).toHaveTextContent('checkout');
  });

  it('starts again when the data source changes', () => {
    const { rerender } = render(<NoisePanel {...refresh([['checkout', 0.9]])} />);

    rerender(<NoisePanel {...inScenario('all-quiet')} />);

    expect(screen.getByTestId('quiet-mode')).toBeInTheDocument();
  });
});

describe('the settings', () => {
  const table = (rows: Array<[string, number, number]>) =>
    toDataFrame({
      fields: [
        { name: 'region', type: FieldType.string, values: rows.map(([r]) => r) },
        { name: 'service', type: FieldType.string, values: rows.map((r, i) => ['checkout', 'search'][i]) },
        { name: 'status', type: FieldType.number, values: rows.map(([, , v]) => v) },
        { name: 'latency', type: FieldType.number, values: rows.map(([, l]) => l) },
      ],
    });

  it('read the columns the user picks', () => {
    render(
      <NoisePanel
        {...propsWith([table([['eu', 0, 0.9]])], { width: 800, height: 600 }, {
          nameField: 'service',
          valueField: 'status',
        })}
      />
    );

    expect(screen.getByTestId('single-incident')).toHaveTextContent('checkout');
  });

  it('use the warning and critical levels the user sets', () => {
    render(
      <NoisePanel
        {...propsWith([query([['checkout', 80]])], { width: 800, height: 600 }, { warning: 70, critical: 90, direction: 'higher-is-worse' })}
      />
    );

    expect(screen.getByTestId('single-incident')).toHaveAttribute('data-severity', 'warning');
  });

  it('treat a value below the warning level as healthy', () => {
    render(
      <NoisePanel
        {...propsWith([query([['checkout', 50]])], { width: 800, height: 600 }, { warning: 70, critical: 90, direction: 'higher-is-worse' })}
      />
    );

    expect(screen.getByTestId('quiet-mode')).toBeInTheDocument();
  });

  it('can turn off growing with age', () => {
    render(<NoisePanel {...inScenario('two-problems', { usePersistence: false })} />);

    expect(screen.getAllByTestId('treemap-tile')).toHaveLength(2);
  });
});

describe('a panel nobody has configured', () => {
  // The most dangerous failure this panel has: a calm screen during an outage.
  // A panel with no options set must read availability the same way the
  // documented defaults say it will, or it quietly shows a broken estate as fine.
  const availability = (rows: Array<[string, number]>) => propsWith([query(rows)], { width: 1600, height: 900 }, {});

  it('reads a 90% availability as a problem, not as healthy', () => {
    render(<NoisePanel {...availability([['shipping', 0.9]])} />);

    expect(screen.queryByTestId('quiet-mode')).not.toBeInTheDocument();
    expect(screen.getByTestId('single-incident')).toHaveAttribute('data-severity', 'critical');
  });

  it('reads a perfect availability as healthy', () => {
    render(<NoisePanel {...availability([['shipping', 1]])} />);

    expect(screen.getByTestId('quiet-mode')).toBeInTheDocument();
  });

  it('warns on a slightly degraded availability', () => {
    render(<NoisePanel {...availability([['shipping', 0.985]])} />);

    expect(screen.getByTestId('single-incident')).toHaveAttribute('data-severity', 'warning');
  });
});

describe('settings reaching the drawing code', () => {
  // Every one of these failed to reach the treemap at least once, because the
  // panel builds it in one place and nothing checked the wiring. Testing the
  // treemap on its own is not enough.
  const classesOn = (name: string) =>
    (document.querySelector(`[data-name="${name}"]`) as HTMLElement).className.split(' ').filter(Boolean).length;

  it('passes the appear-and-disappear style through', () => {
    const { unmount } = render(<NoisePanel {...inScenario('major-incident')} />);
    const withAnimation = classesOn('shipping');
    unmount();

    render(<NoisePanel {...inScenario('major-incident', { transitionStyle: 'none' })} />);

    expect(classesOn('shipping')).toBeLessThan(withAnimation);
  });

  it('passes the animation time through', () => {
    render(<NoisePanel {...inScenario('major-incident', { transitionMs: 900 })} />);

    expect((document.querySelector('[data-name="shipping"]') as HTMLElement).style.transitionDuration).toBe('900ms');
  });

  it('passes the most boxes on screen through', () => {
    // Eight services broken, room for three boxes: two named and one for the rest.
    const lots = query(
      ['shipping', 'checkout', 'basket', 'orders', 'search', 'accounts', 'reviews', 'payments'].map(
        (name) => [name, 0.9] as [string, number]
      )
    );
    render(<NoisePanel {...propsWith([lots], { width: 1600, height: 900 }, { maxBoxes: 3 })} />);

    expect(screen.getAllByTestId('treemap-tile')).toHaveLength(3);
    expect(document.querySelector('[data-overflow]')).toHaveTextContent('+6 more');
  });

  it('passes the quiet mark through', () => {
    render(<NoisePanel {...inScenario('all-quiet', { quietMark: 'text' })} />);

    expect(screen.getByText('noise is bad.')).toBeInTheDocument();
  });
});
