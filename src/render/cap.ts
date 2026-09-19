import { NoiseItem } from '../noise/types';

/**
 * Keeping the board readable when a lot is broken.
 *
 * A treemap of three hundred boxes is not a picture of anything. Past a certain
 * number the names drop out, then the colours stop reading as separate things,
 * and the screen stops answering the only question it exists for.
 *
 * So the number of boxes on screen has a ceiling. What is left over is never
 * dropped silently: it is gathered into one last box that says how many more
 * there are. A board that quietly hides two hundred problems because they did
 * not fit would be lying to the room.
 */

/** Boxes on screen, by default. Enough to show a bad day, few enough to read. */
export const DEFAULT_MAX_BOXES = 20;

/** Never fewer than this, so there is always room for one problem and the rest. */
const MIN_BOXES = 2;

export interface Capped {
  /** The problems that get a box of their own, worst first. */
  shown: NoiseItem[];
  /** Everything else, worst first. Empty when nothing was cut. */
  hidden: NoiseItem[];
}

/** Worst first: highest score, then by name, so the same problems always cut the same way. */
const worstFirst = (a: NoiseItem, b: NoiseItem) => b.pressure - a.pressure || a.name.localeCompare(b.name);

/**
 * Splits problems into the ones that get a box and the ones that do not.
 *
 * `maxBoxes` counts every box on screen, including the one standing in for the
 * rest. That is what makes it a real guarantee about readability: set it to
 * twenty and there are never more than twenty boxes, not twenty plus one.
 */
export function capProblems(items: NoiseItem[], maxBoxes: number = DEFAULT_MAX_BOXES): Capped {
  if (!Number.isFinite(maxBoxes)) {
    return { shown: items, hidden: [] };
  }

  const limit = Math.max(MIN_BOXES, Math.floor(maxBoxes));
  if (items.length <= limit) {
    return { shown: items, hidden: [] };
  }

  const sorted = [...items].sort(worstFirst);
  // One box is kept back for "and this many more".
  return { shown: sorted.slice(0, limit - 1), hidden: sorted.slice(limit - 1) };
}
