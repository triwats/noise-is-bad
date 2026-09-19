/**
 * The physics behind quiet mode (NIB-005).
 *
 * Pure: no clock, no DOM, no React. The component supplies elapsed time and
 * bounds, which makes every edge case testable without rendering anything or
 * waiting for a frame.
 */

export interface BounceState {
  /** Top-left of the mark, in pixels, relative to the stage. */
  x: number;
  y: number;
  /** Pixels per second. */
  vx: number;
  vy: number;
  /**
   * Walls hit since the animation started, counted on both axes.
   *
   * The renderer changes the DVD logo's colour on every bounce, and it cannot
   * work this out for itself: reflection is wrapped rather than clamped, so one
   * long frame can contain several bounces that watching the velocity flip
   * would miss. Counting it here keeps that in the pure, tested layer. It only
   * ever rises, which at roughly a bounce a second stays exact for longer than
   * any television will be switched on.
   */
  bounces: number;
}

export interface Bounds {
  width: number;
  height: number;
  markWidth: number;
  markHeight: number;
}

/** Distance travelled per second, as a fraction of the stage's short edge. */
const SPEED = 0.13;

/** The room the mark has to move in, which is never negative. */
export function roomToMove(bounds: Bounds): { x: number; y: number } {
  return {
    x: Math.max(0, bounds.width - bounds.markWidth),
    y: Math.max(0, bounds.height - bounds.markHeight),
  };
}

/**
 * A starting position and heading.
 *
 * The two axes travel at different speeds, so the mark does not simply retrace
 * one diagonal forever. `seed` places it somewhere off-centre.
 */
export function startState(bounds: Bounds, seed = 0.35): BounceState {
  const travel = Math.max(24, Math.min(bounds.width, bounds.height) * SPEED);
  const room = roomToMove(bounds);

  return {
    x: room.x * seed,
    y: room.y * (1 - seed),
    vx: travel,
    vy: travel * 0.78,
    bounces: 0,
  };
}

/**
 * Advances the mark by `dtMs` and reflects it off the walls.
 *
 * Reflection is wrapped rather than clamped, so a long gap between frames — a
 * backgrounded tab, a television waking up — leaves the mark where it would
 * actually be, having bounced however many times, instead of pinned to an edge.
 */
export function step(state: BounceState, bounds: Bounds, dtMs: number): BounceState {
  const dt = Math.max(0, dtMs) / 1000;
  const room = roomToMove(bounds);

  const horizontal = reflect(state.x + state.vx * dt, state.vx, room.x);
  const vertical = reflect(state.y + state.vy * dt, state.vy, room.y);

  return {
    x: horizontal.position,
    y: vertical.position,
    vx: horizontal.velocity,
    vy: vertical.velocity,
    bounces: state.bounces + horizontal.crossings + vertical.crossings,
  };
}

interface Reflection {
  position: number;
  velocity: number;
  /** Walls passed on the way, which is 0 while the mark stays between them. */
  crossings: number;
}

/**
 * Folds a position onto `[0, limit]` as a triangle wave, flipping the velocity
 * once per wall crossed. With no room at all, the mark sits still.
 */
function reflect(position: number, velocity: number, limit: number): Reflection {
  if (limit <= 0) {
    return { position: 0, velocity, crossings: 0 };
  }

  const span = limit * 2;
  let wrapped = position % span;
  if (wrapped < 0) {
    wrapped += span;
  }

  const goingForward = wrapped < limit;

  return {
    position: goingForward ? wrapped : span - wrapped,
    velocity: goingForward ? velocity : -velocity,
    // One per wall the unfolded position went past, in either direction. A
    // single very long frame can legitimately report dozens.
    crossings: Math.abs(Math.floor(position / limit)),
  };
}
