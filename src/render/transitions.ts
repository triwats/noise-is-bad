import { css, keyframes } from '@emotion/css';

/**
 * How boxes come and go.
 *
 * Each style is a handful of numbers and nothing else, so changing how one
 * feels means changing one value here rather than editing keyframes. They are
 * deliberately far apart: if two styles are hard to tell apart on a television
 * across a room, there is no point offering both.
 *
 * One thing all of them fix: before, a box that went away simply vanished and
 * the others slid into the hole. A disappearance was the most abrupt thing on
 * the board, while an arrival, which is what you actually want somebody to look
 * up for, was the gentlest. That was backwards.
 */
export type TransitionStyle = 'fade' | 'grow' | 'flash' | 'none';

interface StyleSpec {
  /** How long a new box takes to arrive. */
  arriveMs: number;
  /** How long a cleared box takes to go, and how long it is kept around for. */
  leaveMs: number;
  /** How small a box starts and ends, as a fraction of its size. 1 means no scaling. */
  scale: number;
  /** How bright a new box starts. 1 means no flash. */
  brightness: number;
  /** How far through the arrival the brightness starts falling back. */
  flashHold: number;
  arriveEase: string;
  leaveEase: string;
}

const EASE_OUT = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
const EASE_IN = 'cubic-bezier(0.55, 0.06, 0.68, 0.19)';

const SPECS: Record<TransitionStyle, StyleSpec> = {
  // Snappy and physical. A box takes its space and gives it back.
  grow: {
    arriveMs: 420,
    leaveMs: 320,
    scale: 0.08,
    brightness: 1,
    flashHold: 0,
    arriveEase: EASE_OUT,
    leaveEase: EASE_IN,
  },
  // The loudest available. A new problem blows up bright and holds it, which is
  // the hardest pull on the eye that is not a strobe: it happens once per
  // problem, not over and over.
  flash: {
    arriveMs: 750,
    leaveMs: 260,
    scale: 0.35,
    brightness: 3.6,
    flashHold: 0.62,
    arriveEase: EASE_OUT,
    leaveEase: EASE_IN,
  },
  // The quiet extreme. No movement at all, just a long crossfade.
  fade: {
    arriveMs: 950,
    leaveMs: 800,
    scale: 1,
    brightness: 1,
    flashHold: 0,
    arriveEase: 'ease',
    leaveEase: 'ease',
  },
  // Nothing moves. For comparison, and for anyone who would rather a screen on
  // a wall never animated at all.
  none: { arriveMs: 0, leaveMs: 0, scale: 1, brightness: 1, flashHold: 0, arriveEase: '', leaveEase: '' },
};

export interface Transition {
  /** Played when a box appears. */
  arrive: string;
  /** Played when a box goes away, while the others move into its space. */
  leave: string;
  /** How long the leaving animation lasts, so the box can be kept that long. */
  leaveMs: number;
}

function build(spec: StyleSpec): Transition {
  if (spec.arriveMs === 0) {
    return { arrive: '', leave: '', leaveMs: 0 };
  }

  const from = { opacity: 0, transform: `scale(${spec.scale})` };
  const to = { opacity: 1, transform: 'scale(1)' };

  const arrive = spec.brightness > 1
    ? keyframes({
        '0%': { ...from, filter: `brightness(${spec.brightness})` },
        [`${Math.round(spec.flashHold * 100)}%`]: { ...to, filter: `brightness(${spec.brightness})` },
        '100%': { ...to, filter: 'brightness(1)' },
      })
    : keyframes({ from, to });

  const leave = keyframes({
    from: { opacity: 1, transform: 'scale(1)' },
    to: { opacity: 0, transform: `scale(${spec.scale})` },
  });

  return {
    arrive: css({ animation: `${arrive} ${spec.arriveMs}ms ${spec.arriveEase}` }),
    leave: css({ animation: `${leave} ${spec.leaveMs}ms ${spec.leaveEase} forwards` }),
    leaveMs: spec.leaveMs,
  };
}

const TRANSITIONS: Record<TransitionStyle, Transition> = {
  grow: build(SPECS.grow),
  flash: build(SPECS.flash),
  fade: build(SPECS.fade),
  none: build(SPECS.none),
};

export const transitionFor = (style: TransitionStyle = 'grow'): Transition =>
  TRANSITIONS[style] ?? TRANSITIONS.grow;

/** Exported so the panel options and the tests agree on what exists. */
export const TRANSITION_STYLES = Object.keys(SPECS) as TransitionStyle[];

/** Exported for tests: the numbers that define each style. */
export const transitionSpec = (style: TransitionStyle): StyleSpec => SPECS[style];
