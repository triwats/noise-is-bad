import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';

import { render, screen } from '@testing-library/react';

import {
  LOCKUP_ASPECT,
  MARK_PATH,
  NibLockup,
  StaticMark,
  WORDMARK,
  ensureBrandFont,
  lockupSize,
  stackLines,
} from './brand';
import { BRAND_FONT_FAMILY, BRAND_FONT_WOFF2, LOCKUP_VIEW_BOX, NIB_CELLS } from './brandData';

const row = (y: number) => NIB_CELLS.slice(y * 8, y * 8 + 8);
const column = (x: number) => [0, 1, 2, 3, 4, 5, 6, 7].map((y) => NIB_CELLS[y * 8 + x]);
const lit = (cells: readonly number[]) => cells.filter(Boolean).length;

describe('the static pattern', () => {
  it('is 8 by 8 with exactly half lit, which is what reads as even static', () => {
    expect(NIB_CELLS).toHaveLength(64);
    expect(lit(NIB_CELLS)).toBe(32);
  });

  it('has no empty row, column or quadrant, so it never reads as a shape', () => {
    for (let i = 0; i < 8; i++) {
      expect(lit(row(i))).toBeGreaterThan(0);
      expect(lit(column(i))).toBeGreaterThan(0);
    }
    for (const [ox, oy] of [
      [0, 0],
      [4, 0],
      [0, 4],
      [4, 4],
    ]) {
      let count = 0;
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          count += NIB_CELLS[(oy + y) * 8 + ox + x];
        }
      }
      expect(count).toBeGreaterThan(0);
    }
  });

  it('draws one square per lit cell', () => {
    expect(MARK_PATH.match(/M/g)).toHaveLength(32);
  });

  it('is the same pattern the Grafana plugin logo shows', () => {
    // The logo is a generated file. If someone regenerates one and not the
    // other, the panel and the plugin list would show two different marks.
    const logo = readFileSync(join(__dirname, '../img/logo.svg'), 'utf8');
    const cells = [...logo.matchAll(/<rect x="(\d)" y="(\d)" width="1" height="1"\/>/g)].map(
      ([, x, y]) => Number(y) * 8 + Number(x)
    );

    expect(cells.sort((a, b) => a - b)).toEqual(NIB_CELLS.flatMap((on, i) => (on ? [i] : [])).sort((a, b) => a - b));
  });
});

describe('StaticMark', () => {
  it('paints in the current colour, so each surface chooses its own', () => {
    render(<StaticMark size={64} />);

    expect(screen.getByTestId('static-mark').querySelector('path')).toHaveAttribute('fill', 'currentColor');
  });
});

describe('NibLockup', () => {
  it('reads as the wordmark to anyone who cannot see it', () => {
    render(<NibLockup width={320} height={100} />);

    expect(screen.getByRole('img', { name: WORDMARK })).toBeInTheDocument();
  });

  it('declares an aspect ratio that matches its own drawing', () => {
    const [, , w, h] = LOCKUP_VIEW_BOX.split(' ').map(Number);

    expect(LOCKUP_ASPECT).toBeCloseTo(w / h, 4);
  });

  it('paints every part in the current colour', () => {
    render(<NibLockup width={320} height={100} />);

    screen
      .getByTestId('nib-lockup')
      .querySelectorAll('path')
      .forEach((path) => expect(path).toHaveAttribute('fill', 'currentColor'));
  });
});

describe('stackLines', () => {
  it('breaks the wordmark exactly where the lockup does', () => {
    expect(stackLines('noise is bad.')).toEqual(['noise', 'is bad.']);
  });

  it('breaks at the space nearest the middle', () => {
    expect(stackLines('platform team')).toEqual(['platform', 'team']);
    expect(stackLines('we are so back')).toEqual(['we are', 'so back']);
  });

  it('leaves a single word alone', () => {
    expect(stackLines('checkout')).toEqual(['checkout']);
  });

  it('respects line breaks someone typed on purpose', () => {
    expect(stackLines('one\ntwo three')).toEqual(['one', 'two three']);
  });
});

describe('lockupSize', () => {
  it('never underestimates the real width, which would spill the lockup', () => {
    // Real advances, shaped with HarfBuzz against Archivo Black at the lockup's
    // tracking, in ems. Guessing high only makes the lockup slightly smaller.
    const measured: Array<[string, number]> = [
      ['noise', 2.77],
      ['is bad.', 3.366],
      ['platform team', 7.283],
    ];

    for (const [text, width] of measured) {
      const estimate = lockupSize([text]);
      const words = estimate.width - estimate.mark - 36 / 76;
      expect(words).toBeGreaterThanOrEqual(width);
      expect(words).toBeLessThan(width * 1.25);
    }
  });

  it('grows the mark with the number of lines, so it always matches the text block', () => {
    expect(lockupSize(['a', 'b']).mark).toBeCloseTo(lockupSize(['a']).mark * 2, 5);
  });
});

describe('the embedded typeface', () => {
  it('is a WOFF2 carried inline, so a television needs no network to draw it', () => {
    expect(BRAND_FONT_WOFF2).toMatch(/^data:font\/woff2;base64,[A-Za-z0-9+/=]+$/);
  });

  it('ships with its licence, as the SIL Open Font License requires', () => {
    const licence = readFileSync(join(__dirname, 'fonts/OFL.txt'), 'utf8');

    expect(licence).toMatch(/SIL Open Font License/);
    expect(licence).toMatch(/Archivo Black/);
  });

  it('registers itself once, however many panels ask', () => {
    ensureBrandFont();
    ensureBrandFont();
    ensureBrandFont();

    // Emotion inserts rules through the CSSOM rather than as style-tag text,
    // so read them back the same way.
    const faces = [...document.styleSheets]
      .flatMap((sheet) => [...sheet.cssRules])
      .filter((rule) => rule.cssText.startsWith('@font-face') && rule.cssText.includes(BRAND_FONT_FAMILY));

    expect(faces).toHaveLength(1);
  });
});
