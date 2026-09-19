import { QuietMark } from './render/QuietMode';
import { Material } from './render/spin';
import { DEFAULT_THREE_D } from './render/ThreeDText';

import { Direction, Reducer } from './adapter/signalAdapter';
import { TransitionStyle } from './render/transitions';

/**
 * Panel options.
 *
 * Everything Epic 9 of the plan asks for: which columns to read, where the
 * warning and critical levels sit, and how the panel behaves.
 */
export interface NoiseOptions {
  /** Which column holds the service names. Empty means pick the first text column. */
  nameField: string;
  /** Which column holds the numbers. Empty means pick the first number column. */
  valueField: string;
  /** How to turn a series of readings into one number. */
  reducer: Reducer;
  /** Whether a bigger number means a worse problem. */
  direction: Direction;
  /** A value at or above this is a warning. */
  warning: number;
  /** A value at or above this is critical. */
  critical: number;
  /** Give a long-running problem more of the screen than a new one. */
  usePersistence: boolean;
  /** Show the bouncing mark when nothing is wrong. */
  quietMode: boolean;
  /** Which screensaver quiet mode runs. */
  quietMark: QuietMark;
  /** What the 3D text spells out. */
  spinText: string;
  /** How big the 3D text is, as a percentage of the largest that always stays on screen. */
  spinSize: number;
  /** How far the 3D letters are extruded, in ems. */
  spinDepth: number;
  /** A multiple of the 3D text's natural turning speed. */
  spinSpeed: number;
  /** What the 3D text is made of. */
  spinMaterial: Material;
  /** The 3D text's colour, as Grafana's colour picker names it. */
  spinColour: string;
  /** How long the boxes take to move and resize, in milliseconds. */
  transitionMs: number;
  /** How boxes come and go. */
  transitionStyle: TransitionStyle;
  /** The most boxes on screen, counting the one that stands in for the rest. */
  maxBoxes: number;
  /** A built-in example to run instead of the query, or `live` for real data. */
  demoScenario: string;
}

/** The plan asks for 300 to 800ms: long enough to perceive, short enough not to drag. */
export const DEFAULT_TRANSITION_MS = 500;

/**
 * The DVD logo, because an office television that nobody is watching may as
 * well be the screensaver everyone already waits on for a corner hit.
 */
export const DEFAULT_QUIET_MARK: QuietMark = 'dvd';

/**
 * Boxes grow into their space and shrink out of it by default.
 *
 * Chosen over a fade because it is the treemap's own idiom: you watch the space
 * being taken, and given back.
 */
export const DEFAULT_TRANSITION_STYLE: TransitionStyle = 'grow';

/** The 3D text's settings, in the units the panel editor shows. */
export const DEFAULT_SPIN = {
  size: DEFAULT_THREE_D.size * 100,
  depth: DEFAULT_THREE_D.depth,
  speed: DEFAULT_THREE_D.speed,
  material: DEFAULT_THREE_D.material,
  colour: DEFAULT_THREE_D.colour,
};

export const LIVE = 'live';
