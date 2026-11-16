/**
 * The clock-free half of the flip clock.
 *
 * What the cards say at a given moment, when the next moment worth waking up
 * for is, which cards a change touches, and how big two cards can be in a box.
 * No timers, no DOM, no React, so all of it is tested on its own and
 * `FlipClock.tsx` stays a thin shell.
 */

/** What the two cards read: hours and minutes, two digits each. */
export interface Face {
  hours: string;
  minutes: string;
}

/** How the cards sit in a panel, in pixels. */
export interface CardFit {
  /** A card's width and height. They are square. */
  card: number;
  /** The space between the two cards. */
  gap: number;
  fontSize: number;
  radius: number;
}

/** How long a leaf takes to fall, and then how long the one beneath takes to settle. */
export const FOLD_MS = 300;
export const UNFOLD_MS = 300;

/** The void the cards sit in, the card itself, and the ink on it. */
export const VOID = '#000000';
export const CARD = '#151515';
export const INK = '#d4d4d4';

/** How much of the panel the cards may span across, and down. */
const ROOM_ACROSS = 0.9;
const ROOM_DOWN = 0.8;
const GAP = 0.1;
const FONT = 0.68;
const RADIUS = 0.08;
const MIN_CARD = 16;

const MINUTE_MS = 60_000;

/** The face at a moment, in that moment's local time, twenty-four hours. */
export function faceOf(date: Date): Face {
  return { hours: pad(date.getHours()), minutes: pad(date.getMinutes()) };
}

/**
 * How long until the minute ticks over, in (0, 60000].
 *
 * Every time zone is offset by whole minutes, so a local minute boundary is a
 * UTC one, and epoch arithmetic is enough. Exactly on the boundary the answer is
 * a whole minute: the caller has already read the face for this one.
 */
export function msUntilNextMinute(ms: number): number {
  return MINUTE_MS - (((ms % MINUTE_MS) + MINUTE_MS) % MINUTE_MS);
}

/** Which cards a change from one face to another has to flip. */
export function changedCards(from: Face, to: Face): { hours: boolean; minutes: boolean } {
  return { hours: from.hours !== to.hours, minutes: from.minutes !== to.minutes };
}

/**
 * The largest pair of square cards, with a gap between, that fits in a box
 * with room around them. On a 16:9 television the width is what binds, and
 * the cards stand about three quarters of the height, as the screensaver does.
 */
export function fitCards(width: number, height: number): CardFit {
  const byHeight = height * ROOM_DOWN;
  const byWidth = (width * ROOM_ACROSS) / (2 + GAP);
  const card = Math.max(MIN_CARD, Math.min(byHeight, byWidth));

  return { card, gap: card * GAP, fontSize: card * FONT, radius: card * RADIUS };
}

const pad = (n: number): string => String(n).padStart(2, '0');
