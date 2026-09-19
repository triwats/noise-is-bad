import React, { useMemo, useState } from 'react';

import { PanelProps } from '@grafana/data';
import { css } from '@emotion/css';
import { useTheme2 } from '@grafana/ui';

import { DEFAULT_ADAPTER, toSignals } from './adapter/signalAdapter';
import { scenarioById, signalsAt } from './demo/scenarios';
import { useElapsed } from './demo/useElapsed';
import { toNoiseTheme } from './grafanaTheme';
import { EngineState, emptyState, getItems, update } from './noise/state';
import { NoiseSignal } from './noise/types';
import { QuietMode } from './render/QuietMode';
import { SingleIncident } from './render/SingleIncident';
import { Treemap } from './render/Treemap';
import { DEFAULT_QUIET_MARK, DEFAULT_SPIN, NoiseOptions } from './types';
import { useNow } from './useNow';

type Props = PanelProps<NoiseOptions>;

/**
 * How often a demo counts as a new check of the data.
 *
 * Demo time moves every 250ms so the example runs smoothly, but that is not a
 * refresh. Treating every tick as one would make two healthy checks half a
 * second apart, and the wait-before-clearing rule would do nothing you could
 * see.
 *
 * Two and a half seconds, so that two checks span five. A real dashboard
 * refreshes every five to thirty seconds, which makes its wait-before-clearing
 * window far wider still. At one second the rule was too weak to stop a service
 * flicking on and off from briefly emptying the screen, which is the exact
 * thing it exists to prevent.
 */
const DEMO_REFRESH_MS = 2500;

interface Tracker {
  /** Where the data came from. Changing source starts again from scratch. */
  source: string;
  /** Changes once per refresh, so we know when to add a new check. */
  lastCheck: unknown;
  engine: EngineState;
}

/**
 * The panel itself.
 *
 * Chooses where the data comes from, adds each refresh to what we already know,
 * and hands the result to the drawing code. It does no drawing of its own.
 *
 * There are three cases here, not two. "This query has nothing we can read" is
 * not the same as "everything is fine", and only the second one should make the
 * screen go quiet. A screen that falls silent because its query broke is worse
 * than one that admits it cannot see.
 */
export const NoisePanel: React.FC<Props> = ({ data, width, height, options }) => {
  const grafanaTheme = useTheme2();
  const theme = toNoiseTheme(grafanaTheme);
  const now = useNow();

  const scenario = scenarioById(options?.demoScenario ?? '');
  const elapsed = useElapsed(Boolean(scenario));
  // Only the settings the adapter actually reads, so a change to an unrelated
  // option does not make it do the work again.
  const reading = useMemo(
    () => ({
      // Every fallback comes from DEFAULT_ADAPTER, never from numbers repeated
      // here. A second copy of the defaults drifted once, and an unconfigured
      // panel read a 90% availability as healthy: a calm screen during an
      // outage, which is the worst thing this panel can do.
      nameField: options?.nameField ?? DEFAULT_ADAPTER.nameField,
      valueField: options?.valueField ?? DEFAULT_ADAPTER.valueField,
      reducer: options?.reducer ?? DEFAULT_ADAPTER.reducer,
      direction: options?.direction ?? DEFAULT_ADAPTER.direction,
      warning: options?.warning ?? DEFAULT_ADAPTER.warning,
      critical: options?.critical ?? DEFAULT_ADAPTER.critical,
    }),
    [options?.nameField, options?.valueField, options?.reducer, options?.direction, options?.warning, options?.critical]
  );
  const live = useMemo(() => toSignals(data.series, reading), [data.series, reading]);

  const signals: NoiseSignal[] | null = scenario ? signalsAt(scenario, elapsed) : live.readable ? live.signals : null;

  const source = scenario?.id ?? 'live';
  const check = scenario ? Math.floor(elapsed / DEMO_REFRESH_MS) : data.series;

  // Updating during render, rather than in an effect, is React's own way of
  // reacting to changed input. It also keeps things in step: the screen never
  // shows the previous refresh's layout for a frame.
  const [tracker, setTracker] = useState<Tracker>({ source, lastCheck: null, engine: emptyState });
  if (signals && (tracker.source !== source || tracker.lastCheck !== check)) {
    setTracker({
      source,
      lastCheck: check,
      // Use `now` rather than reading the clock here, because rendering has to
      // stay side-effect free. Being up to a second early does not matter when
      // the age bands are thirty seconds apart.
      engine: update(tracker.source === source ? tracker.engine : emptyState, signals, now),
    });
  }

  if (!signals) {
    return <NoSource width={width} height={height} colour={theme.dim} canvas={theme.canvas} />;
  }

  const problems = getItems(tracker.engine, now, options?.usePersistence ?? true);

  if (problems.length === 0 && (options?.quietMode ?? true)) {
    return (
      <QuietMode
        width={width}
        height={height}
        theme={theme}
        mark={options?.quietMark ?? DEFAULT_QUIET_MARK}
        text={options?.spinText}
        threeD={{
          size: (options?.spinSize ?? DEFAULT_SPIN.size) / 100,
          depth: options?.spinDepth ?? DEFAULT_SPIN.depth,
          speed: options?.spinSpeed ?? DEFAULT_SPIN.speed,
          material: options?.spinMaterial ?? DEFAULT_SPIN.material,
          // Grafana's picker stores names like "green" as well as hex; only
          // Grafana can turn those into a colour, so it happens here.
          colour: grafanaTheme.visualization.getColorByName(options?.spinColour ?? DEFAULT_SPIN.colour),
        }}
      />
    );
  }

  // A lone incident is not a tile in a grid. It is the whole screen.
  if (problems.length === 1) {
    return <SingleIncident signal={problems[0]} width={width} height={height} theme={theme} />;
  }

  return (
    <Treemap
      problems={problems}
      width={width}
      height={height}
      theme={theme}
      transitionMs={options?.transitionMs}
      transitionStyle={options?.transitionStyle}
      maxBoxes={options?.maxBoxes}
    />
  );
};

/** Shown when the query has nothing this panel can read. */
const NoSource: React.FC<{ width: number; height: number; colour: string; canvas: string }> = ({
  width,
  height,
  colour,
  canvas,
}) => {
  const size = Math.max(10, Math.min(width, height) * 0.05);

  return (
    <div
      className={noSource}
      style={{ width, height, fontSize: size, color: colour, background: canvas }}
      data-testid="noise-panel-no-source"
    >
      <span>nothing to read</span>
      <span className={hint}>query a numeric field, or pick a demo scenario</span>
    </div>
  );
};

const noSource = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.8em',
  textAlign: 'center',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  overflow: 'hidden',
});

const hint = css({
  fontSize: '0.6em',
  opacity: 0.7,
});
