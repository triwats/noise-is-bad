import { TRANSITION_STYLES, TransitionStyle, transitionFor, transitionSpec } from './transitions';

const MOVING: TransitionStyle[] = ['grow', 'flash', 'fade'];

describe('the set of styles', () => {
  it('offers exactly the four the panel lists', () => {
    expect(TRANSITION_STYLES).toEqual(['grow', 'flash', 'fade', 'none']);
  });

  it('falls back to grow for anything it does not recognise', () => {
    expect(transitionFor('nonsense' as TransitionStyle)).toBe(transitionFor('grow'));
    expect(transitionFor(undefined)).toBe(transitionFor('grow'));
  });
});

describe('the styles are far enough apart to be worth offering', () => {
  it('gives each one its own arrival time', () => {
    const times = MOVING.map((style) => transitionSpec(style).arriveMs);

    expect(new Set(times).size).toBe(times.length);
  });

  it('separates the fastest from the slowest by at least half a second', () => {
    const times = MOVING.map((style) => transitionSpec(style).arriveMs);

    expect(Math.max(...times) - Math.min(...times)).toBeGreaterThanOrEqual(500);
  });

  it('only flashes on the style called flash', () => {
    expect(transitionSpec('flash').brightness).toBeGreaterThan(3);

    for (const style of ['grow', 'fade', 'none'] as TransitionStyle[]) {
      expect(transitionSpec(style).brightness).toBe(1);
    }
  });

  it('only moves on the styles that are meant to', () => {
    // Fade is the quiet extreme: a crossfade and nothing else.
    expect(transitionSpec('fade').scale).toBe(1);
    expect(transitionSpec('grow').scale).toBeLessThan(0.2);
    expect(transitionSpec('flash').scale).toBeLessThan(0.5);
  });

  it('makes the gentle style linger and the snappy one not', () => {
    expect(transitionSpec('fade').leaveMs).toBeGreaterThan(transitionSpec('grow').leaveMs * 2);
  });
});

describe('what each style hands the renderer', () => {
  it.each(MOVING)('%s has an arrival and a departure', (style) => {
    const motion = transitionFor(style);

    expect(motion.arrive).not.toBe('');
    expect(motion.leave).not.toBe('');
    expect(motion.leaveMs).toBeGreaterThan(0);
  });

  it('none hands over nothing at all', () => {
    const motion = transitionFor('none');

    expect(motion).toEqual({ arrive: '', leave: '', leaveMs: 0 });
  });

  it('gives every style its own classes', () => {
    const classes = MOVING.map((style) => transitionFor(style).arrive);

    expect(new Set(classes).size).toBe(classes.length);
  });

  it('keeps the box alive exactly as long as its departure lasts', () => {
    for (const style of MOVING) {
      expect(transitionFor(style).leaveMs).toBe(transitionSpec(style).leaveMs);
    }
  });
});
