/**
 * The maths behind the Boing ball screensaver: the 1984 Amiga demo, a red and
 * white checkered ball spinning on a tilted axis and bouncing across a grey
 * room with a purple grid behind it.
 *
 * Pure: no clock, no DOM, no React. Everything is a closed-form function of
 * elapsed time, so a long frame gap or a television waking from sleep lands
 * the ball exactly where it should be, with nothing accumulated to drift.
 *
 * This is built to run on an older Raspberry Pi, which shapes the split with
 * `BoingBall.tsx`. The checker pattern repeats every two segments of spin, so
 * the ball needs only `SPIN_FRAMES` distinct pictures, ever. The shell draws
 * them once into a sprite sheet and from then on only moves things: no pixel
 * is redrawn while it runs.
 */

/** Grey room and purple grid, as the demo drew them. */
export const BOING_ROOM = '#aaaaaa';
export const BOING_GRID = '#aa00aa';
export const BOING_RED = '#ff0000';
export const BOING_WHITE = '#ffffff';
export const BOING_SHADOW = 'rgba(0, 0, 0, 0.33)';

/** The back wall, in grid cells. */
export const WALL_COLUMNS = 16;
export const WALL_ROWS = 12;
/** How far the floor comes forward, in cells. */
const FLOOR_DEPTH = 1.5;
/** How much wider the floor's front edge is than its back, for perspective. */
export const FLOOR_SPREAD = 1.25;
/** Lines across the floor, the front edge included. */
export const FLOOR_LINES = 4;

/** The ball, in cells. */
const RADIUS_CELLS = 2.6;

/** Segments of longitude and bands of latitude, as the demo had them. */
export const SEGMENTS = 16;
export const BANDS = 8;
/** How far the ball's axis leans from upright. */
export const TILT = (17 * Math.PI) / 180;

/** The pattern looks the same after two segments of spin. */
export const SPIN_PERIOD = (2 * Math.PI * 2) / SEGMENTS;
/** Distinct spin pictures across one period: 2.8° apart, smooth at this speed. */
export const SPIN_FRAMES = 16;
/** The sprite sheet is a square of frames, four by four. */
export const SHEET_COLUMNS = 4;
/**
 * The largest a sprite frame may be, in device pixels. Four of them span 2048,
 * the largest texture an older Raspberry Pi's GPU takes in one piece. Past
 * that the ball is drawn softer and scaled up, which across an office nobody
 * can see.
 */
export const MAX_FRAME_PX = 512;

/** One trip from wall to wall. */
const CROSSING_MS = 4600;
/** One bounce, floor to floor. */
const BOUNCE_MS = 1400;
/** Spin over one crossing. Spin follows position, so it reverses at the walls. */
const SPIN_PER_CROSSING = 2 * Math.PI * 1.8;
/** Where in its crossing the ball starts, so it does not begin against a wall. */
const START_PHASE = 0.3;

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Room {
  /** One grid cell, in pixels. Everything else is a multiple of it. */
  cell: number;
  wall: Rect;
  /** From the wall's bottom edge to the floor's front edge. */
  floorDepth: number;
  radius: number;
  /** Where the ball's centre may go. */
  xMin: number;
  xMax: number;
  yTop: number;
  yFloor: number;
}

/**
 * The room laid out for a stage: the largest grid that fits with a margin,
 * centred, and the ball and its range sized from that grid.
 */
export function roomOf(width: number, height: number): Room {
  const cell = Math.max(0, Math.min((width * 0.94) / WALL_COLUMNS, (height * 0.94) / (WALL_ROWS + FLOOR_DEPTH)));
  const wall = {
    left: (width - WALL_COLUMNS * cell) / 2,
    top: (height - (WALL_ROWS + FLOOR_DEPTH) * cell) / 2,
    width: WALL_COLUMNS * cell,
    height: WALL_ROWS * cell,
  };
  const floorDepth = FLOOR_DEPTH * cell;
  const radius = RADIUS_CELLS * cell;
  const bottom = wall.top + wall.height;

  return {
    cell,
    wall,
    floorDepth,
    radius,
    xMin: wall.left + radius,
    xMax: wall.left + wall.width - radius,
    // The ball lands partway onto the floor, standing in front of the wall,
    // and peaks just under the top of it.
    yFloor: bottom + floorDepth * 0.6 - radius,
    yTop: wall.top + radius + cell * 0.4,
  };
}

export type Line = [number, number, number, number];

/**
 * The grid as line segments: the back wall's squares, then the floor running
 * forward from its bottom edge, the columns fanning out for perspective and
 * the cross lines spreading further apart toward the viewer.
 */
export function gridOf(room: Room): Line[] {
  const { wall, cell, floorDepth } = room;
  const right = wall.left + wall.width;
  const bottom = wall.top + wall.height;
  const centre = wall.left + wall.width / 2;
  const spread = (x: number, f: number) => centre + (x - centre) * (1 + (FLOOR_SPREAD - 1) * f);
  const lines: Line[] = [];

  for (let column = 0; column <= WALL_COLUMNS; column++) {
    const x = wall.left + column * cell;
    lines.push([x, wall.top, x, bottom]);
    lines.push([x, bottom, spread(x, 1), bottom + floorDepth]);
  }
  for (let row = 0; row <= WALL_ROWS; row++) {
    const y = wall.top + row * cell;
    lines.push([wall.left, y, right, y]);
  }
  for (let line = 1; line <= FLOOR_LINES; line++) {
    const f = Math.pow(line / FLOOR_LINES, 1.4);
    const y = bottom + floorDepth * f;
    lines.push([spread(wall.left, f), y, spread(right, f), y]);
  }

  return lines;
}

export interface Ball {
  /** Centre, in pixels from the stage's top left. */
  x: number;
  y: number;
  /** Spin about the ball's own axis, in radians, continuous. */
  spin: number;
  /** 1 travelling right, -1 travelling left. */
  heading: 1 | -1;
}

/**
 * Where the ball is after `elapsedMs`.
 *
 * Across: constant speed, folded off the side walls. Up and down: a gravity
 * parabola, perfectly elastic, so the height never decays. Spin is tied to how
 * far across the ball is, which makes it reverse at each wall for free and
 * never jump: the ball always turns the way it travels.
 */
export function ballAt(elapsedMs: number, room: Room): Ball {
  const crossing = mod(Math.max(0, elapsedMs) / CROSSING_MS + START_PHASE, 2);
  const across = crossing < 1 ? crossing : 2 - crossing;

  const bounce = mod(Math.max(0, elapsedMs) / BOUNCE_MS + 0.5, 1);
  const lift = 4 * bounce * (1 - bounce);

  return {
    x: room.xMin + across * (room.xMax - room.xMin),
    y: room.yFloor - lift * (room.yFloor - room.yTop),
    spin: across * SPIN_PER_CROSSING,
    heading: crossing < 1 ? 1 : -1,
  };
}

/** Which of the `SPIN_FRAMES` pictures shows the ball at this spin. */
export function frameOf(spin: number): number {
  return Math.floor((mod(spin, SPIN_PERIOD) / SPIN_PERIOD) * SPIN_FRAMES) % SPIN_FRAMES;
}

/** The spin a sprite frame is drawn at. */
export function spinOfFrame(frame: number): number {
  return (frame / SPIN_FRAMES) * SPIN_PERIOD;
}

export interface Facet {
  /** Outline on a unit disc centred on 0, 0, y pointing down as on screen. */
  points: Array<[number, number]>;
  red: boolean;
  /** Towards the viewer is positive. Facets come sorted back to front. */
  depth: number;
}

/** Points along each facet edge, so the outline follows the sphere's curve. */
const EDGE_STEPS = 3;

/**
 * The ball's visible checkered facets at a given spin, projected and ordered
 * for painting back to front. Together they tile the disc exactly: a facet
 * across the rim is cut to its visible part, one wholly behind is left out.
 */
export function facetsAt(spin: number): Facet[] {
  const facets: Facet[] = [];

  for (let band = 0; band < BANDS; band++) {
    const lat0 = -Math.PI / 2 + (band / BANDS) * Math.PI;
    const lat1 = -Math.PI / 2 + ((band + 1) / BANDS) * Math.PI;

    for (let segment = 0; segment < SEGMENTS; segment++) {
      const lon0 = (segment / SEGMENTS) * 2 * Math.PI + spin;
      const lon1 = ((segment + 1) / SEGMENTS) * 2 * Math.PI + spin;

      const outline: Array<[number, number, number]> = [];
      for (let i = 0; i < EDGE_STEPS; i++) {
        outline.push(onSphere(lat0, lerp(lon0, lon1, i / EDGE_STEPS)));
      }
      for (let i = 0; i < EDGE_STEPS; i++) {
        outline.push(onSphere(lerp(lat0, lat1, i / EDGE_STEPS), lon1));
      }
      for (let i = 0; i < EDGE_STEPS; i++) {
        outline.push(onSphere(lat1, lerp(lon1, lon0, i / EDGE_STEPS)));
      }
      for (let i = 0; i < EDGE_STEPS; i++) {
        outline.push(onSphere(lerp(lat1, lat0, i / EDGE_STEPS), lon0));
      }

      // Wholly round the back: nothing of it can be seen.
      if (outline.every(([, , z]) => z < 0)) {
        continue;
      }

      facets.push({
        // A point round the back is pushed out to the rim. A facet straddling
        // the rim then outlines only its visible part, and cannot spill over
        // a neighbour that was painted before it.
        points: outline.map(([x, y, z]) => (z < 0 ? toRim(x, y) : [x, y])),
        red: (band + segment) % 2 === 0,
        depth: onSphere((lat0 + lat1) / 2, (lon0 + lon1) / 2)[2],
      });
    }
  }

  return facets.sort((a, b) => a.depth - b.depth);
}

/**
 * A point on the unit ball: spun about its own axis, then the axis leaned
 * by `TILT` in the plane of the screen. Screen y points down; z toward the viewer.
 */
function onSphere(lat: number, lon: number): [number, number, number] {
  const x = Math.cos(lat) * Math.cos(lon);
  const y = -Math.sin(lat);
  const z = Math.cos(lat) * Math.sin(lon);
  const c = Math.cos(TILT);
  const s = Math.sin(TILT);

  return [x * c - y * s, x * s + y * c, z];
}

function toRim(x: number, y: number): [number, number] {
  const length = Math.hypot(x, y) || 1;
  return [x / length, y / length];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mod(value: number, by: number): number {
  return ((value % by) + by) % by;
}
