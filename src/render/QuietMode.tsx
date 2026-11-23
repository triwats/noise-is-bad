import React from 'react';

import { css } from '@emotion/css';

import { BoingBall } from './BoingBall';
import { BOING_ROOM } from './boing';
import { BouncingMark } from './BouncingMark';
import { WORDMARK } from './brand';
import { FlipClock } from './FlipClock';
import { NoiseTheme } from './theme';
import { ThreeDOptions, ThreeDText } from './ThreeDText';

/**
 * Which screensaver quiet mode runs.
 *
 * `text` predates the brand and keeps its name so saved dashboards still load;
 * it now draws the lockup rather than plain text.
 */
export type QuietMark = 'dvd' | 'text' | '3d' | 'flip' | 'boing';

/** What the 3D text says when nobody has set anything. */
export const DEFAULT_SPIN_TEXT = WORDMARK;

interface Props {
  width: number;
  height: number;
  theme: NoiseTheme;
  /** Which mark to run. Defaults to the DVD logo. */
  mark?: QuietMark;
  /** What the 3D text spells out. */
  text?: string;
  /** How the 3D text looks and moves. Anything left out takes its default. */
  threeD?: Partial<ThreeDOptions>;
}

/**
 * Quiet mode (NIB-004, NIB-005).
 *
 * What the screen shows when nothing is wrong. Four screensavers: a mark
 * bouncing off the edges, Microsoft's 3D text turning in place, a flip clock
 * telling the time, or the Amiga's Boing ball.
 *
 * This component is only the choice between them and the box they sit in. The
 * motion lives in `BouncingMark`, `ThreeDText`, `FlipClock` and `BoingBall`,
 * and the maths behind each is pure and tested on its own in `bounce.ts`,
 * `spin.ts`, `flip.ts` and `boing.ts`.
 */
export const QuietMode: React.FC<Props> = ({
  width,
  height,
  theme,
  mark = 'dvd',
  text = DEFAULT_SPIN_TEXT,
  threeD,
}) => (
  <div className={styles.stage} style={{ width, height, background: backgroundOf(mark, theme) }} data-testid="quiet-mode">
    {mark === 'boing' ? (
      <BoingBall width={width} height={height} />
    ) : mark === 'flip' ? (
      <FlipClock width={width} height={height} />
    ) : mark === '3d' ? (
      <ThreeDText text={text} width={width} height={height} {...threeD} />
    ) : (
      <BouncingMark width={width} height={height} theme={theme} mark={mark} />
    )}
  </div>
);

const VOID = '#000000';

/**
 * The 3D text and the flip clock sit in a black void whatever Grafana's theme,
 * and the Boing ball in its grey room, as the screensavers did. The bouncing
 * marks sit on the theme's own canvas.
 */
function backgroundOf(mark: QuietMark, theme: NoiseTheme): string {
  switch (mark) {
    case '3d':
    case 'flip':
      return VOID;
    case 'boing':
      return BOING_ROOM;
    default:
      return theme.canvas;
  }
}

const styles = {
  stage: css({
    position: 'relative',
    overflow: 'hidden',
  }),
};
