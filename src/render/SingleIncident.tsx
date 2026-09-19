import React from 'react';

import { css } from '@emotion/css';

import { CRITICAL, NoiseItem, severityLabel } from '../noise/types';
import { fillStrength } from './fill';
import { fitFontSize } from './fitText';
import { NoiseTheme, WARNING_SCALE } from './theme';

interface Props {
  signal: NoiseItem;
  width: number;
  height: number;
  theme: NoiseTheme;
}

/**
 * One problem, the whole screen (NIB-006).
 *
 * This is where the main idea becomes visible: the screen shows what needs
 * attention, not a map of the estate. One problem is not a box in a grid of
 * services. It is everything, right down to the colour of the wall behind it.
 *
 * Painting the whole panel rather than just the words is the point. From ten
 * metres you see the colour before you read anything, and you should.
 *
 * No graphs, no numbers, no times, no explanation. Someone across the room gets
 * the name and how bad it is, and nothing competes with that.
 */
export const SingleIncident: React.FC<Props> = ({ signal, width, height, theme }) => {
  const label = severityLabel(signal.severity);
  const critical = signal.severity === CRITICAL;

  const fitted = fitFontSize(signal.name, width, height, { heightFraction: 0.34 });
  const nameSize = critical ? fitted : fitted * WARNING_SCALE;
  const labelSize = Math.max(11, nameSize * 0.26);

  return (
    <div
      className={styles.stage}
      style={{ width, height, background: theme.canvas }}
      data-testid="single-incident"
      data-severity={label}
    >
      <div
        className={styles.fill}
        style={{
          background: critical ? theme.critical : theme.warning,
          opacity: fillStrength(signal.pressure),
        }}
      />
      <div className={styles.text} style={{ color: theme.mark }}>
        <div className={styles.name} style={{ fontSize: nameSize, fontWeight: critical ? 800 : 600 }}>
          {signal.name}
        </div>
        <div
          className={styles.label}
          style={{ fontSize: labelSize, letterSpacing: critical ? '0.24em' : '0.14em' }}
          data-testid="single-incident-severity"
        >
          {label}
        </div>
      </div>
    </div>
  );
};

const styles = {
  stage: css({
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    textAlign: 'center',
  }),
  fill: css({
    position: 'absolute',
    inset: 0,
  }),
  text: css({
    position: 'relative',
    maxWidth: '100%',
    padding: '0 3%',
  }),
  name: css({
    maxWidth: '100%',
    overflow: 'hidden',
    textTransform: 'uppercase',
    letterSpacing: '-0.02em',
    lineHeight: 1,
    whiteSpace: 'nowrap',
  }),
  label: css({
    textTransform: 'uppercase',
    lineHeight: 1.6,
    opacity: 0.85,
    // The indent balances the trailing letter-spacing so the word stays centred.
    textIndent: '0.2em',
  }),
};
