import React from 'react';

import { css } from '@emotion/css';

import { BouncingMark } from './BouncingMark';
import { WORDMARK } from './brand';
import { NoiseTheme } from './theme';
import { ThreeDOptions, ThreeDText } from './ThreeDText';

/**
 * Which screensaver quiet mode runs.
 *
 * `text` predates the brand and keeps its name so saved dashboards still load;
 * it now draws the lockup rather than plain text.
 */
export type QuietMark = 'dvd' | 'text' | '3d';

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
 * What the screen shows when nothing is wrong. Two screensavers: a mark
 * bouncing off the edges, or Microsoft's 3D text turning in place.
 *
 * This component is only the choice between them and the box they sit in. The
 * motion lives in `BouncingMark` and `ThreeDText`, and the maths behind each is
 * pure and tested on its own in `bounce.ts` and `spin.ts`.
 */
export const QuietMode: React.FC<Props> = ({
  width,
  height,
  theme,
  mark = 'dvd',
  text = DEFAULT_SPIN_TEXT,
  threeD,
}) => (
  // The 3D text tumbles in a black void whatever Grafana's theme, as the
  // screensaver did. The bouncing marks sit on the theme's own canvas.
  <div
    className={styles.stage}
    style={{ width, height, background: mark === '3d' ? VOID : theme.canvas }}
    data-testid="quiet-mode"
  >
    {mark === '3d' ? (
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
