import React from 'react';

import { render, screen } from '@testing-library/react';

import { DVD_ASPECT, DVD_PALETTE, DvdMark } from './dvdMark';

describe('DvdMark', () => {
  it('carries the seven colours the screensaver cycles through', () => {
    expect(DVD_PALETTE).toHaveLength(7);
    expect(new Set(DVD_PALETTE).size).toBe(7);
    DVD_PALETTE.forEach((colour) => expect(colour).toMatch(/^#[0-9a-f]{6}$/));
  });

  it('is wider than it is tall, as the logo is', () => {
    expect(DVD_ASPECT).toBeCloseTo(2.263, 2);
  });

  it('inherits its colour so the animation can recolour it from the parent', () => {
    const { container } = render(<DvdMark width={240} height={106} />);
    const paths = container.querySelectorAll('path');

    expect(paths.length).toBeGreaterThan(0);
    paths.forEach((path) => expect(path.getAttribute('fill')).toBe('currentColor'));
  });

  it('draws at the size it is given, in its own coordinate space', () => {
    render(<DvdMark width={240} height={106} />);
    const svg = screen.getByTestId('dvd-mark');

    expect(svg).toHaveAttribute('width', '240');
    expect(svg).toHaveAttribute('height', '106');
    expect(svg).toHaveAttribute('viewBox', '0 0 187.09 82.68');
  });

  it('says nothing to a screen reader, being decoration', () => {
    render(<DvdMark width={240} height={106} />);

    expect(screen.getByTestId('dvd-mark')).toHaveAttribute('aria-hidden', 'true');
  });
});
