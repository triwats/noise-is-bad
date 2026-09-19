/**
 * The renderer's palette.
 *
 * Deliberately tiny, and deliberately not Grafana's. The panel maps
 * `GrafanaTheme2` onto this at the boundary, so everything under `src/render/`
 * stays portable to whatever noise is bad. runs inside next.
 */
export interface NoiseTheme {
  /**
   * The panel's own background.
   *
   * Every state paints this. The panel is never see-through, because a screen
   * across an office should read as one solid thing rather than as a widget
   * sitting on whatever Grafana happens to be showing behind it.
   */
  canvas: string;
  /** The mark, at full strength. */
  mark: string;
  /** Supporting text. */
  dim: string;
  /** Barely-there text. */
  faint: string;
  warning: string;
  critical: string;
  /** The hairline between tiles. */
  edge: string;
}

/**
 * How much smaller a warning renders than a critical.
 *
 * Applied after fitting, not by fitting to a smaller box. Fitting to a smaller
 * box only differs while height is the binding constraint, so with a long name
 * the two severities would quietly render identically. Scaling afterwards makes
 * the difference unconditional, and scaling the warning *down* rather than the
 * critical up means the fitted size is still the ceiling, so nothing overflows.
 */
export const WARNING_SCALE = 0.82;
