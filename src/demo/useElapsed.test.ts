import { act, renderHook } from '@testing-library/react';

import { useElapsed } from './useElapsed';

describe('useElapsed', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('stays at zero and starts no timer when stopped', () => {
    const { result } = renderHook(() => useElapsed(false));

    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    expect(result.current).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('counts up while running', () => {
    const { result } = renderHook(() => useElapsed(true, 250));

    act(() => {
      jest.advanceTimersByTime(1_000);
    });

    expect(result.current).toBeGreaterThanOrEqual(1_000);
  });

  it('stops its timer when removed', () => {
    const { unmount } = renderHook(() => useElapsed(true));
    expect(jest.getTimerCount()).toBe(1);

    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('stops and resets when it is turned off', () => {
    const { result, rerender } = renderHook(({ on }) => useElapsed(on), { initialProps: { on: true } });

    act(() => {
      jest.advanceTimersByTime(2_000);
    });
    expect(result.current).toBeGreaterThan(0);

    rerender({ on: false });
    expect(result.current).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });
});
