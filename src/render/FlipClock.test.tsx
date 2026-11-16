import React from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { FlipClock } from './FlipClock';
import { fitCards } from './flip';

/** Local time, so the cards read the same whatever zone the tests run in. */
const at = (hours: number, minutes: number, seconds = 0) => new Date(2026, 8, 20, hours, minutes, seconds);

const card = (kind: 'hours' | 'minutes') => screen.getByTestId('flip-clock').querySelector(`[data-card="${kind}"]`)!;
const reads = (kind: 'hours' | 'minutes') => card(kind).getAttribute('data-value');
const flipping = (kind: 'hours' | 'minutes') => card(kind).hasAttribute('data-flipping');

/** Ends every running leaf animation, as the browser would after the flip. */
const settle = () => {
  screen.queryAllByTestId('flip-leaf').forEach((leaf) => fireEvent.animationEnd(leaf));
};

const draw = () => render(<FlipClock width={800} height={600} />);

describe('FlipClock', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows the time it was mounted at, without flipping', () => {
    jest.setSystemTime(at(14, 8, 30));
    draw();

    expect(reads('hours')).toBe('14');
    expect(reads('minutes')).toBe('08');
    expect(flipping('hours')).toBe(false);
    expect(flipping('minutes')).toBe(false);
    expect(screen.queryAllByTestId('flip-leaf')).toHaveLength(0);
  });

  it('flips the minutes card when the minute ticks over, and only that one', () => {
    jest.setSystemTime(at(14, 8, 59));
    draw();

    act(() => jest.advanceTimersByTime(1_100));

    expect(flipping('minutes')).toBe(true);
    expect(flipping('hours')).toBe(false);
    // Still reads the old minute until the leaf has landed.
    expect(reads('minutes')).toBe('08');
    expect(screen.getAllByTestId('flip-leaf')).toHaveLength(2);
  });

  it('commits the new minute once the leaf has landed', () => {
    jest.setSystemTime(at(14, 8, 59));
    draw();

    act(() => jest.advanceTimersByTime(1_100));
    settle();

    expect(reads('minutes')).toBe('09');
    expect(flipping('minutes')).toBe(false);
    expect(screen.queryAllByTestId('flip-leaf')).toHaveLength(0);
  });

  it('flips both cards on the hour', () => {
    jest.setSystemTime(at(14, 59, 59));
    draw();

    act(() => jest.advanceTimersByTime(1_100));

    expect(flipping('hours')).toBe(true);
    expect(flipping('minutes')).toBe(true);
    settle();
    expect(reads('hours')).toBe('15');
    expect(reads('minutes')).toBe('00');
  });

  it('does nothing between minutes', () => {
    jest.setSystemTime(at(14, 8, 0));
    draw();

    act(() => jest.advanceTimersByTime(59_000));

    expect(flipping('minutes')).toBe(false);
    expect(reads('minutes')).toBe('08');
  });

  it('keeps time across many minutes', () => {
    jest.setSystemTime(at(14, 8, 0));
    draw();

    for (let i = 0; i < 5; i++) {
      act(() => jest.advanceTimersByTime(60_100));
      settle();
    }

    expect(reads('minutes')).toBe('13');
  });

  it('wakes from a long sleep to one flip at the real time, not sixty', () => {
    jest.setSystemTime(at(14, 8, 30));
    draw();

    // The timer was armed for 14:09, but the television slept until 15:20.
    jest.setSystemTime(at(15, 20, 5));
    act(() => jest.advanceTimersByTime(30_100));

    expect(screen.getAllByTestId('flip-leaf')).toHaveLength(4);
    settle();
    expect(reads('hours')).toBe('15');
    expect(reads('minutes')).toBe('20');
  });

  it('stops its timer on unmount', () => {
    jest.setSystemTime(at(14, 8, 0));
    const { unmount } = draw();
    unmount();

    expect(jest.getTimerCount()).toBe(0);
  });

  it('sizes the cards to the panel and refits on resize', () => {
    jest.setSystemTime(at(14, 8, 0));
    const { rerender } = draw();

    expect(card('hours')).toHaveStyle({ width: `${fitCards(800, 600).card}px` });

    rerender(<FlipClock width={1600} height={1200} />);

    expect(card('hours')).toHaveStyle({ width: `${fitCards(1600, 1200).card}px` });
  });

  it('sits in a black void', () => {
    jest.setSystemTime(at(14, 8, 0));
    draw();

    expect(screen.getByTestId('flip-clock')).toHaveStyle({ background: '#000000' });
  });
});
