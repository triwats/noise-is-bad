import React from 'react';

import { css } from '@emotion/css';

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
export type QuietMark = 'dvd' | 'text' | '3d' | 'flip';

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
 * What the screen shows when nothing is wrong. Three screensavers: a mark
 * bouncing off the edges, Microsoft's 3D text turning in place, or a flip clock
 * telling the time.
 *
 * This component is only the choice between them and the box they sit in. The
 * motion lives in `BouncingMark`, `ThreeDText` and `FlipClock`, and the maths
 * behind each is pure and tested on its own in `bounce.ts`, `spin.ts` and
 * `flip.ts`.
 */
export const QuietMode: React.FC<Props> = ({
  width,
  height,
  theme,
  mark = 'dvd',
  text = DEFAULT_SPIN_TEXT,
  threeD,
}) => (
  // The 3D text and the flip clock sit in a black void whatever Grafana's
  // theme, as the screensavers did. The bouncing marks sit on the theme's own
  // canvas.
  <div
    className={styles.stage}
    style={{ width, height, background: mark === '3d' || mark === 'flip' ? VOID : theme.canvas }}
    data-testid="quiet-mode"
  >
    {mark === 'flip' ? (
      <FlipClock width={width} height={height} />
    ) : mark === '3d' ? (
      <ThreeDText text={text} width={width} height={height} {...threeD} />
    ) : (
      <BouncingMark width={width} height={height} theme={theme} mark={mark} />
    )}
  </div>
);

const VOID = '#000000';

const styles = {
  stage: css({
    position: 'relative',
    overflow: 'hidden',
  }),
};
