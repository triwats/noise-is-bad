/**
 * Picks the biggest text size that still fits one line inside a box.
 *
 * This is an estimate, not a measurement. Actually measuring text means the
 * browser has to lay it out again on every frame, and being close is enough.
 *
 * Because it is only maths, the awkward cases, like empty text or a box with no
 * width, can be tested without drawing anything.
 */

/**
 * How wide an average letter is, as a fraction of the text size.
 *
 * Measured against the bold capital letters this actually draws, not ordinary
 * mixed-case text. A six-letter name measured 0.66 in a browser; 0.68 leaves
 * room to spare. Guessing high only makes text slightly smaller than it could
 * be, which is much better than a name spilling out of its box.
 */
const GLYPH_WIDTH = 0.68;

export interface FitOptions {
  /** The tallest the text may be, as a fraction of the box height. */
  heightFraction?: number;
  /** How much of the box width the text may use. */
  widthFraction?: number;
  /** Never go below this, even if it spills. Too small to read is worse than cut off. */
  minimum?: number;
}

export function fitFontSize(text: string, width: number, height: number, options: FitOptions = {}): number {
  const { heightFraction = 0.4, widthFraction = 0.9, minimum = 12 } = options;

  const byHeight = height * heightFraction;
  const characters = Math.max(1, text.length);
  const byWidth = (width * widthFraction) / (characters * GLYPH_WIDTH);

  return Math.max(minimum, Math.min(byHeight, byWidth));
}
