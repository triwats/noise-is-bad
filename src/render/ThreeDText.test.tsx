import React from 'react';

import { cleanup, render, screen } from '@testing-library/react';

import { lockupSize, stackLines } from './brand';
import { ThreeDText, parseColour } from './ThreeDText';

/**
 * The properties that silently force `transform-style: flat`.
 *
 * None of them may appear on the extrusion or anything between it and the
 * perspective. There is no safe threshold — `opacity: 0.999` flattens as hard
 * as `0.2` — and when it happens the computed transform still looks correct
 * while the text renders as a flat sign.
 */
const FLATTENING = ['overflow', 'opacity', 'filter', 'clipPath', 'maskImage', 'mixBlendMode', 'contain'] as const;

const flatteningOn = (element: HTMLElement): string[] =>
  FLATTENING.filter((property) => {
    const value = element.style[property as keyof CSSStyleDeclaration];
    if (!value || typeof value !== 'string') {
      return false;
    }
    if (property === 'overflow') {
      return value !== 'visible' && value !== 'clip';
    }
    if (property === 'opacity') {
      return Number(value) < 1;
    }
    return value !== 'none' && value !== 'normal';
  });

/** The same check against the stylesheet, which is where the emotion rules land. */
const computedFlatteningOn = (element: HTMLElement): string[] => {
  const computed = window.getComputedStyle(element);
  const offenders: string[] = [];

  const overflow = computed.overflow;
  if (overflow && overflow !== 'visible' && overflow !== 'clip' && overflow !== '') {
    offenders.push('overflow');
  }
  if (computed.opacity !== '' && Number(computed.opacity) < 1) {
    offenders.push('opacity');
  }
  if (computed.filter && computed.filter !== 'none') {
    offenders.push('filter');
  }
  return offenders;
};

describe('ThreeDText', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const draw = (props: Partial<React.ComponentProps<typeof ThreeDText>> = {}) =>
    render(<ThreeDText text="noise is bad." width={800} height={600} {...props} />);

  it('spells out the text it is given', () => {
    draw({ text: 'platform team' });

    expect(screen.getByTestId('three-d-face')).toHaveTextContent('platform team');
  });

  it('extrudes with a stack of layers, not a single flat copy', () => {
    draw();

    expect(screen.getAllByTestId('three-d-wall').length).toBeGreaterThan(8);
  });

  it('caps the stack, because every layer is a texture on the GPU', () => {
    draw({ text: 'a very long line of text indeed', width: 3840, height: 2160 });

    expect(screen.getAllByTestId('three-d-wall').length).toBeLessThanOrEqual(48);
  });

  it('pushes each layer to its own depth', () => {
    draw();
    const depths = screen.getAllByTestId('three-d-wall').map((wall) => wall.style.transform);

    expect(new Set(depths).size).toBe(depths.length);
    depths.forEach((transform) => expect(transform).toMatch(/translateZ\(-?[\d.]+px\)/));
  });

  it('keeps everything inside the 3D context free of anything that would flatten it', () => {
    draw();

    // Walking up rather than checking one element: a flattening property
    // anywhere from the extrusion up to the perspective does the damage, and
    // it is the kind of regression that is invisible in a diff and miserable
    // to debug in a browser. The stage is excluded on purpose — see below.
    let element: HTMLElement | null = screen.getByTestId('three-d-face');
    const stage = screen.getByTestId('three-d-text');
    const checked: string[] = [];

    while (element && element !== stage) {
      expect(flatteningOn(element)).toEqual([]);
      expect(computedFlatteningOn(element)).toEqual([]);
      checked.push(element.dataset.testid ?? 'unnamed');
      element = element.parentElement;
    }

    expect(checked).toContain('three-d-face');
    expect(checked).toContain('three-d-rotator');
  });

  it('does clip the stage, which is safe and keeps long text off Grafana', () => {
    draw();

    // The stage carries the perspective, but its own transform-style is
    // already flat, so overflow has nothing to flatten. Verified for real by
    // the end-to-end test that measures near and far layers in a browser.
    expect(computedFlatteningOn(screen.getByTestId('three-d-text'))).toEqual(['overflow']);
  });

  describe('the camera', () => {
    // The lockup can face any direction, so everything is measured against its
    // bounding sphere: half the diagonal of its box, width by height by depth.
    const measure = (width: number, height: number, depth = 0.35) => {
      draw({ width, height, depth });
      const perspective = Number(screen.getByTestId('three-d-text').style.perspective.replace('px', ''));
      const fontSize = Number(screen.getByTestId('three-d-rotator').style.fontSize.replace('px', ''));
      const lockup = lockupSize(stackLines('noise is bad.'));
      const radius = (Math.hypot(lockup.width, lockup.height, depth) / 2) * fontSize;
      return { perspective, radius };
    };

    it('sits beyond the reach of every point of the lockup, at any angle', () => {
      const { perspective, radius } = measure(1600, 900);

      expect(perspective).toBeGreaterThan(radius);
    });

    it('keeps perspective noticeable but not wide-angle: nothing grows past 1.5 times', () => {
      const { perspective, radius } = measure(1600, 900);

      // A point swinging straight at the viewer grows by d / (d - R).
      expect(perspective / (perspective - radius)).toBeLessThanOrEqual(1.5 + 1e-9);
      expect(perspective / (perspective - radius)).toBeGreaterThan(1.2);
    });

    it.each([
      [1920, 1080],
      [1080, 1920],
      [700, 700],
    ])('keeps the whole lockup on a %ix%i panel at every angle', (width, height) => {
      const { perspective, radius } = measure(width, height);
      // A sphere of radius R seen from distance d projects to R·d/√(d²−R²).
      const projected = (radius * perspective) / Math.sqrt(perspective ** 2 - radius ** 2);

      expect(2 * projected).toBeLessThanOrEqual(Math.min(width, height));
    });
  });

  it('takes the central third to half of a television, as the spec asks', () => {
    draw({ width: 1920, height: 1080 });
    const fontSize = Number(screen.getByTestId('three-d-rotator').style.fontSize.replace('px', ''));
    const across = lockupSize(stackLines('noise is bad.')).width * fontSize;

    expect(across / 1920).toBeGreaterThan(0.3);
    expect(across / 1920).toBeLessThan(0.55);
  });

  it('shrinks with the size setting', () => {
    draw({ size: 1 });
    const full = Number(screen.getByTestId('three-d-rotator').style.fontSize.replace('px', ''));
    cleanup();
    draw({ size: 0.5 });
    const half = Number(screen.getByTestId('three-d-rotator').style.fontSize.replace('px', ''));

    expect(half).toBeCloseTo(full / 2, 5);
  });

  it('extrudes as deep as the depth setting says', () => {
    draw({ depth: 0.6 });
    const fontSize = Number(screen.getByTestId('three-d-rotator').style.fontSize.replace('px', ''));
    const z = (id: string) => Number(/translateZ\((-?[\d.]+)px\)/.exec(screen.getByTestId(id).style.transform)?.[1]);

    expect(z('three-d-front') - z('three-d-back')).toBeCloseTo(0.6 * fontSize, 5);
  });

  it('preserves 3D on the rotator and puts will-change only there', () => {
    draw();
    const rotator = screen.getByTestId('three-d-rotator');

    expect(flatteningOn(rotator)).toEqual([]);
    screen.getAllByTestId('three-d-wall').forEach((wall) => {
      expect(wall.style.willChange).toBe('');
      expect(flatteningOn(wall)).toEqual([]);
    });
  });

  it('keeps the front face childless, or the text clip does not paint', () => {
    draw();

    expect(screen.getByTestId('three-d-face').children).toHaveLength(0);
  });

  it('turns once frames start arriving', () => {
    draw();
    const rotator = screen.getByTestId('three-d-rotator');

    jest.advanceTimersByTime(500);
    const first = rotator.style.transform;
    expect(first).toMatch(/rotate/);

    jest.advanceTimersByTime(1_000);
    expect(rotator.style.transform).not.toBe(first);
  });

  it('has a back cap at the rear, so it shows a face when turned round', () => {
    draw();
    const z = (el: HTMLElement) => Number(/translateZ\((-?[\d.]+)px\)/.exec(el.style.transform)?.[1]);
    const back = z(screen.getByTestId('three-d-back'));
    const front = z(screen.getByTestId('three-d-front'));

    expect(back).toBeCloseTo(-front, 5);
    // Every wall strictly between the caps, so none flickers in a cap's plane.
    screen.getAllByTestId('three-d-wall').forEach((wall) => {
      expect(z(wall)).toBeGreaterThan(back);
      expect(z(wall)).toBeLessThan(front);
    });
  });

  it('tumbles on all three axes', () => {
    draw();
    const rotator = screen.getByTestId('three-d-rotator');
    const angles = () =>
      ['X', 'Y', 'Z'].map((axis) =>
        Number(new RegExp(`rotate${axis}\\((-?[\\d.]+)deg\\)`).exec(rotator.style.transform)?.[1])
      );

    jest.advanceTimersByTime(500);
    const first = angles();
    jest.advanceTimersByTime(3_000);
    const later = angles();

    first.forEach((angle, axis) => expect(later[axis]).not.toBeCloseTo(angle, 1));
  });

  it('turns faster at a higher speed setting', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.75);
    draw({ speed: 1 });
    jest.advanceTimersByTime(1_000);
    const slow = screen.getByTestId('three-d-rotator').style.transform;
    cleanup();

    draw({ speed: 3 });
    jest.advanceTimersByTime(1_000);
    const fast = screen.getByTestId('three-d-rotator').style.transform;
    jest.restoreAllMocks();

    const y = (t: string) => Number(/rotateY\((-?[\d.]+)deg\)/.exec(t)?.[1]);
    const start = 0.75 * 360;
    expect(Math.abs(y(fast) - start)).toBeGreaterThan(Math.abs(y(slow) - start) * 2.5);
  });

  it('lights the lockup as it turns', () => {
    draw();
    // The rotator carries the light; every layer reads it from there.
    const rotator = screen.getByTestId('three-d-rotator');
    const light = () =>
      ['--nib-front', '--nib-back', '--nib-side'].map((name) => rotator.style.getPropertyValue(name)).join(' ');

    jest.advanceTimersByTime(500);
    const first = light();
    expect(first).toMatch(/^rgb\(.*\) rgb\(.*\) rgb\(.*\)$/);

    jest.advanceTimersByTime(10_000);
    expect(light()).not.toBe(first);
  });

  it('repaints the walls only when their shade actually changes, not every frame', () => {
    draw();
    const rotator = screen.getByTestId('three-d-rotator');
    const set = jest.spyOn(rotator.style, 'setProperty');

    // Thirty seconds of frames.
    jest.advanceTimersByTime(30_000);
    const frames = set.mock.calls.length > 0 ? 30_000 / 16 : 0;
    const sideWrites = set.mock.calls.filter(([name]) => name === '--nib-side').length;

    expect(frames).toBeGreaterThan(0);
    expect(sideWrites).toBeLessThan(frames / 10);
    set.mockRestore();
  });

  it('paints in the colour it is given', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    draw({ colour: '#ff0000' });
    jest.advanceTimersByTime(100);
    jest.restoreAllMocks();

    const front = screen.getByTestId('three-d-rotator').style.getPropertyValue('--nib-front');
    expect(front).toMatch(/^rgb\(\d+, 0, 0\)$/);
  });

  it('stacks the text onto two lines, the way the lockup stacks "noise / is bad."', () => {
    draw({ text: 'noise is bad.' });

    expect(screen.getByTestId('three-d-face').textContent).toBe('noise\nis bad.');
  });

  it('puts our mark in every layer, so the static extrudes with the words', () => {
    draw();

    screen.getAllByTestId('three-d-wall').forEach((wall) => {
      expect(wall.querySelector('[data-testid="static-mark"]')).not.toBeNull();
    });
  });

  it('paints the mark on the front with the lit surface, cut to the static', () => {
    draw();
    const mark = window.getComputedStyle(screen.getByTestId('three-d-face-mark'));

    expect(mark.maskImage || mark.getPropertyValue('mask-image')).toMatch(/data:image\/svg\+xml/);
  });

  it('sets the text in our embedded typeface', () => {
    draw();

    expect(window.getComputedStyle(screen.getByTestId('three-d-rotator')).fontFamily).toMatch(
      /^"Noise Is Bad Archivo Black"/
    );
  });

  it('keeps turning indefinitely', () => {
    draw();
    const rotator = screen.getByTestId('three-d-rotator');

    jest.advanceTimersByTime(60_000);
    const midway = rotator.style.transform;

    jest.advanceTimersByTime(60_000);
    expect(rotator.style.transform).not.toBe(midway);
  });

  it('cancels its frame on unmount and leaves nothing running', () => {
    const cancel = jest.spyOn(window, 'cancelAnimationFrame');
    const { unmount } = draw();

    jest.advanceTimersByTime(100);
    unmount();

    expect(cancel).toHaveBeenCalled();
    cancel.mockRestore();
  });

  it('renders at a degenerate size without throwing', () => {
    expect(() => draw({ width: 0, height: 0 })).not.toThrow();
  });

  it('renders empty text without throwing', () => {
    expect(() => draw({ text: '' })).not.toThrow();
  });

  describe('parseColour', () => {
    it('reads the shapes a colour picker hands over', () => {
      expect(parseColour('#c0c4cc')).toEqual([192, 196, 204]);
      expect(parseColour('#f00')).toEqual([255, 0, 0]);
      expect(parseColour('rgb(12, 34, 56)')).toEqual([12, 34, 56]);
      expect(parseColour('rgba(12,34,56,0.5)')).toEqual([12, 34, 56]);
    });

    it('falls back to silver rather than painting nothing', () => {
      expect(parseColour('not a colour')).toEqual([192, 196, 204]);
    });
  });
});
