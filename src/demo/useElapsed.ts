import { useEffect, useState } from 'react';

/**
 * Milliseconds since the hook started, ticking at `intervalMs`.
 *
 * Starts no timer at all when `running` is false, and reports zero by deriving
 * it from `running` rather than by resetting state in an effect. The start time
 * lives in the effect's closure, so there is no ref to read during render. The
 * interval is cleared on unmount and whenever `running` flips, which is the
 * same discipline quiet mode's animation will need in Epic 4.
 *
 * Switching between scenarios leaves `running` true, so the clock deliberately
 * keeps running rather than jumping back to the start of the script.
 */
export function useElapsed(running: boolean, intervalMs = 250): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) {
      return;
    }

    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), intervalMs);
    return () => clearInterval(timer);
  }, [running, intervalMs]);

  return running ? elapsed : 0;
}
