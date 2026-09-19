'use strict';

/**
 * A pretend estate, for the Noise Is Bad demo (NIB-014).
 *
 * Serves Prometheus metrics saying how each service is doing, and a small web
 * page for breaking things by hand. No dependencies, so the image is just Node
 * and this file.
 *
 * It publishes the SLO shapes a real user would have, so the demo shows the
 * same thing they would wire up:
 *
 *   demo_availability_ratio               1 downwards, lower is worse (the default)
 *   demo_error_budget_burned_percent      0 upwards, higher is worse
 *   demo_error_budget_remaining_percent   100 downwards, lower is worse
 *   demo_burn_rate                        multiple of the budgeted pace
 *   demo_service_health                   0, 1 or 2, for the simplest case
 *
 * It also publishes the same numbers under the names Sloth's recording rules
 * use, so the panel can be pointed at a real SLO generator's output without
 * anybody having to install one first.
 *
 *   GET /metrics            the numbers, for Prometheus
 *   GET /                   a page with buttons
 *   GET /set?name=X&status=2   break one service (0 healthy, 1 warning, 2 critical)
 *   GET /all?status=0       set every service at once
 *   GET /script?on=false    stop or start the automatic story
 */

const http = require('http');

const PORT = Number(process.env.PORT || 9101);

/** The same services the built-in demos use, so both tell the same story. */
const SERVICES = [
  // The checkout path, in rough order of how an order flows through it.
  'shipping', 'checkout', 'basket', 'orders',
  // Everything else, which has nothing to do with shipping.
  'search', 'accounts', 'reviews',
];

const HEALTHY = 0;
const WARNING = 1;
const CRITICAL = 2;

/**
 * The story the demo tells on its own, so `docker compose up` shows something
 * moving straight away.
 *
 * One dependency fails and the shop fails around it. The shipping API starts
 * missing its objective, checkout goes next because it cannot quote a delivery
 * date, then the basket because it cannot show a total, then orders because
 * they cannot be placed. Search, accounts and reviews never appear, because
 * nothing is wrong with them.
 *
 * Each stage holds for twelve seconds. Slow enough that somebody glancing up
 * from a desk can follow it.
 */
const STORY = [
  { at: 0, broken: {} },
  { at: 14, broken: { shipping: WARNING } },
  { at: 26, broken: { shipping: CRITICAL, checkout: WARNING } },
  { at: 38, broken: { shipping: CRITICAL, checkout: WARNING, basket: WARNING } },
  {
    at: 50,
    broken: { shipping: CRITICAL, checkout: CRITICAL, basket: WARNING, orders: WARNING },
  },
  {
    at: 62,
    broken: { shipping: CRITICAL, checkout: CRITICAL, basket: CRITICAL, orders: WARNING },
  },
  // The API is being fixed; what sits behind it takes longer.
  {
    at: 74,
    broken: { shipping: WARNING, checkout: CRITICAL, basket: CRITICAL, orders: WARNING },
  },
  { at: 86, broken: { checkout: WARNING, basket: WARNING, orders: WARNING } },
  { at: 98, broken: { basket: WARNING, orders: WARNING } },
  { at: 110, broken: { basket: WARNING } },
  { at: 118, broken: {} },
];

const LOOP_SECONDS = 124;

/** What each service is doing right now. */
const health = new Map(SERVICES.map((name) => [name, HEALTHY]));

/** How much of each service's error budget has gone, as a percentage. */
const burned = new Map(SERVICES.map((name) => [name, 0]));

/**
 * How long burning at the budgeted pace would take to use the whole budget, in
 * seconds of demo time.
 *
 * A real error budget runs over about 30 days. Nobody will watch a wallboard
 * for 30 days, so it is compressed.
 *
 * Tuned so that services burning at different rates end up at visibly different
 * places by the end of a loop. Too fast and everything hits the ceiling and the
 * screen shows four identical boxes, which is exactly what a treemap should not
 * do.
 */
const BUDGET_WINDOW_SECONDS = 900;

/** The worst a budget is allowed to get, so the numbers stay sane. */
const MAX_BURNED = 130;

/**
 * How fast a service is burning budget, as a multiple of the budgeted pace.
 *
 * Healthy services still burn a little, because no service is perfect. Broken
 * ones burn at different rates so the screen has some variety to show, rather
 * than every box coming out the same size.
 */
function burnRateFor(name, status) {
  const spread = SERVICES.indexOf(name);

  if (status === CRITICAL) {
    return 10 + (spread % 4) * 7;
  }
  if (status === WARNING) {
    return 4 + (spread % 4);
  }
  return 0.1;
}

let scriptRunning = true;
const startedAt = Date.now();

function applyStory() {
  if (!scriptRunning) {
    return;
  }

  const elapsed = ((Date.now() - startedAt) / 1000) % LOOP_SECONDS;
  let step = STORY[0];
  for (const candidate of STORY) {
    if (candidate.at <= elapsed) {
      step = candidate;
    }
  }

  for (const name of SERVICES) {
    health.set(name, step.broken[name] ?? HEALTHY);
  }
}

/** Burns a second's worth of budget for every service. */
function burnBudget() {
  for (const name of SERVICES) {
    const rate = burnRateFor(name, health.get(name));
    const spent = (rate * 100) / BUDGET_WINDOW_SECONDS;

    burned.set(name, Math.min(MAX_BURNED, burned.get(name) + spent));
  }
}

let lastLoop = 0;

function tick() {
  // Give every service its budget back when the script starts over, so each
  // loop of the demo tells the same story.
  if (scriptRunning) {
    const loop = Math.floor((Date.now() - startedAt) / 1000 / LOOP_SECONDS);
    if (loop !== lastLoop) {
      lastLoop = loop;
      for (const name of SERVICES) {
        burned.set(name, 0);
      }
    }
  }

  applyStory();
  burnBudget();
}

setInterval(tick, 1000);
applyStory();

const round = (n) => Math.round(n * 10000) / 10000;

/**
 * Availability: good events over total events.
 *
 * The ordinary shape of an SLO, and what the panel expects out of the box. A
 * spread across services so the screen has some variety rather than every box
 * coming out the same size.
 */
function availabilityFor(name, status) {
  const spread = SERVICES.indexOf(name);

  if (status === CRITICAL) {
    return 0.94 - (spread % 4) * 0.012;
  }
  if (status === WARNING) {
    return 0.988 - (spread % 3) * 0.004;
  }
  return 0.9999;
}

/** The labels Sloth puts on everything it generates. */
const slothLabels = (name) =>
  `sloth_id="${name}-requests-availability",sloth_service="${name}",sloth_slo="requests-availability"`;

function metrics() {
  const lines = [];

  lines.push('# HELP demo_availability_ratio Good events over total events. 1 is perfect, lower is worse.');
  lines.push('# TYPE demo_availability_ratio gauge');
  for (const [name, status] of health) {
    lines.push(`demo_availability_ratio{service="${name}"} ${round(availabilityFor(name, status))}`);
  }

  lines.push('# HELP demo_error_budget_burned_percent How much of the error budget has gone. Higher is worse.');
  lines.push('# TYPE demo_error_budget_burned_percent gauge');
  for (const [name, value] of burned) {
    lines.push(`demo_error_budget_burned_percent{service="${name}"} ${round(value)}`);
  }

  lines.push('# HELP demo_error_budget_remaining_percent How much of the error budget is left. Lower is worse.');
  lines.push('# TYPE demo_error_budget_remaining_percent gauge');
  for (const [name, value] of burned) {
    lines.push(`demo_error_budget_remaining_percent{service="${name}"} ${round(Math.max(0, 100 - value))}`);
  }

  lines.push('# HELP demo_burn_rate How fast the budget is going, as a multiple of the budgeted pace.');
  lines.push('# TYPE demo_burn_rate gauge');
  for (const [name, status] of health) {
    lines.push(`demo_burn_rate{service="${name}"} ${round(burnRateFor(name, status))}`);
  }

  // The same numbers again, under the names Sloth generates. Labelled the way
  // Sloth labels them, so a query written against a real Sloth setup works here
  // unchanged.
  lines.push('# HELP slo:period_error_budget_remaining:ratio Budget left over the period, 1 is untouched. Lower is worse.');
  lines.push('# TYPE slo:period_error_budget_remaining:ratio gauge');
  for (const [name, value] of burned) {
    lines.push(`slo:period_error_budget_remaining:ratio{${slothLabels(name)}} ${round((100 - value) / 100)}`);
  }

  lines.push('# HELP slo:current_burn_rate:ratio How fast the budget is going right now.');
  lines.push('# TYPE slo:current_burn_rate:ratio gauge');
  for (const [name, status] of health) {
    lines.push(`slo:current_burn_rate:ratio{${slothLabels(name)}} ${round(burnRateFor(name, status))}`);
  }

  lines.push('# HELP slo:objective:ratio The objective each service is held to.');
  lines.push('# TYPE slo:objective:ratio gauge');
  for (const name of SERVICES) {
    lines.push(`slo:objective:ratio{${slothLabels(name)}} 0.999`);
  }

  lines.push('# HELP demo_service_health How a service is doing. 0 healthy, 1 warning, 2 critical.');
  lines.push('# TYPE demo_service_health gauge');
  for (const [name, status] of health) {
    lines.push(`demo_service_health{service="${name}"} ${status}`);
  }

  return lines.join('\n') + '\n';
}

const LABELS = ['Healthy', 'Warning', 'Critical'];

function page() {
  const rows = SERVICES.map((name) => {
    const status = health.get(name);
    const spent = Math.round(burned.get(name));
    const buttons = [0, 1, 2]
      .map(
        (level) =>
          `<a class="b ${status === level ? 'on' : ''} l${level}" href="/set?name=${name}&status=${level}">${LABELS[level]}</a>`
      )
      .join('');
    return `<tr><td>${name}</td><td>${buttons}</td><td class="n">${spent}% burned</td></tr>`;
  }).join('');

  return `<!doctype html><meta charset="utf-8"><title>Noise Is Bad demo</title>
<style>
 body{font:14px system-ui,sans-serif;background:#111;color:#eee;margin:0;padding:24px}
 h1{font-size:18px;margin:0 0 4px} p{color:#999;margin:0 0 20px}
 table{border-collapse:collapse} td{padding:3px 10px 3px 0}
 .b{display:inline-block;padding:3px 10px;margin-right:4px;border-radius:4px;background:#222;color:#aaa;text-decoration:none}
 .b.on.l0{background:#2a6;color:#fff}.b.on.l1{background:#c81;color:#fff}.b.on.l2{background:#c33;color:#fff}
 .top a{margin-right:8px} .n{color:#888;font-variant-numeric:tabular-nums}
</style>
<h1>Noise Is Bad &mdash; pretend estate</h1>
<p>Script is ${scriptRunning ? 'running' : 'stopped'}. Stop it before setting anything by hand, or it will overwrite you.</p>
<p class="top">
 <a class="b" href="/script?on=${scriptRunning ? 'false' : 'true'}">${scriptRunning ? 'Stop' : 'Start'} the script</a>
 <a class="b" href="/all?status=0">All healthy</a>
 <a class="b" href="/all?status=1">All warning</a>
 <a class="b" href="/all?status=2">All critical</a>
 <a class="b" href="/reset">Give the budgets back</a>
</p>
<table>${rows}</table>`;
}

function send(res, code, type, body) {
  res.writeHead(code, { 'content-type': type });
  res.end(body);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const status = Number(url.searchParams.get('status'));
    const valid = [HEALTHY, WARNING, CRITICAL].includes(status);

    if (url.pathname === '/metrics') {
      return send(res, 200, 'text/plain; version=0.0.4', metrics());
    }

    if (url.pathname === '/set') {
      const name = url.searchParams.get('name');
      if (health.has(name) && valid) {
        health.set(name, status);
      }
      res.writeHead(302, { location: '/' });
      return res.end();
    }

    if (url.pathname === '/all') {
      if (valid) {
        for (const name of SERVICES) {
          health.set(name, status);
        }
      }
      res.writeHead(302, { location: '/' });
      return res.end();
    }

    if (url.pathname === '/reset') {
      for (const name of SERVICES) {
        burned.set(name, 0);
      }
      res.writeHead(302, { location: '/' });
      return res.end();
    }

    if (url.pathname === '/script') {
      scriptRunning = url.searchParams.get('on') !== 'false';
      res.writeHead(302, { location: '/' });
      return res.end();
    }

    if (url.pathname === '/') {
      return send(res, 200, 'text/html; charset=utf-8', page());
    }

    send(res, 404, 'text/plain', 'not found\n');
  })
  .listen(PORT, () => console.log(`pretend estate on :${PORT}`));
