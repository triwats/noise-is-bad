/**
 * The motion and lighting behind the 3D text mark.
 *
 * Pure, like `bounce.ts`: no clock, no DOM, no React. The component supplies
 * elapsed time and gets back angles and shading, so every case is testable
 * without rendering anything or waiting for a frame.
 *
 * The model is the Windows XP *3D Text* screensaver's, as the spec for this
 * mark describes it: the lockup tumbles on a single pivot at its centre, each
 * axis turning at its own constant speed. No easing, no direction changes, no
 * canned cycle. Speeds whose ratios are irrational never line up again, so the
 * motion never repeats — but it reads as mechanical and hypnotic rather than
 * random, which is the point.
 */

export interface SpinState {
  /** Rotation about each axis, in degrees, always within one turn. */
  x: number;
  y: number;
  z: number;
  /** Degrees per second at a speed of 1. Fixed for the life of the mark. */
  vx: number;
  vy: number;
  vz: number;
}

export type Vec3 = readonly [number, number, number];

/**
 * How fast each axis turns at a speed of 1, in degrees per second.
 *
 * Deliberately unrelated to one another: no two form a ratio of small whole
 * numbers, so the three never fall back into step. Slow enough that the lockup
 * swings round to face the room every so often and can be read.
 */
const BASE_SPEED = { x: 7.3, y: 12.9, z: 4.1 };

/** How far each run's speeds may stray from the base, so no two runs match. */
const JITTER = 0.2;

/**
 * A starting orientation and a set of speeds.
 *
 * Both are re-diced every run: where it starts, how fast each axis turns within
 * ±20% of its base, and which way. That is where the variety comes from. Within
 * a run nothing changes, as the spec asks. `random` is an argument so a test
 * can hand it a known sequence.
 */
export function startSpin(random: () => number = Math.random): SpinState {
  const speed = (base: number) => base * (1 + (random() * 2 - 1) * JITTER) * (random() < 0.5 ? -1 : 1);

  return {
    x: random() * 360,
    y: random() * 360,
    z: random() * 360,
    vx: speed(BASE_SPEED.x),
    vy: speed(BASE_SPEED.y),
    vz: speed(BASE_SPEED.z),
  };
}

/**
 * Advances the rotation by `dtMs`, at `speed` times the run's own rates.
 *
 * Time-based, so a television turns it at the same pace whatever its frame
 * rate. The speed is applied here rather than stored, so changing it in the
 * panel editor takes effect without restarting the motion.
 */
export function step(state: SpinState, dtMs: number, speed = 1): SpinState {
  const dt = (Math.max(0, dtMs) / 1000) * Math.max(0, speed);

  return {
    ...state,
    x: wrapDegrees(state.x + state.vx * dt),
    y: wrapDegrees(state.y + state.vy * dt),
    z: wrapDegrees(state.z + state.vz * dt),
  };
}

/**
 * Which way the front face points once the lockup is turned.
 *
 * In CSS coordinates: x to the right, y down, z toward the viewer. The component
 * applies `rotateX rotateY rotateZ` in that order, which multiplies out to this
 * for the face's own normal. Rolling about Z spins the face within its own plane
 * and so does not move the normal at all. Checked against the browser's own
 * `DOMMatrix` over two thousand random orientations.
 */
export function faceNormal(state: SpinState): Vec3 {
  const x = toRadians(state.x);
  const y = toRadians(state.y);

  return [Math.sin(y), -Math.sin(x) * Math.cos(y), Math.cos(x) * Math.cos(y)];
}

export type Material = 'metallic' | 'solid';

/** Brightness of each visible surface, and where the shine sits on each cap. */
export interface Shading {
  /** The front cap, from 0 to 1. */
  front: number;
  /** The back cap, seen when the lockup has turned round. */
  back: number;
  /** The extruded sides. */
  side: number;
  /** Strength of the specular shine on each cap, from 0 to 1. Always 0 for solid. */
  frontShine: number;
  backShine: number;
  /** Where the shine sits on each cap, as a fraction across and down it. */
  frontShineAt: readonly [number, number];
  backShineAt: readonly [number, number];
}

/**
 * One key light, just above and to the left of the viewer, like the original's
 * lights in front of the text. Pointing from the surface toward the light.
 *
 * Close to the line of sight on purpose: a cap turned toward the room is then
 * lit, and reads as the bright face of the letters. A light far off to the side
 * left the visible cap dim more often than not, and the lettering read as dark
 * shapes on a grey slab.
 */
const LIGHT: Vec3 = normalise([-0.25, -0.35, 0.9]);

/** The viewer looks straight down the z axis. */
const VIEW: Vec3 = [0, 0, 1];

/** Halfway between light and view, for Blinn-Phong highlights. */
const HALF: Vec3 = normalise([LIGHT[0] + VIEW[0], LIGHT[1] + VIEW[1], LIGHT[2] + VIEW[2]]);

/** Never fully black: a surface facing away should still read as a surface. */
const AMBIENT = 0.22;
const DIFFUSE = 0.78;
const SIDE_DIFFUSE = 0.62;

/** How tight the metallic shine is. Higher is smaller and harder. */
const SHININESS = 24;

/**
 * Early-OpenGL lighting: ambient, Lambert diffuse, and a Blinn-Phong highlight
 * for metal. Deliberately crude, as the spec wants.
 *
 * Every output is a continuous function of the normal, and the normal is a
 * continuous function of the angles. So the shading can change quickly when the
 * lockup swings through the light, but it can never jump. The reflection this
 * replaced wrapped its angle and leapt across the face twice a cycle.
 *
 * The sides are lit as the side a viewer can actually see. The walls run all
 * round each letter, so the one in view is the one leaning toward the viewer:
 * the line of sight with its component along the face removed. Face-on to the
 * room, that is nothing, and the sides sit in shadow behind a bright cap. Edge-on,
 * it is the whole wall, and the sides catch the light as the cap goes dark. That
 * swap is what keeps the front and the extrusion visibly different.
 */
export function shade(normal: Vec3, material: Material = 'metallic'): Shading {
  const facing = dot(normal, LIGHT);
  const metal = material === 'metallic';

  const shine = (n: Vec3) => (metal ? Math.pow(Math.max(0, dot(n, HALF)), SHININESS) : 0);
  const back: Vec3 = [-normal[0], -normal[1], -normal[2]];

  // Deliberately not normalised: its length is how much wall is in view, which
  // fades the sides smoothly to ambient as the lockup turns face-on.
  const along = dot(VIEW, normal);
  const wall: Vec3 = [VIEW[0] - along * normal[0], VIEW[1] - along * normal[1], VIEW[2] - along * normal[2]];

  return {
    front: AMBIENT + DIFFUSE * Math.max(0, facing),
    back: AMBIENT + DIFFUSE * Math.max(0, -facing),
    side: AMBIENT + SIDE_DIFFUSE * Math.max(0, dot(wall, LIGHT)),
    frontShine: shine(normal),
    backShine: shine(back),
    frontShineAt: shineAt(normal),
    backShineAt: shineAt(back),
  };
}

/**
 * Where on a cap the highlight appears.
 *
 * The light's reflection off the cap, projected onto it: when the reflection
 * points straight at the viewer the shine sits in the middle, and it slides
 * toward the edge the reflection leans away from. Smooth in the normal, and
 * clamped just past the edges so it slides off rather than vanishing.
 */
function shineAt(normal: Vec3): readonly [number, number] {
  const along = 2 * dot(normal, LIGHT);
  const reflected: Vec3 = [along * normal[0] - LIGHT[0], along * normal[1] - LIGHT[1], along * normal[2] - LIGHT[2]];

  const place = (v: number) => Math.min(1.3, Math.max(-0.3, 0.5 + v * 0.8));
  return [place(reflected[0]), place(reflected[1])];
}

/** Keeps a continuously growing angle inside one turn. */
function wrapDegrees(degrees: number): number {
  const wrapped = degrees % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalise(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / length, v[1] / length, v[2] / length];
}

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
