import React, { useEffect, useRef } from 'react';

import { css } from '@emotion/css';

import { BounceState, Bounds, startState, step } from './bounce';
import { LOCKUP_ASPECT, NibLockup } from './brand';
import { DVD_ASPECT, DVD_PALETTE, DvdMark } from './dvdMark';
import { NoiseTheme } from './theme';

/** The marks that bounce: the DVD logo, or our own lockup in the theme's colour. */
export type BouncingKind = 'dvd' | 'text';

interface Props {
  width: number;
  height: number;
  theme: NoiseTheme;
  mark: BouncingKind;
}

/**
 * The longest frame gap we will integrate in one go. Beyond this the tab was
 * backgrounded or the television was asleep, and catching up in real time would
 * fling the mark across the screen.
 */
const MAX_FRAME_MS = 100;

/** How much of the stage a mark spans, measured along its bounding edge. */
const MARK_SCALE = 0.3;

/**
 * The bouncing half of quiet mode (NIB-004, NIB-005).
 *
 * The mark drifts and bounces off the edges, DVD-style, and as the DVD logo it
 * changes colour on every wall it hits.
 *
 * The animation writes `transform` straight onto the element rather than going
 * through React state, so an office television can run this for days without
 * sixty re-renders a second. Bounds live in a ref that a resize updates in
 * place, which means resizing nudges the mark instead of teleporting it back to
 * the start. The physics itself is in `bounce.ts`, pure and tested separately.
 */
export const BouncingMark: React.FC<Props> = ({ width, height, theme, mark }) => {
  const markRef = useRef<HTMLDivElement>(null);
  const boundsRef = useRef<Bounds>({ width, height, markWidth: 0, markHeight: 0 });
  const stateRef = useRef<BounceState | null>(null);
  // Which palette entry is currently painted, and whether to paint at all. The
  // animation loop is deliberately started once and never restarted, so it
  // reads the choice of mark from a ref rather than closing over the prop.
  const colourRef = useRef(-1);
  const cyclingRef = useRef(false);

  const size = markSize(width, height, mark === 'dvd' ? DVD_ASPECT : LOCKUP_ASPECT);

  useEffect(() => {
    // Every mark is outlined artwork with a known shape, so none of them needs
    // measuring. That matters: measuring text means waiting on a font, and a
    // mark measured before its font arrived bounces off the wrong walls.
    boundsRef.current = { width, height, markWidth: size.width, markHeight: size.height };

    if (!stateRef.current) {
      stateRef.current = startState(boundsRef.current);
    }

    // Only the DVD logo cycles. Forgetting the painted index means switching
    // marks repaints on the next frame rather than at the next wall. Anything
    // else — including a value saved by an option that no longer exists — is
    // our lockup, calm.
    const cycling = mark === 'dvd';
    cyclingRef.current = cycling;
    colourRef.current = -1;
    if (!cycling && markRef.current) {
      markRef.current.style.color = theme.mark;
    }
  }, [width, height, mark, size.width, size.height, theme.mark]);

  useEffect(() => {
    const element = markRef.current;
    if (!element) {
      return;
    }

    let frame = 0;
    let previous = 0;

    const tick = (now: number) => {
      if (previous) {
        const current = stateRef.current ?? startState(boundsRef.current);
        const next = step(current, boundsRef.current, Math.min(MAX_FRAME_MS, now - previous));

        stateRef.current = next;
        element.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;

        // Recolour on contact, not every frame. Writing an unchanged style
        // sixty times a second is work a television does not need to do.
        const colour = next.bounces % DVD_PALETTE.length;
        if (cyclingRef.current && colour !== colourRef.current) {
          colourRef.current = colour;
          element.style.color = DVD_PALETTE[colour];
        }
      }

      previous = now;
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Our lockup keeps the theme's colour; cycling is the DVD joke, not a
  // quiet-mode feature.
  const colour = mark === 'dvd' ? DVD_PALETTE[0] : theme.mark;

  return (
    <div ref={markRef} className={styles.mark} style={{ color: colour }} data-testid="quiet-mark" data-mark={mark}>
      {mark === 'dvd' ? (
        <DvdMark width={size.width} height={size.height} />
      ) : (
        <NibLockup width={size.width} height={size.height} />
      )}
    </div>
  );
};

/**
 * Big enough to read across an office, small enough to have somewhere to go.
 * Bounded by both edges so a short, wide panel does not get a mark taller than
 * the screen.
 */
function markSize(width: number, height: number, aspect: number): { width: number; height: number } {
  const span = Math.max(0, Math.min(width, height * aspect)) * MARK_SCALE;

  return { width: span, height: span / aspect };
}

const styles = {
  mark: css({
    position: 'absolute',
    top: 0,
    left: 0,
    lineHeight: 0,
    willChange: 'transform',
  }),
};
