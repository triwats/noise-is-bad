import React, { useEffect, useState } from 'react';

import { css, keyframes } from '@emotion/css';

import { BRAND_TYPEFACE, ensureBrandFont } from './brand';
import { CARD, FOLD_MS, Face, INK, UNFOLD_MS, VOID, faceOf, fitCards, msUntilNextMinute } from './flip';

interface Props {
  width: number;
  height: number;
}

/**
 * The flip clock mark: the split-flap desk clock as the Fliqlo screensaver
 * draws it. Two square cards in a black void, hours and minutes, and once a
 * minute a leaf falls.
 *
 * The time is the television's own, twenty-four hours, and there is nothing to
 * set. This runs for days, so nothing happens between minutes: one timeout
 * sleeps until the boundary, reads the actual time, and re-arms. A tab that
 * was asleep for an hour wakes to a single flip, not sixty. Mounting shows the
 * time with no flip, because quiet mode comes and goes with every incident and
 * the clock should not fall in each time.
 *
 * The flip is plain CSS, no library and no `preserve-3d`. Each card is two
 * static halves, the upper one already showing the next value, the lower one
 * the current. While a flip runs, two leaves sit on top: the upper leaf, with
 * the current value, folds down to edge-on, then the lower leaf, with the next
 * value, unfolds from edge-on to flat. A half is a clipped box holding the
 * whole digit, so there is no back face to hide and nothing to flatten. The
 * card itself is what a real flap clock does: only the card whose value changed
 * moves, so the hours flip on the hour and the minutes every minute.
 */
export const FlipClock: React.FC<Props> = ({ width, height }) => {
  ensureBrandFont();

  const [face, setFace] = useState<Face>(() => faceOf(new Date()));
  const fit = fitCards(width, height);

  useEffect(() => {
    let timer = 0;

    const arm = () => {
      // A little past the boundary, so the read never lands on the old minute.
      timer = window.setTimeout(tick, msUntilNextMinute(Date.now()) + LATENCY_MS);
    };
    const tick = () => {
      setFace(faceOf(new Date()));
      arm();
    };

    arm();
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={styles.stage} style={{ width, height, background: VOID }} data-testid="flip-clock">
      <div className={styles.row} style={{ gap: fit.gap, fontSize: fit.fontSize }}>
        <Card kind="hours" value={face.hours} size={fit.card} radius={fit.radius} />
        <Card kind="minutes" value={face.minutes} size={fit.card} radius={fit.radius} />
      </div>
    </div>
  );
};

interface CardProps {
  kind: 'hours' | 'minutes';
  /** What the card should read. When it changes, the card flips to it. */
  value: string;
  size: number;
  radius: number;
}

/** One card. Holds what it currently shows, and flips whenever it is told something new. */
const Card: React.FC<CardProps> = ({ kind, value, size, radius }) => {
  const [shown, setShown] = useState(value);
  const flipping = shown !== value;
  const half = { height: size / 2 };
  // Each half clips the full-height digits; the lower half pulls them up by half.
  const upper = { height: size, lineHeight: `${size}px` };
  const lower = { ...upper, top: -size / 2 };

  return (
    <div
      className={styles.card}
      style={{ width: size, height: size, borderRadius: radius, perspective: size * PERSPECTIVE }}
      data-testid="flip-card"
      data-card={kind}
      data-value={shown}
      data-flipping={flipping || undefined}
    >
      <div className={styles.top} style={half}>
        <div className={styles.digits} style={upper}>
          {value}
        </div>
      </div>
      <div className={styles.bottom} style={half}>
        <div className={styles.digits} style={lower}>
          {shown}
        </div>
      </div>
      {flipping && (
        // Keyed on the target: a new value mid-flip restarts both leaves at it.
        <React.Fragment key={value}>
          <div className={styles.fold} style={half} data-testid="flip-leaf">
            <div className={styles.digits} style={upper}>
              {shown}
            </div>
          </div>
          <div className={styles.unfold} style={half} data-testid="flip-leaf" onAnimationEnd={() => setShown(value)}>
            <div className={styles.digits} style={lower}>
              {value}
            </div>
          </div>
        </React.Fragment>
      )}
      <div className={styles.split} />
    </div>
  );
};

/** How far past the minute boundary the timer lands. */
const LATENCY_MS = 20;

/** Camera distance in card sizes. Far enough that a falling leaf foreshortens without looming. */
const PERSPECTIVE = 4;

/** A hairline between the halves, as the hinge on a real card. */
const SPLIT_PX = 2;

const fold = keyframes({ from: { transform: 'rotateX(0deg)' }, to: { transform: 'rotateX(-90deg)' } });
const unfold = keyframes({ from: { transform: 'rotateX(90deg)' }, to: { transform: 'rotateX(0deg)' } });

const halfBase = {
  position: 'absolute' as const,
  left: 0,
  width: '100%',
  overflow: 'hidden',
  background: CARD,
};

const styles = {
  stage: css({
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  row: css({
    display: 'flex',
    fontFamily: BRAND_TYPEFACE,
    fontWeight: 400,
    fontSynthesis: 'none',
    letterSpacing: '-0.04em',
    color: INK,
    WebkitFontSmoothing: 'antialiased',
  }),
  card: css({
    position: 'relative',
    overflow: 'hidden',
    background: CARD,
  }),
  digits: css({
    position: 'absolute',
    left: 0,
    width: '100%',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  }),
  top: css({ ...halfBase, top: 0 }),
  bottom: css({ ...halfBase, bottom: 0 }),
  fold: css({
    ...halfBase,
    top: 0,
    transformOrigin: 'bottom',
    animation: `${fold} ${FOLD_MS}ms ease-in forwards`,
  }),
  unfold: css({
    ...halfBase,
    bottom: 0,
    transformOrigin: 'top',
    transform: 'rotateX(90deg)',
    animation: `${unfold} ${UNFOLD_MS}ms ${FOLD_MS}ms ease-out forwards`,
  }),
  split: css({
    position: 'absolute',
    left: 0,
    width: '100%',
    top: `calc(50% - ${SPLIT_PX / 2}px)`,
    height: SPLIT_PX,
    background: VOID,
  }),
};
