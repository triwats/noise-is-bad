import { GrafanaTheme2 } from '@grafana/data';

import { NoiseTheme } from './render/theme';

/**
 * The boundary between Grafana's theme and the renderer's.
 *
 * Everything under `src/render/` takes a `NoiseTheme`, so this is the only
 * place the two vocabularies meet.
 */
export const toNoiseTheme = (theme: GrafanaTheme2): NoiseTheme => ({
  canvas: theme.colors.background.canvas,
  mark: theme.colors.text.maxContrast,
  dim: theme.colors.text.secondary,
  faint: theme.colors.text.disabled,
  warning: theme.colors.warning.text,
  critical: theme.colors.error.text,
  edge: theme.colors.border.weak,
});
