import React, { useEffect, useRef, useState } from 'react';

import { css } from '@emotion/css';

import { BRAND_TYPEFACE, LOCKUP, MARK_MASK, StaticMark, ensureBrandFont, lockupSize, stackLines } from './brand';
import { Material, Shading, SpinState, faceNormal, shade, startSpin, step } from './spin';

export interface ThreeDOptions {
  /** How big, as a fraction of the largest that stays on screen at every angle. */
  size: number;
  /** How far the letters are extruded, in ems. */
  depth: number;
  /** A multiple of the natural turning speed. */
  speed: number;
  material: Material;
  /** The surface colour, as `#rrggbb` or `rgb()`. */
  colour: string;
}

export const DEFAULT_THREE_D: ThreeDOptions = {
  size: 1,
  depth: 0.35,
  speed: 1,
  material: 'metallic',
  colour: '#c0c4cc',
};

interface Props extends Partial<ThreeDOptions> {
  text: string;
  width: number;
  height: number;
}

/**
 * The 3D text mark: the Windows XP screensaver, rebuilt in CSS.
 *
 * The noise is bad. lockup — the static mark beside the text, stacked onto two
 * lines — extruded, tumbling forever on a pivot at its centre in a black void.
 * Each axis turns at its own constant speed, so over time it shows its face,
 * its extruded sides, its edge and its mirrored back, and never repeats.
 *
 * Extrusion is a stack of copies of the lockup, each a little further back, with
 * a lit cap at the front and another at the back, inside one `preserve-3d`
 * container. Rotating the container turns everything at once, so a frame costs
 * one transform however many layers there are. Lighting reaches every layer
 * through a handful of custom properties on that same container.
 *
 * Everything here is CSS. No 3D library, no textures to load, and nothing added
 * to webpack, which is what keeps `src/render/` liftable out of the plugin.
 *
 * **Never put `overflow` other than visible, `opacity` below 1, `filter`,
 * `clip-path`, `mask-image`, `mix-blend-mode` or `contain: paint` on the
 * rotator.** Each of them silently forces `transform-style: flat`, there is no
 * safe threshold — `opacity: 0.999` flattens as hard as `0.2` — and afterwards
 * the transform still reads correctly in DevTools while the text renders as a
 * flat sign. `ThreeDText.test.tsx` walks the chain, and an end-to-end test
 * measures real depth in a real browser.
 *
 * Clipping the stage is fine: it carries the perspective, but its own
 * `transform-style` is already flat, so there is nothing for `overflow` to
 * flatten.
 */
export const ThreeDText: React.FC<Props> = ({ text, width, height, ...settings }) => {
  const options = { ...DEFAULT_THREE_D, ...definedOnly(settings) };

  const rotatorRef = useRef<HTMLDivElement>(null);
  // Diced once per mount: where it starts, and how fast and which way each axis
  // turns. That is what makes one run look different from the next.
  const [start] = useState(() => startSpin());
  const stateRef = useRef<SpinState>(start);
  // The loop starts once and never restarts, so it reads live settings from here.
  const liveRef = useRef(options);
  const writtenRef = useRef<Record<string, string>>({});

  // After every render, not during it: the loop picks the change up on its next frame.
  useEffect(() => {
    liveRef.current = options;
  });

  ensureBrandFont();

  const lines = stackLines(text || ' ');
  const lockup = lockupSize(lines);
  const fontSize = fitLockup(lockup, options.depth, width, height) * clamp(options.size, 0.1, 1);
  const depth = options.depth * fontSize;
  const layers = Math.max(MIN_LAYERS, Math.min(MAX_LAYERS, Math.round(depth / LAYER_STEP)));
  const perspective = sphereRadius(lockup, options.depth) * fontSize * CAMERA_DISTANCE;
  const stacked = lines.join('\n');

  // A change of material or colour has to repaint now, not at the next change of shade.
  useEffect(() => {
    writtenRef.current = {};
  }, [options.material, options.colour]);

  useEffect(() => {
    const rotator = rotatorRef.current;
    if (!rotator) {
      return;
    }

    // Only ever touches the style when the value would actually look different.
    // Every wall is a texture on the GPU; repainting all of them sixty times a
    // second for a change nobody could see is how a television falls behind.
    const write = (name: string, value: string) => {
      if (writtenRef.current[name] !== value) {
        writtenRef.current[name] = value;
        rotator.style.setProperty(name, value);
      }
    };

    const paint = (state: SpinState) => {
      const { material, colour } = liveRef.current;
      writeShading(write, shade(faceNormal(state), material), parseColour(colour));
      rotator.style.transform = `translate(-50%, -50%) rotateX(${state.x}deg) rotateY(${state.y}deg) rotateZ(${state.z}deg)`;
    };

    let frame = 0;
    let previous = 0;

    const tick = (now: number) => {
      if (previous) {
        const next = step(stateRef.current, Math.min(MAX_FRAME_MS, now - previous), liveRef.current.speed);
        stateRef.current = next;
        paint(next);
      }
      previous = now;
      frame = requestAnimationFrame(tick);
    };

    paint(stateRef.current);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const markBox = { width: `${lockup.mark}em`, height: `${lockup.mark}em` };

  return (
    <div className={styles.stage} style={{ width, height, perspective: `${perspective}px` }} data-testid="three-d-text">
      <div ref={rotatorRef} className={styles.rotator} style={{ fontSize }} data-testid="three-d-rotator">
        {Array.from({ length: layers }, (_, layer) => (
          <div
            key={layer}
            aria-hidden="true"
            className={styles.layer}
            data-testid="three-d-wall"
            // Strictly between the two caps, so no wall ever sits in the same
            // plane as one and flickers against it.
            style={{ transform: `translateZ(${depth / 2 - ((layer + 1) * depth) / (layers + 1)}px)` }}
          >
            <StaticMark size={`${lockup.mark}em`} />
            <div className={styles.words}>{stacked}</div>
          </div>
        ))}
        <div
          aria-hidden="true"
          className={styles.layer}
          data-testid="three-d-back"
          style={{ transform: `translateZ(${-depth / 2}px)` }}
        >
          <div className={styles.backMark} style={markBox} />
          <div className={styles.backWords}>{stacked}</div>
        </div>
        <div className={styles.layer} data-testid="three-d-front" style={{ transform: `translateZ(${depth / 2}px)` }}>
          <div className={styles.frontMark} style={markBox} data-testid="three-d-face-mark" />
          <div className={styles.frontWords} data-testid="three-d-face">
            {stacked}
          </div>
        </div>
      </div>
    </div>
  );
};

/** Writes one frame's lighting as custom properties the layers read. */
function writeShading(write: (name: string, value: string) => void, light: Shading, base: Rgb): void {
  write('--nib-front', rgb(base, light.front));
  write('--nib-front-low', rgb(base, light.front * CAP_FALLOFF));
  write('--nib-back', rgb(base, light.back));
  write('--nib-back-low', rgb(base, light.back * CAP_FALLOFF));
  // Every wall reads this one, so it moves in coarse steps.
  write('--nib-side', rgb(base, Math.round(light.side * SIDE_LEVELS) / SIDE_LEVELS));
  write('--nib-front-shine', light.frontShine.toFixed(2));
  write('--nib-back-shine', light.backShine.toFixed(2));
  write('--nib-front-shine-at', percentages(light.frontShineAt));
  write('--nib-back-shine-at', percentages(light.backShineAt));
}

const percentages = ([x, y]: readonly [number, number]): string => `${Math.round(x * 100)}% ${Math.round(y * 100)}%`;

type Rgb = readonly [number, number, number];

/** Silver, if a colour arrives in a shape this does not read. */
const FALLBACK: Rgb = [192, 196, 204];

/** Reads `#rgb`, `#rrggbb` and `rgb()` or `rgba()`: what a colour picker hands over. */
export function parseColour(colour: string): Rgb {
  const hex = colour.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join('') : hex[1];
    return [parseInt(digits.slice(0, 2), 16), parseInt(digits.slice(2, 4), 16), parseInt(digits.slice(4, 6), 16)];
  }
  const fn = colour.trim().match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  return fn ? [Number(fn[1]), Number(fn[2]), Number(fn[3])] : FALLBACK;
}

const rgb = (base: Rgb, level: number): string =>
  `rgb(${base.map((channel) => Math.round(clamp(channel * level, 0, 255))).join(', ')})`;

/**
 * The largest font size at which the lockup stays wholly on screen at every angle.
 *
 * It can face any direction, so it is sized by its bounding sphere rather than
 * its resting shape. Through the perspective, a sphere of radius R seen from
 * distance d projects to a circle of radius R·d/√(d²−R²). That circle, both
 * sides of centre, must fit within `ROOM` of the panel's shorter edge. On a
 * 16:9 television this puts the lockup across roughly the middle third to half
 * of the screen, as the spec asks.
 */
function fitLockup(lockup: { width: number; height: number }, depthEm: number, width: number, height: number): number {
  const radius = sphereRadius(lockup, depthEm);
  const projected = radius * (CAMERA_DISTANCE / Math.sqrt(CAMERA_DISTANCE * CAMERA_DISTANCE - 1));

  return Math.max(MIN_FONT, (Math.min(width, height) * ROOM) / (2 * projected));
}

/** Half the diagonal of the lockup's box, in ems: every point of it lies within this of the pivot. */
function sphereRadius(lockup: { width: number; height: number }, depthEm: number): number {
  return Math.hypot(lockup.width, lockup.height, depthEm) / 2;
}

/**
 * How far away the camera sits, in bounding-sphere radii.
 *
 * Far enough that the nearest point of the lockup can never reach it, and that
 * perspective stays noticeable without turning wide-angle: a point swinging
 * toward the viewer grows by at most 1.5 times.
 */
const CAMERA_DISTANCE = 3;

/** How much of the panel's shorter edge the lockup may sweep. */
const ROOM = 0.95;

/** Below this the lockup stops reading as anything from across a room. */
const MIN_FONT = 10;

/** The longest frame we integrate in one go, as the bouncing mark uses. */
const MAX_FRAME_MS = 100;

/**
 * Roughly a pixel between layers.
 *
 * Any wider and the stack shows gaps as it turns edge-on, because the space
 * between layers projects to `step × sin(angle)`.
 */
const LAYER_STEP = 0.7;
const MIN_LAYERS = 12;

/**
 * Every layer is a full-resolution texture on the GPU. This runs for days, so
 * the stack is capped rather than left to grow with the text size.
 */
const MAX_LAYERS = 48;

/** How many shades the walls step through. Coarse enough that they rarely repaint. */
const SIDE_LEVELS = 24;

/** How much darker the bottom of a cap is than its top: crude, period-correct gloss. */
const CAP_FALLOFF = 0.72;

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

/** Drops props passed as `undefined`, so they fall through to the defaults. */
function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/**
 * A lit cap: its colour from the top down to a little darker, with a specular
 * spot over it that moves and fades with the light.
 */
const cap = (side: 'front' | 'back') => ({
  backgroundImage: [
    `radial-gradient(circle at var(--nib-${side}-shine-at, 50% 30%), rgba(255, 255, 255, calc(var(--nib-${side}-shine, 0) * 0.85)) 0%, rgba(255, 255, 255, 0) 42%)`,
    `linear-gradient(180deg, var(--nib-${side}, #c0c4cc), var(--nib-${side}-low, #8a8d93))`,
  ].join(', '),
  backgroundSize: '100% 100%',
});

/** The mark on a cap: the cap's surface, cut to the static by a mask. */
const capMark = (side: 'front' | 'back') =>
  css({
    flex: 'none',
    ...cap(side),
    WebkitMaskImage: MARK_MASK,
    maskImage: MARK_MASK,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
  });

/** The words on a cap: the cap's surface, cut to the glyphs. */
const capWords = (side: 'front' | 'back') =>
  css({
    whiteSpace: 'pre',
    lineHeight: LOCKUP.lineHeight,
    letterSpacing: `${LOCKUP.tracking}em`,
    ...cap(side),
    // Written as literal keywords on purpose. Behind a custom property WebKit
    // silently drops the text clip and paints a solid block instead. And this
    // element must stay childless, or Chrome does not paint the clip at all.
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
  });

const styles = {
  stage: css({
    position: 'relative',
    perspectiveOrigin: '50% 50%',
    overflow: 'hidden',
  }),
  rotator: css({
    position: 'absolute',
    left: '50%',
    top: '50%',
    transformStyle: 'preserve-3d',
    // On the container only. The layers never move relative to it, and giving
    // each of them its own compositing layer is how this runs a television out
    // of graphics memory overnight.
    willChange: 'transform',
    fontFamily: BRAND_TYPEFACE,
    fontWeight: 400,
    fontSynthesis: 'none',
    // Pinned so the text does not change weight when the motion starts and stops.
    WebkitFontSmoothing: 'antialiased',
  }),
  // Every layer, walls and caps alike, is the lockup: the mark, then the words.
  // The front cap stays in flow and gives the rotator its size; everything else
  // is placed exactly on top of it.
  layer: css({
    position: 'absolute',
    left: 0,
    top: 0,
    display: 'flex',
    alignItems: 'center',
    gap: `${LOCKUP.gap}em`,
    color: 'var(--nib-side, #6b6e74)',
    '&:last-child': { position: 'relative' },
  }),
  words: css({
    whiteSpace: 'pre',
    lineHeight: LOCKUP.lineHeight,
    letterSpacing: `${LOCKUP.tracking}em`,
  }),
  frontMark: capMark('front'),
  frontWords: capWords('front'),
  backMark: capMark('back'),
  backWords: capWords('back'),
};
