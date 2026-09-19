import React from 'react';

import { render, screen } from '@testing-library/react';

import { CRITICAL, WARNING } from '../noise/types';
import { SingleIncident } from './SingleIncident';
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

const show = (
  name: string,
  severity: typeof WARNING | typeof CRITICAL,
  size = { width: 1200, height: 800 },
  pressure = 1
) =>
  render(
    <SingleIncident
      signal={{ id: name, name, severity, firstSeen: 0, lastSeen: 0, persistence: 0, pressure }}
      {...size}
      theme={theme}
    />
  );

const sizeOf = (text: string) => parseFloat(screen.getByText(text).style.fontSize);

describe('SingleIncident', () => {
  it('shows the name and how bad it is', () => {
    show('checkout', CRITICAL);

    expect(screen.getByText('checkout')).toBeInTheDocument();
    expect(screen.getByTestId('single-incident-severity')).toHaveTextContent('critical');
  });

  it('takes the whole panel', () => {
    show('checkout', CRITICAL, { width: 1920, height: 1080 });

    expect(screen.getByTestId('single-incident')).toHaveStyle({ width: '1920px', height: '1080px' });
  });

  it('shows nothing else', () => {
    show('checkout', WARNING);

    // No graphs, values, timestamps or explanation, per Epic 5.
    expect(screen.getByTestId('single-incident').textContent).toBe('checkoutwarning');
  });

  const paintedColour = () =>
    (screen.getByTestId('single-incident').firstElementChild as HTMLElement).style.background;

  it('uses a different colour for warning and critical', () => {
    const { unmount } = show('checkout', WARNING);
    const warning = paintedColour();
    unmount();

    show('checkout', CRITICAL);

    expect(warning).not.toBe('');
    expect(warning).not.toBe(paintedColour());
  });

  it('paints the whole panel, not just the words', () => {
    show('checkout', CRITICAL);

    const fill = screen.getByTestId('single-incident').firstElementChild as HTMLElement;
    expect(fill).toHaveStyle({ background: '#ff0000' });
    expect(parseFloat(fill.style.opacity)).toBeGreaterThan(0.4);
  });

  it('always has a background behind the colour', () => {
    show('checkout', WARNING);

    expect(screen.getByTestId('single-incident')).toHaveStyle({ background: '#0b0c0e' });
  });

  it('paints an older problem more strongly', () => {
    const { unmount } = show('checkout', CRITICAL, { width: 1200, height: 800 }, 3);
    const fresh = parseFloat((screen.getByTestId('single-incident').firstElementChild as HTMLElement).style.opacity);
    unmount();

    show('checkout', CRITICAL, { width: 1200, height: 800 }, 6);

    expect(parseFloat((screen.getByTestId('single-incident').firstElementChild as HTMLElement).style.opacity)).toBeGreaterThan(fresh);
  });

  it.each([
    ['a short name in a wide panel', 'auth', { width: 1600, height: 400 }],
    ['a long name in a narrow panel', 'checkout-service-eu', { width: 500, height: 900 }],
    ['a square panel', 'checkout', { width: 800, height: 800 }],
  ])('uses a different weight and size too, with %s', (_case, name, size) => {
    const { unmount } = show(name, WARNING, size);
    const warningWeight = screen.getByText(name).style.fontWeight;
    const warningSize = sizeOf(name);
    unmount();

    show(name, CRITICAL, size);

    expect(Number(screen.getByText(name).style.fontWeight)).toBeGreaterThan(Number(warningWeight));
    expect(sizeOf(name)).toBeGreaterThan(warningSize);
  });

  it('marks how bad it is on the element', () => {
    show('checkout', CRITICAL);

    expect(screen.getByTestId('single-incident')).toHaveAttribute('data-severity', 'critical');
  });

  it('makes a long name smaller so it fits', () => {
    const { unmount } = show('auth', CRITICAL);
    const short = sizeOf('auth');
    unmount();

    show('checkout-service-europe-west-2', CRITICAL);

    expect(sizeOf('checkout-service-europe-west-2')).toBeLessThan(short);
  });

  it('uses bigger text on a bigger panel', () => {
    const { unmount } = show('checkout', CRITICAL, { width: 400, height: 200 });
    const small = sizeOf('checkout');
    unmount();

    show('checkout', CRITICAL, { width: 1920, height: 1080 });

    expect(sizeOf('checkout')).toBeGreaterThan(small);
  });
});
