import { useEffect, useState } from 'react';

/**
 * The wall clock, re-read on an interval.
 *
 * Pressure rises with how long a problem has been going on, so the panel has to
 * re-render as time passes rather than only when Grafana refreshes. One second
 * is ample: the persistence bands step at thirty seconds, two minutes and five.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
