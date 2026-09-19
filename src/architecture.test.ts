import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * The one rule the plan asks us to keep: the State Engine, Layout Engine and
 * Renderer must not depend on Grafana, so the interesting parts of noise is bad.
 * can outlive the plugin. Only the Signal Adapter and the panel shell may.
 *
 * This fails the moment someone reaches for `@grafana/*` on the wrong side of
 * that line, which is cheaper than noticing it in review a month later.
 */
const GRAFANA_FREE = ['noise', 'demo', 'render'];

const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });

describe('keeping Grafana out of the reusable code', () => {
  it.each(GRAFANA_FREE)('src/%s does not import Grafana', (area) => {
    const dir = join(__dirname, area);
    const files = filesUnder(dir).filter((f) => /\.tsx?$/.test(f));

    expect(files.length).toBeGreaterThan(0);

    const offenders = files.filter((file) => /from\s+'@grafana\//.test(readFileSync(file, 'utf8')));

    expect(offenders.map((f) => f.replace(`${__dirname}/`, 'src/'))).toEqual([]);
  });
});
