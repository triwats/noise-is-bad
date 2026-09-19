import React from 'react';

import { render, screen } from '@testing-library/react';

import { LOCKUP_ASPECT } from './brand';
import { DVD_PALETTE } from './dvdMark';
import { QuietMark, QuietMode } from './QuietMode';
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

const markEl = () => screen.getByTestId('quiet-mark');
const transformOf = () => markEl().style.transform;
const colourOf = () => markEl().style.color;

/** jsdom reports colours as `rgb(r, g, b)`, whatever went in. */
const asRgb = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
};

describe('QuietMode', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('fills the whole panel', () => {
    render(<QuietMode width={1920} height={1080} theme={theme} />);

    expect(screen.getByTestId('quiet-mode')).toHaveStyle({ width: '1920px', height: '1080px' });
  });

  it('moves the mark once it starts', () => {
    render(<QuietMode width={800} height={600} theme={theme} />);

    jest.advanceTimersByTime(500);
    const first = transformOf();
    expect(first).toMatch(/translate3d/);

    jest.advanceTimersByTime(500);
    expect(transformOf()).not.toBe(first);
  });

  it('keeps moving for a long time', () => {
    render(<QuietMode width={800} height={600} theme={theme} />);

    jest.advanceTimersByTime(60_000);
    const midway = transformOf();

    jest.advanceTimersByTime(60_000);
    expect(transformOf()).not.toBe(midway);
  });

  it('stops cleanly when removed', () => {
    const cancel = jest.spyOn(window, 'cancelAnimationFrame');
    const { unmount } = render(<QuietMode width={800} height={600} theme={theme} />);

    jest.advanceTimersByTime(100);
    unmount();

    expect(cancel).toHaveBeenCalled();
    cancel.mockRestore();
  });

  it('keeps going when the panel is resized', () => {
    const { rerender } = render(<QuietMode width={800} height={600} theme={theme} />);

    jest.advanceTimersByTime(2_000);
    const before = transformOf();

    rerender(<QuietMode width={400} height={300} theme={theme} />);
    // One frame after the resize the mark has moved on, not jumped to the start.
    jest.advanceTimersByTime(16);

    expect(transformOf()).toMatch(/translate3d/);
    expect(transformOf()).not.toBe(before);
  });

  it('copes with a panel of no size', () => {
    expect(() => render(<QuietMode width={0} height={0} theme={theme} />)).not.toThrow();
  });

  describe('our logo', () => {
    it('is our lockup, not the DVD logo', () => {
      render(<QuietMode width={800} height={600} theme={theme} mark="text" />);

      expect(screen.getByRole('img', { name: 'noise is bad.' })).toBeInTheDocument();
      expect(screen.getByTestId('nib-lockup')).toBeInTheDocument();
      expect(screen.queryByTestId('dvd-mark')).not.toBeInTheDocument();
      expect(screen.getByTestId('quiet-mode')).not.toHaveTextContent(/dvd/i);
    });

    it('is what a dashboard saved with the retired DVD-style option shows, calm', () => {
      // "Our logo, DVD-style" existed briefly. A dashboard saved with it must
      // still load, as our logo in the theme colour, not break or cycle.
      const retired = 'logo' as unknown as QuietMark;
      render(<QuietMode width={800} height={600} theme={theme} mark={retired} />);

      expect(screen.getByTestId('nib-lockup')).toBeInTheDocument();
      jest.advanceTimersByTime(60_000);
      expect(colourOf()).toBe(asRgb(theme.mark));
    });

    it('is drawn at the lockup aspect ratio, so it bounces off its own edges', () => {
      render(<QuietMode width={800} height={600} theme={theme} mark="text" />);
      const svg = screen.getByTestId('nib-lockup');

      expect(Number(svg.getAttribute('width')) / Number(svg.getAttribute('height'))).toBeCloseTo(LOCKUP_ASPECT, 3);
    });

    it('takes the theme colour and keeps it', () => {
      render(<QuietMode width={800} height={600} theme={theme} mark="text" />);

      expect(colourOf()).toBe(asRgb(theme.mark));

      jest.advanceTimersByTime(60_000);
      expect(colourOf()).toBe(asRgb(theme.mark));
    });
  });

  describe('the 3D text', () => {
    it('runs instead of either bouncing mark', () => {
      render(<QuietMode width={800} height={600} theme={theme} mark="3d" />);

      expect(screen.getByTestId('three-d-text')).toBeInTheDocument();
      expect(screen.queryByTestId('dvd-mark')).not.toBeInTheDocument();
      expect(screen.queryByTestId('quiet-mark')).not.toBeInTheDocument();
    });

    it('spells out the text it is given', () => {
      render(<QuietMode width={800} height={600} theme={theme} mark="3d" text="platform team" />);

      expect(screen.getByTestId('three-d-face')).toHaveTextContent('platform team');
    });

    it('extrudes our mark beside the text, not the text alone', () => {
      render(<QuietMode width={800} height={600} theme={theme} mark="3d" />);

      expect(screen.getByTestId('three-d-face-mark')).toBeInTheDocument();
      screen.getAllByTestId('three-d-wall').forEach((wall) => {
        expect(wall.querySelector('[data-testid="static-mark"]')).not.toBeNull();
      });
    });

    it('tumbles in a black void whatever the theme, as the screensaver did', () => {
      render(<QuietMode width={800} height={600} theme={{ ...theme, canvas: '#ffffff' }} mark="3d" />);

      expect(screen.getByTestId('quiet-mode')).toHaveStyle({ background: '#000000' });
    });

    it('keeps the theme canvas behind the bouncing marks', () => {
      render(<QuietMode width={800} height={600} theme={{ ...theme, canvas: '#ffffff' }} mark="dvd" />);

      expect(screen.getByTestId('quiet-mode')).toHaveStyle({ background: '#ffffff' });
    });

    it('passes its settings through to the 3D text', () => {
      render(<QuietMode width={800} height={600} theme={theme} mark="3d" threeD={{ depth: 0.7 }} />);
      const z = (id: string) => Number(/translateZ\((-?[\d.]+)px\)/.exec(screen.getByTestId(id).style.transform)?.[1]);
      const fontSize = Number(screen.getByTestId('three-d-rotator').style.fontSize.replace('px', ''));

      expect(z('three-d-front') - z('three-d-back')).toBeCloseTo(0.7 * fontSize, 5);
    });

    it('falls back to the wordmark when no text is set', () => {
      render(<QuietMode width={800} height={600} theme={theme} mark="3d" />);

      expect(screen.getByTestId('three-d-face')).toHaveTextContent('noise is bad.');
    });

    it('keeps the extrusion itself free of anything that would flatten it', () => {
      // Clipping the panel is safe — its own transform-style is already flat,
      // so there is nothing for overflow to flatten, and an end-to-end test
      // measures the real depth in a real browser. Clipping the rotator would
      // not be safe, and that is what this guards.
      render(<QuietMode width={800} height={600} theme={theme} mark="3d" />);
      const rotator = window.getComputedStyle(screen.getByTestId('three-d-rotator'));

      expect(rotator.overflow === '' || rotator.overflow === 'visible').toBe(true);
      expect(rotator.filter === '' || rotator.filter === 'none').toBe(true);
      expect(rotator.opacity === '' || Number(rotator.opacity) === 1).toBe(true);
    });

    it('still clips the panel, so a long line cannot spill over Grafana', () => {
      render(<QuietMode width={800} height={600} theme={theme} mark="3d" />);

      expect(window.getComputedStyle(screen.getByTestId('quiet-mode')).overflow).toBe('hidden');
    });
  });

  describe('the DVD logo', () => {
    it('is what quiet mode shows by default', () => {
      render(<QuietMode width={800} height={600} theme={theme} />);

      expect(screen.getByTestId('dvd-mark')).toBeInTheDocument();
      expect(screen.queryByText('noise is bad.')).not.toBeInTheDocument();
    });

    it('is drawn at the logo aspect ratio', () => {
      render(<QuietMode width={800} height={600} theme={theme} mark="dvd" />);
      const svg = screen.getByTestId('dvd-mark');

      const width = Number(svg.getAttribute('width'));
      const height = Number(svg.getAttribute('height'));

      expect(width / height).toBeCloseTo(187.09 / 82.68, 2);
      // Large enough to read across a room, small enough to have room to move.
      expect(width).toBeGreaterThan(0);
      expect(width).toBeLessThan(800);
    });

    it('is bounded by the shorter edge on a letterbox panel', () => {
      render(<QuietMode width={1920} height={200} theme={theme} mark="dvd" />);

      expect(Number(screen.getByTestId('dvd-mark').getAttribute('height'))).toBeLessThan(200);
    });

    it('starts on the first colour of the palette', () => {
      render(<QuietMode width={800} height={600} theme={theme} mark="dvd" />);

      expect(colourOf()).toBe(asRgb(DVD_PALETTE[0]));
    });

    it('holds its colour while it is between the walls', () => {
      render(<QuietMode width={800} height={600} theme={theme} mark="dvd" />);

      jest.advanceTimersByTime(500);
      const first = colourOf();

      jest.advanceTimersByTime(500);
      expect(colourOf()).toBe(first);
    });

    it('changes colour when it hits a wall', () => {
      render(<QuietMode width={800} height={600} theme={theme} mark="dvd" />);

      jest.advanceTimersByTime(500);
      const first = colourOf();

      // Long enough to cross the stage and come back off an edge.
      jest.advanceTimersByTime(30_000);

      expect(colourOf()).not.toBe(first);
    });

    it('only ever wears a colour from the palette', () => {
      render(<QuietMode width={800} height={600} theme={theme} mark="dvd" />);
      const allowed = DVD_PALETTE.map(asRgb);
      const seen = new Set<string>();

      for (let i = 0; i < 120; i++) {
        jest.advanceTimersByTime(1_000);
        seen.add(colourOf());
      }

      seen.forEach((colour) => expect(allowed).toContain(colour));
      // Two minutes of bouncing is several walls, so it has actually cycled.
      expect(seen.size).toBeGreaterThan(1);
    });
  });
});

describe('the background', () => {
  it('is always painted, so the panel is never see-through', () => {
    render(<QuietMode width={800} height={600} theme={theme} />);

    expect(screen.getByTestId('quiet-mode')).toHaveStyle({ background: '#0b0c0e' });
  });
});
