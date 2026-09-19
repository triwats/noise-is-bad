import { test, expect } from '@grafana/plugin-e2e';

// The per-state panels live on their own dashboard; the main one is the demo.
const dashboardFile = { fileName: 'states.json' };

test('reads how bad things are from a real query', async ({ gotoPanelEditPage, readProvisionedDashboard, page }) => {
  const dashboard = await readProvisionedDashboard(dashboardFile);
  await gotoPanelEditPage({ dashboard, id: '1' });

  // The query says shipping is critical, checkout is a warning, and the basket
  // and search are both fine.
  const problems = page.getByTestId('treemap');
  await expect(problems).toContainText('shipping');
  await expect(problems).toContainText('critical');
  await expect(problems).toContainText('checkout');
  await expect(problems).toContainText('warning');

  // Healthy services are never drawn.
  await expect(problems).not.toContainText('basket');
  await expect(problems).not.toContainText('search');
});

test('says it cannot read a query with no numbers', async ({ gotoPanelEditPage, readProvisionedDashboard, page }) => {
  const dashboard = await readProvisionedDashboard(dashboardFile);
  await gotoPanelEditPage({ dashboard, id: '2' });

  await expect(page.getByTestId('noise-panel-no-source')).toBeVisible();
  await expect(page.getByTestId('quiet-mode')).toBeHidden();
});

test('goes quiet when nothing is broken', async ({ gotoPanelEditPage, readProvisionedDashboard, page }) => {
  const dashboard = await readProvisionedDashboard(dashboardFile);
  await gotoPanelEditPage({ dashboard, id: '4' });

  await expect(page.getByTestId('quiet-mode')).toBeVisible();
  // The DVD logo is the default mark.
  await expect(page.getByTestId('dvd-mark')).toBeVisible();
});

test('offers our own logo instead of the DVD one', async ({ gotoPanelEditPage, readProvisionedDashboard, page }) => {
  const dashboard = await readProvisionedDashboard(dashboardFile);
  await gotoPanelEditPage({ dashboard, id: '9' });

  // Scoped to the mark: the panel editor's own radio carries similar labels.
  await expect(page.getByTestId('quiet-mark').getByRole('img', { name: 'noise is bad.' })).toBeVisible();
  await expect(page.getByTestId('dvd-mark')).toBeHidden();
});

test('moves the mark around the screen', async ({ gotoPanelEditPage, readProvisionedDashboard, page }) => {
  const dashboard = await readProvisionedDashboard(dashboardFile);
  await gotoPanelEditPage({ dashboard, id: '4' });

  // By the mark's test id, not its contents: this is about movement, whichever
  // mark the panel is configured to drift.
  const mark = page.getByTestId('quiet-mark');
  await expect(mark).toBeVisible();

  const first = (await mark.boundingBox())!;
  await page.waitForTimeout(1500);
  const second = (await mark.boundingBox())!;

  expect(Math.abs(second.x - first.x) + Math.abs(second.y - first.y)).toBeGreaterThan(5);
});

test('turns the 3D text instead of bouncing a mark', async ({ gotoPanelEditPage, readProvisionedDashboard, page }) => {
  const dashboard = await readProvisionedDashboard(dashboardFile);
  await gotoPanelEditPage({ dashboard, id: '10' });

  await expect(page.getByTestId('three-d-face')).toHaveText('noise is bad.');
  // Nothing bounces: this one turns in place.
  await expect(page.getByTestId('quiet-mark')).toBeHidden();

  const rotator = page.getByTestId('three-d-rotator');
  const before = await rotator.getAttribute('style');
  await page.waitForTimeout(1200);

  expect(await rotator.getAttribute('style')).not.toBe(before);
});

test('tumbles the 3D text on all three axes and keeps it on screen', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard(dashboardFile);
  await gotoPanelEditPage({ dashboard, id: '10' });
  await expect(page.getByTestId('three-d-rotator')).toBeVisible();

  const sample = () =>
    page.evaluate(() => {
      const rotator = document.querySelector<HTMLElement>('[data-testid="three-d-rotator"]')!;
      const stage = document.querySelector('[data-testid="three-d-text"]')!.getBoundingClientRect();
      const layers = [
        ...document.querySelectorAll(
          '[data-testid="three-d-wall"], [data-testid="three-d-front"], [data-testid="three-d-back"]'
        ),
      ];
      const box = layers
        .map((layer) => layer.getBoundingClientRect())
        .reduce(
          (all, r) => ({
            l: Math.min(all.l, r.left),
            r: Math.max(all.r, r.right),
            t: Math.min(all.t, r.top),
            b: Math.max(all.b, r.bottom),
          }),
          { l: Infinity, r: -Infinity, t: Infinity, b: -Infinity }
        );
      const angle = (axis: string) =>
        Number(new RegExp(`rotate${axis}\\((-?[\\d.]+)deg\\)`).exec(rotator.style.transform)?.[1]);
      return {
        angles: [angle('X'), angle('Y'), angle('Z')],
        // How far past the panel's edge the lockup reaches; negative is inside.
        spill: Math.max(stage.left - box.l, box.r - stage.right, stage.top - box.t, box.b - stage.bottom),
      };
    });

  const first = await sample();
  let worst = first.spill;
  let last = first;
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(250);
    last = await sample();
    worst = Math.max(worst, last.spill);
  }

  first.angles.forEach((angle, axis) => expect(last.angles[axis]).not.toBeCloseTo(angle, 0));
  expect(worst).toBeLessThanOrEqual(1);
});

test('renders the 3D text with real depth, not as a flat sign', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard(dashboardFile);
  await gotoPanelEditPage({ dashboard, id: '10' });
  await expect(page.getByTestId('three-d-rotator')).toBeVisible();

  // `overflow`, `opacity` below 1, `filter` and friends silently force
  // `transform-style: flat`, and the transform still reads correctly
  // afterwards. So the honest check is whether the nearest and farthest layers
  // project to different places at all, and only a real browser can tell us.
  //
  // Not "the near layer is wider": once the stack turns, that ratio falls on
  // either side of 1 depending on the angle, and this test used to pass or
  // fail on whichever angle it caught. Measured instead: a flattened stack puts
  // every layer in exactly the same place, 0px apart, while real depth never
  // came closer than 2.55px across twenty loads sampled through a full swing.
  const depth = await page.evaluate(() => {
    const rotator = document.querySelector('[data-testid="three-d-rotator"]')!;
    const walls = document.querySelectorAll('[data-testid="three-d-wall"]');
    const near = walls[0].getBoundingClientRect();
    const far = walls[walls.length - 1].getBoundingClientRect();

    return {
      style: getComputedStyle(rotator).transformStyle,
      apart: Math.max(
        Math.abs(near.left - far.left),
        Math.abs(near.top - far.top),
        Math.abs(near.width - far.width),
        Math.abs(near.height - far.height)
      ),
    };
  });

  expect(depth.style).toBe('preserve-3d');
  expect(depth.apart).toBeGreaterThan(1);
});

test('gives one broken service the whole screen', async ({ gotoPanelEditPage, readProvisionedDashboard, page }) => {
  const dashboard = await readProvisionedDashboard(dashboardFile);
  const panelEditPage = await gotoPanelEditPage({ dashboard, id: '5' });

  const incident = page.getByTestId('single-incident');
  await expect(incident).toBeVisible();
  await expect(incident).toContainText('shipping');
  await expect(incident).toHaveAttribute('data-severity', 'critical');

  // Nothing but the name and the severity, per Epic 5.
  await expect(incident).toHaveText(/^shippingcritical$/);

  // And it really does fill the panel rather than sitting in a corner of it.
  const panel = (await panelEditPage.panel.locator.boundingBox())!;
  const taken = (await incident.boundingBox())!;
  expect(taken.width).toBeGreaterThan(panel.width * 0.8);
});

test('leaves quiet mode as things get worse', async ({ gotoPanelEditPage, readProvisionedDashboard, page }) => {
  const dashboard = await readProvisionedDashboard(dashboardFile);
  await gotoPanelEditPage({ dashboard, id: '3' });

  // growing-incident: quiet, then one problem, then several.
  await expect(page.getByTestId('single-incident')).toContainText('shipping', { timeout: 12_000 });
  await expect(page.getByTestId('treemap')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('quiet-mode')).toBeHidden();
});

test('splits the screen between services, by how bad each is', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard(dashboardFile);
  await gotoPanelEditPage({ dashboard, id: '6' });

  await expect(page.getByTestId('treemap-tile')).toHaveCount(4);

  const areaOf = async (name: string) => {
    const box = (await page.locator(`[data-name="${name}"]`).boundingBox())!;
    return box.width * box.height;
  };

  // Shipping has burned the most budget; orders the least.
  expect(await areaOf('shipping')).toBeGreaterThan(await areaOf('orders'));

  // And the half of the shop with nothing wrong with it is not drawn at all.
  await expect(page.locator('[data-name="search"]')).toHaveCount(0);
  await expect(page.locator('[data-name="reviews"]')).toHaveCount(0);
});

test('shares out the space again when another service breaks', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard(dashboardFile);
  await gotoPanelEditPage({ dashboard, id: '3' });

  test.setTimeout(120_000);

  const tiles = page.getByTestId('treemap-tile');
  const panel = (await page.getByTestId('treemap').boundingBox())!;
  const boardArea = panel.width * panel.height;

  const covered = async () => {
    const areas = await tiles.evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return r.width * r.height;
      })
    );
    return areas.reduce((total, a) => total + a, 0);
  };

  // Note what is deliberately not asserted here: that the first service's box
  // shrinks when a second breaks. In this scenario the first one is getting
  // worse at the same time, so it can fairly keep its space. What must always
  // hold is that the services share out the whole board between them rather
  // than stacking up or leaving it half empty.
  await expect(tiles).toHaveCount(2, { timeout: 60_000 });
  const started = await tiles.count();
  // Polled, not read once: the new tile animates in, so the moment it appears
  // it does not cover its share yet. Under a loaded test run a single read
  // lands mid-transition and fails for no reason the panel is responsible for.
  await expect(async () => {
    expect(await covered()).toBeGreaterThan(boardArea * 0.9);
  }).toPass({ timeout: 10_000 });

  await expect(async () => {
    expect(await tiles.count()).toBeGreaterThan(started);
  }).toPass({ timeout: 60_000 });

  // The same transition again, for the tile that just arrived.
  await expect(async () => {
    const area = await covered();
    expect(area).toBeGreaterThan(boardArea * 0.9);
    expect(area).toBeLessThanOrEqual(boardArea * 1.05);
  }).toPass({ timeout: 10_000 });
});

test('goes quiet again once everything is fixed', async ({ gotoPanelEditPage, readProvisionedDashboard, page }) => {
  const dashboard = await readProvisionedDashboard(dashboardFile);
  await gotoPanelEditPage({ dashboard, id: '7' });

  // The recovery scenario clears one problem at a time over fifteen seconds,
  // and hysteresis holds each one for two refreshes after it reads healthy.
  await expect(page.getByTestId('treemap-tile')).toHaveCount(3, { timeout: 25_000 });
  await expect(page.getByTestId('quiet-mode')).toBeVisible({ timeout: 30_000 });
});

test('a flickering service does not make the screen flash', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard(dashboardFile);
  await gotoPanelEditPage({ dashboard, id: '8' });

  // Chaos changes the services every 1.5 seconds. Check far more often than that
  // and count how many times what is on screen actually changes.
  //
  // Only the live boxes count. A box on its way out also carries a name, and
  // counting those would make an animated departure look like extra churn.
  const seen: string[] = [];
  for (let i = 0; i < 40; i++) {
    const names = await page.getByTestId('treemap-tile').evaluateAll((nodes) =>
      nodes
        .map((n) => (n as HTMLElement).dataset.name)
        .sort()
        .join(',')
    );
    if (seen[seen.length - 1] !== names) {
      seen.push(names);
    }
    await page.waitForTimeout(250);
  }

  // Ten seconds of chaos is six or seven changes of the underlying metric.
  // Hysteresis should leave the display calmer than that, and never blank.
  expect(seen.length).toBeLessThan(10);
  expect(seen.filter((s) => s === '').length).toBeLessThanOrEqual(1);
});

test('the demo dashboard shows the whole story on one panel', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  // The story runs 84 seconds, well past Playwright's default budget.
  test.setTimeout(320_000);

  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  await gotoDashboardPage(dashboard);

  // It opens quiet, takes the screen with one problem, then breaks up.
  await expect(page.getByTestId('quiet-mode')).toBeVisible({ timeout: 160_000 });

  // The shipping API goes first, on its own.
  await expect(page.getByTestId('single-incident')).toContainText('shipping', { timeout: 160_000 });

  // Then the services behind it follow, without the whole shop going down.
  await expect(async () => {
    const count = await page.getByTestId('treemap-tile').count();
    expect(count).toBeGreaterThanOrEqual(3);
    expect(count).toBeLessThanOrEqual(4);
  }).toPass({ timeout: 120_000 });

  // Search never appears, because nothing is wrong with it.
  await expect(page.locator('[data-name="search"]')).toHaveCount(0);

  // Then it collapses all the way back to silence.
  await expect(page.getByTestId('quiet-mode')).toBeVisible({ timeout: 160_000 });
});

test('reads a real Prometheus metric from the pretend estate', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  // Prometheus has to scrape before anything arrives, and the estate runs a
  // script, so which of the three states shows depends on when we look.
  test.setTimeout(120_000);

  const dashboard = await readProvisionedDashboard({ fileName: 'prometheus.json' });
  await gotoDashboardPage(dashboard);

  await expect(async () => {
    const drawn =
      (await page.getByTestId('treemap-tile').count()) +
      (await page.getByTestId('single-incident').count()) +
      (await page.getByTestId('quiet-mode').count());
    expect(drawn).toBeGreaterThan(0);
  }).toPass({ timeout: 60_000 });

  // Whatever it is showing, it is not the "nothing to read" message.
  await expect(page.getByTestId('noise-panel-no-source')).toBeHidden();
});

test('reads Sloth-shaped recording rules, named from a label', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  // The estate has to burn some budget before anything appears.
  test.setTimeout(180_000);

  const dashboard = await readProvisionedDashboard({ fileName: 'sloth.json' });
  await gotoDashboardPage(dashboard);

  // No legend format is set on that query, so a readable name here means the
  // panel took it from the sloth_service label.
  await expect(async () => {
    const names = await page
      .getByTestId('treemap-tile')
      .evaluateAll((tiles) => tiles.map((t) => (t as HTMLElement).dataset.name));
    const single = await page.getByTestId('single-incident').count();

    expect(names.length + single).toBeGreaterThan(0);
    for (const name of names) {
      expect(name).toMatch(/^[a-z-]+$/);
    }
  }).toPass({ timeout: 120_000 });

  await expect(page.getByTestId('noise-panel-no-source')).toBeHidden();
});

test('the four appear-and-disappear styles are actually different', async ({
  gotoDashboardPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'transitions.json' });
  await gotoDashboardPage(dashboard);

  // This exists because the styles once all looked identical: the setting was
  // never passed from the panel to the drawing code, and every board quietly
  // used the default.
  await expect(async () => {
    const classes = await page
      .getByTestId('treemap')
      .evaluateAll((boards) =>
        boards.map((board) => board.querySelector('[data-testid="treemap-tile"]')?.className ?? '')
      );

    expect(classes.filter(Boolean)).toHaveLength(4);
    expect(new Set(classes).size).toBe(4);
  }).toPass({ timeout: 60_000 });
});

test('caps the boxes on screen and says how many more there are', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
  page,
}) => {
  const dashboard = await readProvisionedDashboard(dashboardFile);
  await gotoPanelEditPage({ dashboard, id: '11' });

  // thirty broken services, room for twelve boxes: eleven named and one for the rest.
  await expect(page.getByTestId('treemap-tile')).toHaveCount(12);

  const rest = page.locator('[data-overflow]');
  await expect(rest).toHaveCount(1);
  await expect(rest).toHaveAttribute('data-overflow', '19');
  await expect(rest).toContainText('+19 more');

  // the worst service keeps its own box; one of the mildest is inside the rest.
  await expect(page.locator('[data-name="shipping"]')).toHaveCount(1);
  await expect(page.locator('[data-name="alerts"]')).toHaveCount(0);
});
