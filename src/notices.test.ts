import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The plugin package embeds a typeface, a treemap library and the DVD logo.
 * Each has to be credited in what is distributed, and the licence texts have to
 * be the real ones. `THIRD_PARTY_NOTICES.md` is written by hand, so this fails
 * the moment it drifts from the files it quotes.
 */
const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const notices = read('THIRD_PARTY_NOTICES.md');

describe('third-party notices', () => {
  it('carries the typeface licence word for word', () => {
    expect(notices).toContain(read('src/render/fonts/OFL.txt').trim());
  });

  it('carries the treemap library licence word for word, at the version installed', () => {
    const d3 = JSON.parse(read('node_modules/d3-hierarchy/package.json'));

    expect(notices).toContain(read('node_modules/d3-hierarchy/LICENSE').trim());
    expect(notices).toContain(`d3-hierarchy ${d3.version}`);
  });

  it('credits the DVD logo without claiming a licence to it', () => {
    expect(notices).toMatch(/trademark of DVD Format\/Logo Licensing Corporation/);
    expect(notices).toMatch(/no licence to the trademark is claimed/);
    expect(notices).toMatch(/bouncingdvdlogo\.com/);
  });

  it('is shipped inside the plugin package, not only kept in the repository', () => {
    expect(read('webpack.config.ts')).toMatch(/THIRD_PARTY_NOTICES\.md/);
    expect(read('package.json')).toMatch(/"build": "webpack -c \.\/webpack\.config\.ts/);
  });

  it('names every dependency bundled into the plugin', () => {
    // Everything in `dependencies` is either provided by Grafana at runtime or
    // bundled into module.js. Anything bundled must appear in the notices.
    // Type packages vanish at compile time, so there is nothing of theirs to credit.
    const providedByGrafana = /^(@grafana\/|@emotion\/|@types\/|react$|react-dom$|tslib$)/;
    const bundled = Object.keys(JSON.parse(read('package.json')).dependencies).filter(
      (name) => !providedByGrafana.test(name)
    );

    bundled.forEach((name) => expect(notices).toContain(name));
  });
});
