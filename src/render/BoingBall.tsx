import React, { useEffect, useMemo, useRef } from 'react';

import { css } from '@emotion/css';

import {
  BOING_GRID,
  BOING_RED,
  BOING_ROOM,
  BOING_SHADOW,
  BOING_WHITE,
  MAX_FRAME_PX,
  Room,
  SHEET_COLUMNS,
  SPIN_FRAMES,
  ballAt,
  facetsAt,
  frameOf,
  gridOf,
  roomOf,
  spinOfFrame,
} from './boing';

interface Props {
  width: number;
  height: number;
}

/** The shadow sits this far right of the ball, in radii, cast onto the wall. */
const SHADOW_OFFSET = 0.42;

/**
 * The Boing ball mark: the 1984 Amiga demo. A red and white checkered ball,
 * spinning on a tilted axis, bouncing across a grey room in front of a purple
 * grid, its shadow on the wall behind. The grid is what lets the spin read.
 *
 * Built for an older Raspberry Pi behind the television, so nothing is drawn
 * while it runs. The grid is a static SVG, painted when the panel is sized and
 * never again. The ball's pattern repeats every two segments of spin, so all
 * `SPIN_FRAMES` pictures it can ever show are drawn once into a sprite sheet;
 * the ball is a window onto that sheet. Each frame then only moves things:
 * the window, the shadow, and — when the spin crosses into the next picture —
 * the sheet inside the window. Those are transforms, which the compositor
 * handles without repainting a pixel. That is the colour-cycling trick the
 * original played on the Amiga, done with a GPU instead of a palette.
 *
 * Motion is closed-form in `boing.ts`, so the loop keeps no state of its own
 * beyond the start time.
 */
export const BoingBall: React.FC<Props> = ({ width, height }) => {
  const room = useMemo(() => roomOf(width, height), [width, height]);
  const roomRef = useRef<Room>(room);
  const ballRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(-1);

  const size = room.radius * 2;

  // The sprite sheet: drawn when the ball changes size, which is on resize only.
  useEffect(() => {
    roomRef.current = room;
    frameRef.current = -1;
    drawSheet(canvasRef.current, size);
  }, [room, size]);

  useEffect(() => {
    const ball = ballRef.current;
    const sheet = sheetRef.current;
    const shadow = shadowRef.current;
    if (!ball || !sheet || !shadow) {
      return;
    }

    let frame = 0;
    let start = 0;

    const tick = (now: number) => {
      start = start || now;
      const r = roomRef.current;
      const at = ballAt(now - start, r);
      const left = at.x - r.radius;
      const top = at.y - r.radius;

      ball.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      shadow.style.transform = `translate3d(${left + r.radius * SHADOW_OFFSET}px, ${top}px, 0)`;

      // Move the sheet only when the picture changes, not every frame.
      const picture = frameOf(at.spin);
      if (picture !== frameRef.current) {
        frameRef.current = picture;
        const d = r.radius * 2;
        const column = picture % SHEET_COLUMNS;
        const row = Math.floor(picture / SHEET_COLUMNS);
        sheet.style.transform = `translate3d(${-column * d}px, ${-row * d}px, 0)`;
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const grid = useMemo(() => gridOf(room), [room]);

  return (
    <div className={styles.stage} style={{ width, height, background: BOING_ROOM }} data-testid="boing">
      <svg className={styles.layer} width={width} height={height} aria-hidden>
        <g stroke={BOING_GRID} strokeWidth={Math.max(1, room.cell / 24)} shapeRendering="crispEdges">
          {grid.map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
          ))}
        </g>
      </svg>
      <div
        ref={shadowRef}
        className={styles.moving}
        style={{ width: size, height: size, borderRadius: '50%', background: BOING_SHADOW }}
        data-testid="boing-shadow"
      />
      <div
        ref={ballRef}
        className={styles.moving}
        style={{ width: size, height: size, overflow: 'hidden' }}
        data-testid="boing-ball"
      >
        {/* The canvas is moved by a wrapper, never directly: Chromium repaints a
            canvas whose own transform changes, but not one carried by a layer. */}
        <div ref={sheetRef} className={styles.sheet} data-testid="boing-sheet">
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            style={{ width: size * SHEET_COLUMNS, height: size * SHEET_COLUMNS }}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Draws every spin picture into one canvas, four by four. Resolution follows
 * the screen up to `MAX_FRAME_PX` a frame, so the sheet never exceeds what an
 * older Pi's GPU can hold as one texture.
 */
function drawSheet(canvas: HTMLCanvasElement | null, size: number) {
  const ratio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const px = Math.max(1, Math.min(MAX_FRAME_PX, Math.round(size * ratio)));
  const context = canvas?.getContext('2d');
  if (!canvas || !context) {
    return;
  }

  canvas.width = px * SHEET_COLUMNS;
  canvas.height = px * SHEET_COLUMNS;
  context.clearRect(0, 0, canvas.width, canvas.height);

  const r = px / 2;
  for (let picture = 0; picture < SPIN_FRAMES; picture++) {
    const cx = (picture % SHEET_COLUMNS) * px + r;
    const cy = Math.floor(picture / SHEET_COLUMNS) * px + r;

    context.save();
    // Clip to the disc a hair inside the frame, so no facet edge bleeds into
    // the neighbouring picture.
    context.beginPath();
    context.arc(cx, cy, r - 0.5, 0, Math.PI * 2);
    context.clip();

    for (const facet of facetsAt(spinOfFrame(picture))) {
      context.beginPath();
      facet.points.forEach(([x, y], i) =>
        i === 0 ? context.moveTo(cx + x * r, cy + y * r) : context.lineTo(cx + x * r, cy + y * r)
      );
      context.closePath();
      context.fillStyle = facet.red ? BOING_RED : BOING_WHITE;
      context.fill();
      // A stroke in the same colour closes the hairline seams antialiasing
      // leaves between neighbouring facets.
      context.strokeStyle = context.fillStyle;
      context.lineWidth = 1;
      context.stroke();
    }

    context.restore();
  }
}

const styles = {
  stage: css({
    position: 'relative',
    overflow: 'hidden',
  }),
  layer: css({
    position: 'absolute',
    top: 0,
    left: 0,
  }),
  moving: css({
    position: 'absolute',
    top: 0,
    left: 0,
    willChange: 'transform',
  }),
  sheet: css({
    willChange: 'transform',
  }),
  canvas: css({
    display: 'block',
  }),
};
