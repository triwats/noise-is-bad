import React, { useEffect, useState } from 'react';

import { css } from '@emotion/css';

import { CRITICAL, NoiseItem, severityLabel } from '../noise/types';
import { DEFAULT_MAX_BOXES, capProblems } from './cap';
import { fillStrength } from './fill';
import { fitFontSize } from './fitText';
import { NoiseTheme, WARNING_SCALE } from './theme';
import { TransitionStyle, transitionFor } from './transitions';
import { Rect, layout } from './treemapLayout';

interface Props {
  problems: NoiseItem[];
  width: number;
  height: number;
  theme: NoiseTheme;
  /** How long tiles take to resize. The plan asks for 300 to 800ms. */
  transitionMs?: number;
  /** How boxes come and go. */
  transitionStyle?: TransitionStyle;
  /** The most boxes on screen, counting the one that stands in for the rest. */
  maxBoxes?: number;
}

/** A problem with a rectangle to draw it in. */
type Drawn = NoiseItem & { weight: number } & Rect;

/** The thin line between boxes. Small, so the screen reads as one thing. */
const GAP = 2;

/**
 * The name given to the box standing in for everything that did not fit.
 *
 * It needs a name like any other box, so it can be tracked and animated, but
 * it must never collide with a real service.
 */
export const OVERFLOW = '__more__';

/** Below this you cannot read the name across a room, so show colour only. */
const MIN_NAME_SIZE = 11;

/**
 * Several problems sharing the screen (NIB-007, NIB-008).
 *
 * Boxes are filled in rather than see-through, because you read a treemap by
 * size first and words second. A box too small for readable text keeps its
 * colour and drops the name: twenty words nobody can read is the wrong kind of
 * noise, while twenty coloured boxes is exactly the right kind.
 *
 * The fill gets stronger as a problem's score rises, so one that has dragged on
 * does not just take more room, it looks stronger too. That is two ways of
 * showing the same number, which is what Epic 7 asks us to try.
 *
 * Each box is tagged with its service name, so React keeps the same element
 * between refreshes and an ordinary CSS transition slides it to its new place.
 * That is what stops the screen flashing: nothing is thrown away and rebuilt,
 * it just moves.
 */
export const Treemap: React.FC<Props> = ({
  problems,
  width,
  height,
  theme,
  transitionMs = 500,
  transitionStyle = 'grow',
  maxBoxes = DEFAULT_MAX_BOXES,
}) => {
  const motion = transitionFor(transitionStyle);
  // The score decides how much screen each one gets: how bad it is, multiplied
  // by how long it has lasted. Worked out elsewhere; this just uses it.
  // Past a certain number of boxes the board stops being readable, so the worst
  // ones get their own box and the rest share one. That last box takes the
  // colour and size of the worst thing inside it, so a critical is never hidden
  // behind a warning, and it is never so big it drowns out what is named.
  const { shown: named, hidden } = capProblems(problems, maxBoxes);
  const drawn: NoiseItem[] = hidden.length
    ? [...named, { ...hidden[0], id: OVERFLOW, name: OVERFLOW }]
    : named;

  const weighted = drawn.map((item) => ({ ...item, weight: item.pressure }));
  const tiles = layout(weighted, width, height, GAP);

  // React takes a box out of the page the moment its problem clears, which
  // leaves no chance to animate it. So the ones that have just gone are kept a
  // little longer, drawn where they were, while the survivors move into the
  // space. The signature includes the panel size so a resize refreshes the
  // remembered rectangles rather than animating out of a stale position.
  const signature = `${width}x${height}:${tiles.map((t) => t.name).join('|')}`;
  const [shown, setShown] = useState<{ signature: string; tiles: Drawn[]; leaving: Drawn[] }>({
    signature,
    tiles,
    leaving: [],
  });

  if (shown.signature !== signature) {
    const gone = motion.leaveMs
      ? shown.tiles.filter((old) => !tiles.some((tile) => tile.name === old.name))
      : [];
    setShown({ signature, tiles, leaving: gone });
  }

  useEffect(() => {
    if (shown.leaving.length === 0) {
      return;
    }

    const timer = setTimeout(() => setShown((current) => ({ ...current, leaving: [] })), motion.leaveMs);
    return () => clearTimeout(timer);
  }, [shown.leaving, motion.leaveMs]);

  return (
    <div className={styles.board} style={{ width, height, background: theme.canvas }} data-testid="treemap">
      {tiles.map((tile) => {
        const overflow = tile.name === OVERFLOW;
        const label = overflow ? 'not shown' : severityLabel(tile.severity);
        const critical = tile.severity === CRITICAL;
        const text = overflow ? `+${hidden.length} more` : tile.name;

        const fitted = fitFontSize(text, tile.width, tile.height, { heightFraction: 0.26, minimum: 0 });
        const nameSize = critical ? fitted : fitted * WARNING_SCALE;
        const showName = nameSize >= MIN_NAME_SIZE;
        const showLabel = showName && tile.height >= nameSize * 3 && nameSize >= 15;

        return (
          <div
            key={tile.name}
            className={`${styles.tile} ${motion.arrive}`}
            data-testid="treemap-tile"
            data-name={tile.name}
            data-severity={label}
            data-labelled={showName ? 'yes' : 'no'}
            data-overflow={overflow ? hidden.length : undefined}
            style={{
              left: tile.x,
              top: tile.y,
              width: tile.width,
              height: tile.height,
              borderColor: theme.edge,
              transitionDuration: `${transitionMs}ms`,
            }}
          >
            <div
              className={styles.fill}
              style={{
                background: critical ? theme.critical : theme.warning,
                opacity: fillStrength(tile.pressure),
              }}
            />
            {showName && (
              <div className={styles.text} style={{ color: theme.mark }}>
                <div className={styles.name} style={{ fontSize: nameSize, fontWeight: critical ? 800 : 600 }}>
                  {text}
                </div>
                {showLabel && (
                  <div className={styles.label} style={{ fontSize: Math.max(9, nameSize * 0.24) }}>
                    {label}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {shown.leaving.map((tile) => (
        <div
          key={`leaving-${tile.name}`}
          className={`${styles.tile} ${styles.departing} ${motion.leave}`}
          data-testid="treemap-tile-leaving"
          data-name={tile.name}
          style={{
            left: tile.x,
            top: tile.y,
            width: tile.width,
            height: tile.height,
            borderColor: theme.edge,
          }}
        >
          <div
            className={styles.fill}
            style={{
              background: tile.severity === CRITICAL ? theme.critical : theme.warning,
              opacity: fillStrength(tile.pressure),
            }}
          />
        </div>
      ))}
    </div>
  );
};

const styles = {
  board: css({
    position: 'relative',
    overflow: 'hidden',
  }),
  tile: css({
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    textAlign: 'center',
    borderStyle: 'solid',
    borderWidth: 1,
    // Position and size slide; colour does not, because a problem turning
    // critical should show at once rather than fade in.
    transitionProperty: 'left, top, width, height',
    transitionTimingFunction: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
  }),
  departing: css({
    // On its way out, so it must never swallow a click meant for what is behind.
    pointerEvents: 'none',
    transitionProperty: 'none',
  }),
  fill: css({
    position: 'absolute',
    inset: 0,
  }),
  text: css({
    position: 'relative',
    maxWidth: '100%',
    padding: '0 4%',
  }),
  name: css({
    maxWidth: '100%',
    overflow: 'hidden',
    textTransform: 'uppercase',
    letterSpacing: '-0.01em',
    lineHeight: 1.05,
    whiteSpace: 'nowrap',
  }),
  label: css({
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    textIndent: '0.16em',
    lineHeight: 1.6,
    opacity: 0.75,
  }),
};
