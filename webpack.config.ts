import type { Configuration } from 'webpack';
import CopyWebpackPlugin from 'copy-webpack-plugin';

import grafanaConfig, { type Env } from './.config/webpack/webpack.config';

/**
 * Extends the scaffold's webpack config, as plugin-tools documents, rather than
 * editing `.config/`, which `create-plugin update` regenerates.
 *
 * The one addition: ship `THIRD_PARTY_NOTICES.md` in the plugin package. The
 * package embeds a typeface, a treemap library and the DVD logo, and each of
 * those has to be credited in the thing that is distributed, not only in the
 * repository. The scaffold copies `LICENSE` but nothing else of the kind.
 */
const config = async (env: Env): Promise<Configuration> => {
  const base = await grafanaConfig(env);

  return {
    ...base,
    plugins: [
      ...(base.plugins ?? []),
      new CopyWebpackPlugin({ patterns: [{ from: '../THIRD_PARTY_NOTICES.md', to: '.' }] }),
    ],
  };
};

export default config;
