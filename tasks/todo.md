# Tasks

## NIB-001 — Scaffold Grafana panel plugin

**Goal:** smallest possible custom Grafana panel running locally, receiving data, resizing correctly.

- [x] Scaffold with `@grafana/create-plugin` 7.10.1 (panel, org `triwats`, name `noise-is-bad` → id `triwats-noiseisbad-panel`)
- [x] Flatten scaffold into repository root alongside the plan and CLAUDE.md
- [x] `git init` (nothing committed — left for the user)
- [x] Replace the sample panel with the "noise is bad. / N signals received" placeholder
- [x] Panel never falls back to `PanelDataErrorView`; an empty result is the good case
- [x] Typography scales off the panel's smaller edge so it survives resize
- [x] Unit tests for signal counting, pluralisation, fill and rescaling
- [x] Rewrite the e2e spec and provisioned dashboard for the new panel
- [x] Project README and plugin catalogue README
- [x] CLAUDE.md updated with real commands and plugin-tools rules
- [x] `npm install` — 1233 packages, `package-lock.json` written
- [x] Verify: typecheck clean, lint clean, 7/7 unit tests pass, production build emits `dist/module.js`
- [x] Verify: `npm run server` serves Grafana 13.1.0, plugin registered, 3/3 e2e tests pass

### Review

**Done.** Epic 1's three "Done When" criteria are met.

| Check | Result |
| --- | --- |
| typecheck | clean |
| lint | clean |
| unit tests | 7/7 pass |
| production build | `dist/module.js`, 1.92 KiB |
| e2e against real Grafana | 3/3 pass |
| plugin registered | `triwats-noiseisbad-panel`, unsigned |

Resize measured in-browser with the panel full-screen: the mark scales 144.96px → 87.36px → 39.36px → 14px across viewports from 1920x1080 down to 420x240, hitting its legibility floor at the smallest size.

**Decisions worth knowing**

- The scaffold was flattened into the repository root rather than left in `triwats-noiseisbad-panel/`, matching the layout in Epic 1 of the plan.
- The panel does not use `PanelDataErrorView`. An empty result renders "0 signals received" instead of Grafana's "No data", because an empty estate is the good case and becomes quiet mode in Epic 4.
- `NoiseOptions` is `Record<string, never>`. There are no panel options yet and Epic 9 owns that surface.
- Typography scales off `Math.min(width, height)`, so the mark is bounded by the panel's smaller edge. On a dashboard grid the height is fixed, so only a fullscreen or taller panel changes the size.
- `git init` was run but nothing is committed; the first commit is left to the user.

**Environment notes**

- The npm registry link was badly degraded; individual metadata fetches took up to 500s. Limiting npm to 3-4 sockets was what made the install complete.
- The local npm cache held stale package indexes for `@floating-ui/react` and `@floating-ui/react-dom`, so `--prefer-offline` failed with ETARGET. Full revalidation fixed it.
- Docker's daemon could not reach `auth.docker.io` while the host could. Restarting Docker Desktop fixed it.

## Follow-up — developer setup

- [x] `Makefile` wrapping setup, build, server lifecycle and checks
- [x] `make doctor` reports node, npm, dependencies, build output, Docker, Grafana health and plugin registration
- [x] Guards: `make up` refuses without a build, `make e2e` refuses without a running Grafana
- [x] CLAUDE.md and README updated to lead with `make`

## Follow-up — Node version pins

- [x] Three disagreeing pins found: `.nvmrc` 24, CI 22, `engines` >=22
- [x] Verified typecheck, lint, tests and build all pass on Node 24.11.1
- [x] `.nvmrc` is now the single source of truth; both CI workflows use `node-version-file`
- [x] `engines.node` raised to `>=24`; `make doctor` reports a mismatch against `.nvmrc`

## NIB-002 — Demo signal generator

**Goal:** fake health signals so visual work never waits on a real datasource. Pulls in the Epic 2 data contract, which everything downstream needs.

- [x] `src/noise/types.ts` — `Severity`, `NoiseSignal`, `isUnhealthy`. No Grafana imports, ever.
- [x] `src/demo/scenarios.ts` — the eight scenarios named in Epic 3, as timed step scripts
- [x] `signalsAt(scenario, elapsedMs)` — pure, loops, clamps, no clock of its own
- [x] `src/demo/useElapsed.ts` — ticking hook with proper cleanup
- [x] Panel option to pick a scenario; `live` keeps using real Grafana data
- [x] Panel lists the unhealthy signals, as a temporary stand-in for Epics 4 to 7
- [x] Unit tests: 33 total, covering every scenario, the step lookup and the hook lifecycle
- [x] Third panel provisioned on the demo dashboard running `growing-incident`
- [x] Verified with `make check`, `make e2e` and in a real browser

### Review

**Done, with one deliberate gap.** Epic 3's "Done When" is that the entire lifecycle can be demonstrated without a datasource. The scripted lifecycle can. The per-signal severity and age controls sketched in the plan are not built.

That gap is a judgement call, not an oversight. Those controls need somewhere to live and something to control, and there is no renderer yet — the panel still shows a text list. Building a control surface against a placeholder would mean building it twice. It belongs with Epic 4 or later.

Watched in a real browser, `growing-incident` walks through its script correctly:

```
ALL QUIET
CHECKOUT WARNING
CHECKOUT CRITICAL
CHECKOUT CRITICAL | SEARCH WARNING
CHECKOUT CRITICAL | SEARCH WARNING | KAFKA WARNING
```

**Decisions worth knowing**

- A scenario is a script of timed steps, each declaring the *whole* estate. A service going healthy shows up as severity 0 rather than as an absence, which is what the State Engine will need in NIB-009 to tell recovery from a missing metric.
- `signalsAt` is pure and owns no clock. `useElapsed` is the only thing that ticks, so a scrubber or a fixed timestamp can drive the same scenarios later.
- Switching between two scenarios leaves the clock running rather than restarting it, because `running` stays true. Switching to or from live resets it.
- Two eslint rules pushed the hook into a better shape: no `setState` in an effect body, and no reading a ref during render. The start time now lives in the effect's closure and the zero is derived from `running`.
- An unknown scenario id falls back to live data rather than throwing.

## NIB-004 / NIB-005 — Quiet mode and the bouncing mark

**Goal:** zero unhealthy signals puts the screen into a calm state: an original "noise is bad." mark drifting and bouncing, DVD-style.

- [x] `src/render/` established as a third Grafana-free area, added to the boundary test
- [x] `src/render/theme.ts` — the handful of colours the renderer needs, mapped from Grafana by the panel
- [x] `src/render/bounce.ts` — pure physics: `step(state, bounds, dt)`. No clock, no DOM.
- [x] `src/render/QuietMode.tsx` — thin imperative shell driving it on `requestAnimationFrame`
- [x] Animate by writing `transform` on a ref, not by re-rendering React sixty times a second
- [x] Resize updates the bounds without restarting the animation
- [x] Cancel the frame on unmount; no leaks
- [x] Panel option: quiet mode on by default
- [x] Tests: 60 unit tests total, including reflection off each edge, oversize and zero-size bounds, a sixty-second frame gap, and cleanup
- [x] Two new provisioned panels; 6 e2e tests, one of which measures that the mark actually moves

### Review

**Done.** Epic 4's four "Done When" criteria are met.

Measured in a real browser, the mark's position over five seconds:

| Sample | x | y |
| --- | --- | --- |
| 1 | 443 | 576 |
| 2 | 686 | 751 |
| 3 | 929 | 562 |

y rises, hits the floor and comes back, which is the reflection working outside the unit tests.

**Decisions worth knowing**

- The physics is a pure function with no clock and no DOM, so every edge case is tested without rendering anything. The component is a thin shell around it.
- Reflection folds the position as a triangle wave rather than clamping it. A backgrounded tab for a minute therefore resumes where the mark should actually be, not pinned to a wall. There is a test for exactly that.
- Animation writes `transform` directly onto the element. React does not re-render for it. This runs on an office television for days at a time.
- Resize updates a bounds ref in place rather than restarting the effect, so the mark drifts on rather than teleporting to the start.
- **The panel now has three states, not two.** "We cannot read health from this query" is not the same claim as "everything is healthy", so live data does not earn quiet mode while there is no adapter. It says what it knows instead. That branch disappears with NIB-003, which is next.
- Renderer components take a `NoiseTheme` rather than calling `useStyles2`, so `src/render/` stays Grafana-free and the boundary test now covers it.
- Quiet mode switched off with nothing unhealthy gives an empty screen, which is the honest reading of "the screen is for things deserving attention".

## NIB-003 — Signal adapter

**Goal:** normalise Grafana DataFrames into `NoiseSignal[]`, and close the "nothing readable" gap the live panels were showing.

- [x] `src/adapter/signalAdapter.ts` — the only file in the codebase that touches `data.series`
- [x] Long tables: first string field names, first numeric field scores
- [x] Prometheus shape: no string field means one series per frame, named by its display name and labels
- [x] Last, Max and Mean reductions
- [x] Thresholds at 1 and 2, overridable, ready for Epic 9 to wire to panel options
- [x] Worst reading wins when a name arrives from more than one frame
- [x] Reports `readable` so an unreadable query never masquerades as a healthy estate
- [x] 18 adapter tests; 76 unit tests overall; 6 e2e tests
- [x] Provisioned live panel now demonstrates the real path: checkout 2, search 1, kafka 0, auth 0

### Review

**Done.** The pipeline runs end to end: a real Grafana query becomes signals, healthy ones are dropped, and the renderer shows what is left. Verified in a browser, the live panel shows checkout critical and search warning while kafka and auth, both healthy, are not drawn at all.

**The bug worth remembering.** The first draft used `Number(value)` to coerce readings. `Number(null)` is 0 and `Number('')` is 0, so every gap in the data would have been silently reported as healthy. Three tests caught it. On a wallboard whose entire job is to say how bad things are, quietly turning missing data into good news is the worst failure mode available, so absence now becomes NaN and is dropped.

**Decisions worth knowing**

- Healthy signals are kept by the adapter and dropped by the renderer. The state engine will need to tell "recovered" from "disappeared" in NIB-009, and that distinction is lost if the adapter filters early.
- Worst reading wins on a name collision, rather than last or first.
- The adapter returns a `readable` flag alongside the signals. Without it the panel cannot distinguish a broken query from a healthy estate, and it would fall into quiet mode while the estate burned.
- `countSignals` and its placeholder view are gone, replaced by the real thing.

## NIB-006 — Single incident takes the screen

**Goal:** one problem is not a tile in a grid. It is everything.

- [x] `src/render/fitText.ts` — pure approximation of the largest size a name still fits at
- [x] `src/render/SingleIncident.tsx` — name, severity word, nothing else
- [x] Warning and critical differ by colour, weight and size
- [x] Panel routes by count: 0 quiet, 1 single incident, 2+ list
- [x] 94 unit tests; 7 e2e tests including one that measures the incident really fills the panel

### Review

**Done.** Epic 5's criterion is met: one unhealthy signal completely replaces quiet mode, and gets the whole display.

**Decisions worth knowing**

- Text is fitted by approximation, not measurement. Measuring means laying out and reading back geometry every frame, and this only has to be close. The glyph-width constant is documented where it is used.
- Warning and critical differ on three axes, not one. Colour alone fails for the colour-blind and washes out on a bright office wall.
- The severity word is letter-spaced, with a matching text indent so it stays optically centred.
- An e2e test compares the incident's bounding box against the panel's, so "takes the whole screen" is measured rather than assumed.

## NIB-007 / NIB-008 — Treemap and layout transitions

**Goal:** two or more problems divide the available screen, weighted, and the layout moves rather than flashing.

- [x] `d3-hierarchy` added; root `jest.config.js` extended to transform it and its ESM dependencies
- [x] `src/render/treemapLayout.ts` — pure squarified layout, deterministic ordering
- [x] `src/render/Treemap.tsx` — tiles keyed by name so CSS transitions do the animating
- [x] `src/noise/pressure.ts` — severity weights, warning 1 and critical 3, ready for persistence
- [x] Transition duration as a panel option, defaulting to 500ms
- [x] 118 unit tests; 9 e2e tests
- [x] Provisioned treemap panel; e2e proves the incumbent shrinks when a newcomer arrives

### Review

**Done.** Measured in a browser at 1920x1080 with three criticals and one warning:

| Tile | Severity | Size |
| --- | --- | --- |
| checkout | critical | 1120x450 |
| search | critical | 744x678 |
| kafka | critical | 1120x450 |
| auth | warning | 744x222 |

The warning gets roughly a sixth of a critical's area, which is the 1 against 3 severity weighting showing through.

**Decisions worth knowing**

- Tiles are keyed by name. That single choice is what makes the transition work: React reuses the DOM node, so a CSS transition on position and size animates it. No animation library, no layout thrash.
- Colour is excluded from the transition. A problem turning critical must register instantly rather than fade up.
- Layout ordering is deterministic, weight then name. Without it, two equal tiles could swap places on a refresh, which on a wall-mounted television reads as the display panicking.
- A file named `treemap.ts` alongside a component named `Treemap.tsx` is a trap on a case-insensitive filesystem. Renamed to `treemapLayout.ts`.
- `d3-hierarchy` is ESM-only and Jest would not load it. The fix belongs in the root `jest.config.js`, never in `.config/`, which the plugin tooling regenerates.

## NIB-009 / NIB-010 / NIB-011 — The State Engine

**Goal:** carry state across refreshes so persistence can be measured, spend it as pressure, and stop flapping metrics strobing the display.

- [x] `src/noise/state.ts` — pure, clock-free reducer. `advance` folds a refresh in, `itemsOf` reads it back.
- [x] `NoiseItem` added to the contract, exactly as Epic 2 specifies
- [x] `firstSeen` survives refreshes; escalation does not reset it
- [x] Persistence and pressure derived on read, so they rise between refreshes
- [x] `src/noise/pressure.ts` — the plan's bands: 1.0, 1.2, 1.5, 2.0
- [x] Recovery needs two consecutive healthy readings; a new problem shows immediately
- [x] An absent name is held, not counted as recovery
- [x] Treemap now spends pressure rather than severity alone
- [x] `src/useNow.ts` — one-second clock so ageing shows without a refresh
- [x] 150 unit tests; 11 e2e tests; two more provisioned panels for recovery and chaos

### Review

**Done. This is the prototype gate.** NIB-001 through NIB-011 are complete, and the plan says to stop here.

Measured in a browser over 24 seconds of the chaos scenario, which is two full loops:

| | |
| --- | --- |
| Scenario steps | 16 |
| Distinct display changes | 13 |
| Frames showing nothing | 0 |

The headline is the zero. The specific failure the plan draws as a strobe, the display flicking between an incident and the bouncing mark, does not happen at all. The other number is more honest than flattering: most remaining churn is problems *arriving*, which the plan wants immediate, so hysteresis has little left to damp. If the television test says the board still feels busy, damping arrivals is the next lever, and that is a visual decision to make in front of the screen rather than in code.

**Decisions worth knowing**

- The engine is a pure reducer with no clock. Ageing and hysteresis are entirely about time, and passing `now` makes both testable without waiting.
- Persistence and pressure are derived on read rather than stored. A problem visibly grows heavier between refreshes, not only when new data lands.
- A name vanishing from a query is treated as no news, not recovery. It is the same instinct as the adapter's null handling: a wallboard must never turn missing data into good news.
- Escalation keeps `firstSeen`. A warning becoming critical is one incident getting worse, not a new one.
- Demo scenarios advance the engine once a second rather than every 250ms tick, so hysteresis behaves the way it will against a real dashboard refresh.
- State is adjusted during render rather than in an effect, which is React's own pattern for reacting to changed input and avoids painting a frame of last refresh's layout. The lint rules then forced `Date.now()` out of render, so the ticking clock supplies the timestamp. It can be up to a second early, which is nothing against bands that step at thirty seconds.

## Polish found by looking at the screen

Two defects the test suite could not have caught on its own, both found by measuring the rendered page.

- **Names bled out of their tiles.** The glyph-width constant in `fitText.ts` was calibrated for mixed case, but everything renders uppercase, which is wider. A six-character name overflowed its tile by 5px. Raised the constant to 0.68 with headroom, added a measurement-backed test, and put `max-width` and `overflow: hidden` on the name as a hard guard so a name can be clipped but never bleed.
- **The size difference between warning and critical silently collapsed.** It had been expressed by fitting each severity to a different fraction of the height, which only differs while height is the binding constraint. With a long name, width binds and both rendered identically. Now the fitted size is scaled *after* fitting, and the warning is scaled down rather than the critical up, so the difference is unconditional and nothing can overflow. The test now covers a wide panel, a narrow one and a square one, which is where the old approach failed.

## Quiet mode — the bouncing DVD logo

**Goal:** the actual DVD logo as a quiet-mode option, from bouncingdvdlogo.com, and the default.

- [x] `src/render/dvdMark.tsx` — the logo's path data inlined, `fill="currentColor"`, and the seven colours
- [x] `bounce.ts` counts walls hit, so colour can change on contact
- [x] `QuietMode.tsx` takes a `mark` prop; the logo cycles colour, the wordmark keeps the theme's
- [x] `quietMark` panel option, defaulting to the logo, hidden when quiet mode is off
- [x] 20 new unit tests; 194 pass, lint clean, production build clean
- [x] E2E coverage of the wordmark variant; 13 e2e tests pass
- [x] `quiet.json` — a dashboard pinned to the quiet state, and `make quiet` to open it full-screen

### Review

**Done, bar one deliberate gap.** The logo drifts, and changes colour on every wall it hits, which is the
half of the joke that matters. `make check` is clean apart from a `tile.pressure` typecheck error in
`Treemap.tsx` that belongs to NIB-010 and predates this work.

**Decisions worth knowing**

- The site serves seven SVGs, `logos/dvdlogo-01.svg` to `-07.svg`, with byte-identical geometry and one
  differing `fill`. So this is one copy of the path data painted with `currentColor`, not seven assets.
  Nothing to fetch, no SVG loader added to webpack, and `src/render/` stays Grafana-free and portable.
- **Counting bounces belongs in the pure layer.** The component cannot detect a wall by watching the
  velocity flip: reflection folds the position as a triangle wave, so one long frame — a backgrounded tab,
  a television waking — can contain a dozen bounces that a sign-flip check reads as zero or one.
  `BounceState.bounces` rises monotonically and the colour is `bounces % 7`.
- The colour is written to the element's `style.color` only when the index actually changes, not on every
  frame. The SVG inherits it. This runs on a television for days.
- A test caught the loop recolouring the *wordmark* too. Cycling is the DVD joke, not a quiet-mode feature,
  so the loop reads a `cyclingRef` — the animation effect is started once and never restarted, so it cannot
  close over the prop.
- The wordmark's unit test was rescoped rather than deleted: it must still be reachable, and still original.
- **Trademark.** The DVD Video logo belongs to DVD Format/Logo Licensing Corporation. Fine on an office
  television; the default has to go back to the wordmark before any Grafana catalogue submission. Recorded
  in `dvdMark.tsx`, `CLAUDE.md` and the plan, whose Epic 4 line is marked superseded rather than rewritten.

**On the dashboards.** The provisioned dashboards were split while this was in flight: `dashboard.json`
is the single fullscreen `lifecycle` panel for the television, and `states.json` holds one panel per state
for the e2e suite. The wordmark panel is id 9 on `states.json`. A third, `quiet.json`, pins the quiet state
alone — `all-quiet` with `quietMark: dvd` — so the logo can be watched indefinitely without a scenario
moving on underneath it. `make quiet` opens it fullscreen. Measured there: six of the seven palette colours
inside twenty seconds.

The two quiet-mode e2e tests target the mark by `data-testid="quiet-mark"` rather than its text, so they no
longer care which mark is configured — which is also what stops the panel editor's own "noise is bad." radio
label colliding with them.

## Plain language pass

Asked for: every demo, test and variable in simple words.

- [x] Renamed identifiers to plain words: `advance` to `update`, `itemsOf` to `getItems`, `estate` to `makeSignals`, `healthyRun` to `healthyCount`, `initialState` to `startState`, `freeSpace` to `roomToMove`, `strengthOf` to `fillStrength`, `RECOVERY_OBSERVATIONS` to `HEALTHY_CHECKS_TO_CLEAR`, and others
- [x] A local `isFinite` was shadowing the global one, which behaves differently. Renamed to `isRealNumber`.
- [x] Rewrote every test name as a short plain sentence, all 194 of them, plus the 13 end-to-end names
- [x] Rewrote the scenario descriptions and panel option text that users actually read
- [x] Simplified the comments, which had drifted into being florid rather than clear
- [x] All 194 unit tests and 13 end-to-end tests still pass

Examples of the change in tone:

| Before | After |
| --- | --- |
| does not claim all is well when the query carries nothing readable | says it cannot read a query with no numbers |
| keeps the same element for a problem across a refresh, so it animates rather than flashing | reuses the same box so it can slide instead of flashing |
| a flapping metric does not strobe the display | a flickering service does not make the screen flash |
| holds the problem rather than treating silence as recovery | keeps the problem instead of assuming it is fixed |

## NIB-012 to NIB-016 — configuration, a real demo, and the README

- [x] **NIB-012, NIB-013.** Every setting Epic 9 asks for: which columns to read, Last/Worst/Average, warning and critical levels, grow-with-age, quiet mode and its mark, transition time. Grouped into Data, Thresholds, Display and Demo.
- [x] **NIB-014.** `demo/exporter` is a pretend estate of seven services. Plain Node, no dependencies, so the image is the base plus one file. Serves `demo_service_health` and a web page on port 9101 for breaking services by hand.
- [x] **NIB-015.** `docker compose up` now starts Grafana, the estate and Prometheus together. `make setup` does the lot and prints where to look.
- [x] **NIB-016.** README rewritten to lead with the demo, followed by how to try it, how to point it at your own data, and how it is built. A 19.75 second GIF of one full loop sits at the top.
- [x] 203 unit tests, 14 end-to-end tests, including one that reads the real Prometheus metric

**That completes NIB-001 through NIB-016. The whole roadmap in the plan is built.**

### The long diagnosis worth remembering

Prometheus would not start. It died with `unexpected fault address` and a SIGBUS inside `NewActiveQueryTracker`, before serving anything.

Ruled out in turn: the config file, a named volume, memory-backed storage, Prometheus 3.5 and 2.55, and both the arm64 and amd64 images. All failed identically, which pointed away from Prometheus.

The actual cause showed up only when a substitute store logged `the storage is in read-only mode`: **Docker's virtual disk was 100% full, with zero bytes free.** Prometheus memory-maps a file at startup, and on a full disk that takes a bus error instead of reporting no space.

`docker builder prune` freed 4GB, and Prometheus started first time. Only build cache was removed, nothing that cannot be rebuilt; the 41GB of unused images were left alone as they are not mine to delete.

## Feedback — always have a background colour

The panel was see-through in every state, letting Grafana's background show.

- [x] `NoiseTheme` gained `canvas`, and every state paints it: quiet mode, the single incident, the treemap board, and the "nothing to read" message
- [x] A single incident now fills the whole panel with its severity colour rather than only colouring the words
- [x] `src/render/fill.ts` holds the score-to-paint-strength rule, shared by the single incident and the treemap, so the same problem looks the same in both
- [x] An older problem is painted more strongly, in the single-incident view as well as the treemap
- [x] Tests assert a background is painted in every state, including when nothing is broken
- [x] 209 unit tests, 14 end-to-end tests

**Worth deciding next**, in front of the television rather than here: whether the background should also carry the overall mood, warming as total noise rises, rather than only being a flat calm colour when things are quiet. That is Epic 7's colour experiment applied to the whole screen instead of to each box, and it is a judgement call best made by looking.

## NIB-017 — An SLO-shaped input, documented

**Decision:** the panel's primary input is an SLO number, not an alert. "We are burning error budget" is a better answer to "how bad is it" than "an alert is firing", because alerts will be firing anyway and this is not an alert dashboard.

**The contract, in one line:** give the panel a number per service and tell it the warning and critical levels. That covers every SLO shape people actually have.

- [x] Scoring is continuous: 1 at the warning level, 3 at critical, rising at the same rate beyond, capped at 9
- [x] Severity is derived from the score, so colour and box size can never disagree
- [x] "Lower is worse" supported, by negating the value and both levels
- [x] Exporter publishes budget burned, budget remaining, burn rate and the simple status number, with a budget that genuinely burns over time
- [x] `docs/metrics.md` documents the contract with a table of the four shapes and example queries for Sloth, Pyrra and raw ratios
- [x] README leads with the contract and links to the full document
- [x] Real-data dashboard now sized by error budget burned
- [x] 238 unit tests, 14 end-to-end tests

### Review

**Done.** The panel now reads an SLO number rather than a status.

The difference is visible rather than theoretical. Before, every critical service scored the same and the treemap could only separate them by age. Measured on the real Prometheus dashboard afterwards, five services burning budget at different rates came out at 313, 269, 246, 196 and 162 thousand square pixels. That spread is the magnitude finally reaching the screen.

**Decisions worth knowing**

- The panel computes no SLOs. Sloth, Pyrra and a handful of recording rules already do that well, and your plan lists complex SLO logic as out of scope. The panel takes the number they produce.
- The scoring curve is anchored on the plan's existing weights, so nothing about the original design was thrown away: a warning is still 1 and a critical still 3. Everything between and beyond is new.
- It is capped at 9. Without a cap, a service burning a hundred times over would take the whole screen and hide everything else, which is the opposite of the point.
- A reading of positive infinity counts as maximally bad, not as no reading. A burn rate divided by a zero denominator is a real thing in Prometheus, and treating it as healthy would be the worst kind of wrong.
- Alerts are supported but not recommended, and the documentation says why rather than leaving people to find out.

### A mistake worth recording

The treemap showed five identically sized boxes and I went looking for a bug in the scoring. There was none. I had changed the code and run the tests, but never rebuilt the plugin, so the browser was still running the old build. **Run `make build` before believing anything seen in a browser.**

## NIB-018 — A believable demo, and SLO tooling that works untouched

Two pieces of feedback: the demo changed too fast and looked like an unexplained total outage, and it should work with Sloth and Pyrra.

- [x] The estate is an online shop of seven services, three of which never break in the main story
- [x] The story is a blast radius: shipping API, then quotes, then checkout, then the cart
- [x] Stages hold for twelve seconds rather than three; a test asserts none is shorter than eight
- [x] It peaks at four services of seven. A test asserts the three unrelated ones never appear at any point.
- [x] Demo steps are written as percent of error budget burned and turned into signals through the same code the adapter uses
- [x] `nameField` now matches a label as well as a column, so a Sloth query needs no legend format
- [x] Exporter publishes Sloth's metric names and labels; a provisioned Sloth dashboard reads them with no legend format set
- [x] `docs/metrics.md` has exact settings for Sloth, both budget-left and burn-rate, and the arithmetic for Pyrra
- [x] Demo GIF re-recorded from the new story
- [x] 250 unit tests, 15 end-to-end tests

### Review

**Done.** The demo now tells an incident rather than an apocalypse, and the panel reads a real SLO generator's output with nothing rewritten.

The most useful test in this batch asserts that search, reviews, the CDN and the catalog never appear at any point in the story. That is the governing rule of the whole project, and it is now something the suite would catch rather than something a reviewer has to notice.

**Decisions worth knowing**

- Demo steps are budgets, not severities. Writing the demo in the same units the documentation asks users for means the two cannot drift apart, and it made the treemap size the demo properly for free.
- Naming from a label rather than a column is the small change that makes Sloth and Pyrra work as they are. Their rules put labels on the series, not in columns, and requiring a legend format on every query would have been friction for no reason.
- The Pyrra section is written more carefully than the Sloth one. Sloth's names are verified end to end in this repository; Pyrra's have moved between versions, so the document gives the arithmetic and says to check the metric names.

## Feedback — seven services, not twenty

Twenty was too many. Cut to seven: four on the checkout path and three that never break.

- [x] `shipping-api`, `shipping-quotes`, `checkout`, `cart`, plus `search`, `catalog` and `reviews` which stay healthy
- [x] Story peaks at four of seven, loop shortened from 150 to 124 seconds
- [x] Exporter estate cut to match, so both demos tell the same story
- [x] Tests, dashboards and the GIF all follow
- [x] 250 unit tests, 15 end-to-end tests

A detail worth keeping: during recovery the shipping API drops below its dependents, because they have spent budget of their own and do not recover the moment it does. A test asserts that quotes is the worst thing on screen at that point. It is the most true-to-life part of the story.

## Feedback — names that look alike

`shipping-api` and `shipping-quotes` were hard to tell apart at a glance, which defeats the point of a board you read from across a room.

- [x] The checkout path is now `shipping`, `checkout`, `basket`, `orders`: different lengths, different first letters, no shared prefix
- [x] The untouched three are `search`, `accounts`, `reviews`
- [x] Dependency story is clearer for it: shipping cannot quote a delivery date, so checkout fails; the basket cannot show a total; orders cannot be placed
- [x] Exporter, dashboards, tests, docs and the GIF all follow
- [x] 250 unit tests, 15 end-to-end tests

Rule now written into the project guidance: keep every service name visually distinct. A shared prefix is the enemy of a board meant to be read at a glance.

## Feedback — transitions as a setting

- [x] `src/render/transitions.ts` holds four styles: Grow, Flash, Fade and None
- [x] Grow is the default: a box takes its space and gives it back, which is the treemap's own idiom
- [x] Flash also burns bright for a moment when something new breaks. It fires once per problem, never repeatedly, which is what separates it from the strobe the plan warns against.
- [x] **Departures are now animated at all**, which they were not before
- [x] Panel option under Display, so styles can be compared on the television
- [x] 261 unit tests, 15 end-to-end tests

**The point worth keeping.** Before this, a box vanished instantly when its problem cleared and the others slid into the hole. A disappearance was the most abrupt event on the board, while an arrival, the thing you actually want somebody to look up for, was the gentlest fade. That was backwards for a panel whose whole argument is that noise should track how bad things are.

React removes a box the moment its problem clears, so departing tiles are held in state for the length of their animation and drawn where they were, while the survivors move into the space immediately. A test asserts the survivors do not wait.

**Still open:** escalation. A warning turning critical is the most important event on the board and the least marked, just an instant colour change with no motion. Worth a one-shot pulse, and worth deciding in front of a screen.

## Feedback — the dashboards were out of date

Right, and worth understanding why rather than just fixing it.

Provisioned dashboards are hand-written JSON. When an option is added to the panel, existing dashboards do not gain it: the code falls back to a default and the settings sit empty in the editor. The main demo dashboard was still carrying only three of the twelve options the panel now understands, so none of the newer behaviour was visible or adjustable from it.

- [x] Swept every provisioned dashboard so each panel carries the full current option set
- [x] The live-query panel in the states dashboard was still sending the old service names; refreshed
- [x] New `noise is bad. — transitions` dashboard: the same scenario in all four styles at once, which is the only sensible way to choose between them. `make motion` opens it.
- [x] Verified in a real browser that boxes animate out: sampled a running board and caught 16 departures mid-animation across 4 frames

**The lesson, now written into the project guidance:** adding a panel option means sweeping the provisioned dashboards in the same change. Otherwise the feature exists, the tests pass, and nobody can see it.

## Bug — the transition styles were all identical

Reported from the transitions dashboard: all four panels looked the same.

**They were the same.** `NoisePanel` never passed `transitionStyle` to the treemap, so every board used the default. The option existed, the styles existed, the treemap honoured them, and the single line joining the two was missing.

Worse than the bug: the edit that was meant to add that line silently did not match, and the script that made it printed a success message anyway. It reported work it had not done.

- [x] The option is passed through, verified by reading the rendered classes in a browser
- [x] Three tests under "settings reaching the drawing code" cover the hand-off from panel to renderer
- [x] Proved the new test fails without the fix before keeping it
- [x] End-to-end test asserts the four styles produce four different results on screen
- [x] 264 unit tests, 16 end-to-end tests

Caught mid-flight in a real browser, the four now differ:

| Style | What was observed |
| --- | --- |
| Grow | scaling |
| Flash | scaling and a brightness pulse |
| Fade | scaling |
| None | nothing |

**Two lessons, both now in the project guidance.** Test the wiring and not just the component: a thoroughly tested renderer proves nothing if the option never reaches it. And never trust an edit that reports success without checking the anchor actually matched.

## Feedback — make the styles more extreme, driven by single numbers

- [x] Each style is now a record of named numbers in `SPECS`: arrive time, leave time, scale, brightness, easing. Nothing else defines it.
- [x] Values pushed apart so the styles are obviously different rather than merely different
- [x] Tests assert they stay apart: distinct arrival times, at least half a second between fastest and slowest, only Flash brightens, only Fade refuses to move
- [x] 277 unit tests, 16 end-to-end tests

Measured mid-animation in a real browser:

| Style | Arrive | Leave | Smallest scale seen | Brightest seen |
| --- | --- | --- | --- | --- |
| Grow | 420ms | 320ms | 0.08 | 1.0 |
| Flash | 750ms | 260ms | 0.35 | 3.6 |
| Fade | 950ms | 800ms | 1.00 | 1.0 |
| None | none | none | 1.00 | 1.0 |

### Three real findings that fell out of this

**The flicker test had been passing for the wrong reason.** It counted every element carrying a name, which after the departure work included boxes on their way out. Scoped to live boxes, it failed, and revealed that the demo checked its data every second, so two healthy checks spanned two seconds and a 1.5 second flap could empty the screen. The demo now checks every 2500ms, which is still far faster than a real dashboard. The rule now does what it claims.

**One test asserted something no longer true.** It claimed the first broken service gives up space when a second breaks. With continuous scoring, the first service is also getting worse in that scenario, so it can fairly keep its space. Rewritten to assert what must always hold: the services share out the whole board rather than stacking up or leaving it half empty. The comment says what is deliberately not asserted and why.

**One test was flaky rather than wrong**, waiting for exact box counts that depend on when checks land. It now watches for the count going up.

## Quiet mode — the Windows 3D Text screensaver

**Goal:** the other great office-television screensaver, alongside the DVD logo.

- [x] Researched the original rather than recalling it — Microsoft shipped the NT 4.0 source in the Win32 SDK
- [x] `src/render/spin.ts` — pure rotation, the original's Wobble, See-Saw and the later Spin
- [x] `src/render/ThreeDText.tsx` — layered CSS extrusion, reflective face, no library and no assets
- [x] `src/render/BouncingMark.tsx` — today's bouncing loop moved out intact; `QuietMode` is now just the choice
- [x] `quietMark` gains `3d`; free text and a rotation-style radio, as the original's dialog had
- [x] 39 new unit tests, 2 new e2e tests; 321 unit tests pass, lint clean
- [x] Provisioned panels on `quiet.json` and `states.json`

### Review

**Done.** Verified in a real browser: extruded walls appear and disappear as it turns, near letters project
larger than far ones, and the highlight slides with the angle.

**Decisions worth knowing**

- **The original's motion is a bounded swing, not a revolution.** See-Saw and Wobble never approach edge-on,
  which is also the only thing pure-CSS extrusion renders cleanly — past about 70° the layers thin to
  venetian blinds and at exactly 90° they have no area at all. Faithful and robust turned out to be the same
  choice. Spin ships too, because the real dialog had it from XP onward.
- **Two bugs that only a browser could find.** First, the text crossed the camera plane: turned side-on,
  half its width swings toward the viewer, and with a 90–130° field of view that is nearer than the camera.
  A word measured 3354px across on a 1280px screen. The camera is now placed from the text's own extent, so
  the near end magnifies about twice rather than infinitely. Second, the first pass was far too dark to read
  across an office — the sphere map really is dark sepia, but the original lights it and adds speculars.
- **Clipping the stage is safe, and I checked rather than assumed.** The flattening rule applies to an
  element's own `transform-style`; the stage's is already flat, so `overflow` has nothing to flatten. That
  is what keeps a long line of text off Grafana's chrome. An e2e test measures real depth so this stays
  honest.
- Speed is time-based. The original stepped per rendered frame with no time base, which is why it raced on
  fast hardware, and a television should not run the screensaver faster for having a better graphics chip.

## Feedback — ratios are the normal case, so expect them

Right, and this changes the defaults rather than adding an option.

Availability, good events over total events, is the ordinary shape of an SLO. The panel now expects it with no configuration at all: 1 is perfect, below 0.99 is a warning, below 0.95 is critical, smaller is worse. The old defaults, 1 and 2 with bigger being worse, described a status number, which is the rarer thing.

- [x] `DEFAULT_ADAPTER` expects availability; the panel options take their defaults from it rather than repeating the numbers
- [x] Direction-aware scoring moved into `src/noise/pressure.ts`, so the adapter and the demo share one implementation
- [x] Demo scenarios rewritten as availability ratios, so the demo speaks the panel's own defaults
- [x] Exporter publishes `demo_availability_ratio`; the real-data dashboard reads it with no threshold configuration
- [x] Adapter tests that describe the status-number shape now say so explicitly, rather than leaning on whatever the defaults happen to be
- [x] New tests for what happens with no configuration at all
- [x] 327 unit tests, 18 end-to-end tests

**The Sloth setup is now two settings.** Query `1 - slo:sli_error:ratio_rate1h`, set the name to `sloth_service`, done. That is the strongest argument for this change: the most common real setup needs no thresholds typed at all.

**A caution for later.** A wrong default here is worse than no default, because the failure is silent. Thresholds that can never be crossed leave the board quiet through an outage, and nobody goes looking at documentation when the screen looks calm.

## Brand — the static mark, in Grafana and in every screensaver

**Goal:** the chosen lockup (mark A, stacked Archivo Black) as the plugin logo, in the existing quiet marks, and as a new DVD-style mark.

- [x] `design/brand/generate.py` — pattern, outlined lockup, embedded font subset, plugin logo, README lockups
- [x] `src/img/logo.svg` is the mark on ink; Grafana's plugin page shows it
- [x] `src/render/brand.tsx` — `StaticMark`, `NibLockup`, `stackLines`, `lockupSize`, `ensureBrandFont`
- [x] Quiet mark `text` draws the lockup
- [x] ~~`logo`, the lockup with the DVD colour cycle~~ — removed at review; a saved `logo` value falls back to the calm lockup
- [x] 3D mark extrudes the lockup: static beside the text, stacked onto two lines, reflection across both
- [x] Unit and e2e coverage

### Review

**Done.** Checked in a real browser: the plugin page shows the mark, the lockup bounces and changes colour, and
the 3D mark extrudes the static with the words.

- **Outlines were verified against live text,** not trusted: the generated paths overlay the browser's own
  Archivo Black rendering at 76px with only an antialiasing fringe.
- **The 3D lockup was too small at first,** filling at most 66% of the panel with 56px to spare. Measured
  across 1100x560, 1920x1080 and 700x700, it now fills about 77% and never touches an edge.
- **A flaky treemap e2e test was a real test bug:** it read tile area the instant a tile appeared, while the
  grow transition was still animating it in. Under full-suite load that landed mid-animation. It now polls.



Per the plan, stop here before NIB-012 and the generic Grafana configuration.

- [ ] Put the panel fullscreen on an actual television
- [ ] Stand 5 to 10 metres away
- [ ] Work through: everything healthy, one warning, one critical, several incidents, a growing incident, a persistent incident, a flapping incident, partial recovery, full recovery
- [ ] Run it for at least 30 minutes
- [ ] Answer: **can I tell how bad things are without reading the screen?**

Every one of those states has a provisioned panel or a demo scenario already. `make tv` opens the panel fullscreen with no Grafana chrome.

If the answer is yes, continue with NIB-012 and NIB-013. If not, iterate on the visual behaviour first: Epic 7 lists area, colour, pulse, border and saturation as the channels worth testing for persistence, and only area is wired up today.

## 3D text — tumble like the XP screensaver

**Goal:** fix three problems seen on the television, against a supplied behaviour spec.

- [x] Wobble was a closed 9-second loop → independent constant speeds on all three axes, re-diced per run
- [x] Reflection jumped twice a cycle (`highlightAt` wrapped its angle) → computed lighting, continuous by construction
- [x] Swayed rather than spun → tumbles on one pivot at the centre
- [x] Back cap, lit sides, black void, bounding-sphere camera and fit
- [x] Size, depth, speed, material and colour settings; the rotation style radio removed
- [x] 365 unit tests, 19 e2e

### Review

**Done.** Measured rather than eyeballed:

| Check | Result |
| --- | --- |
| Face normal against `DOMMatrix`, 2000 orientations | worst error 1.2e-15 |
| Largest frame-to-frame lighting change, 60s | 3.1% of full brightness |
| Closest to the panel edge, 60s at 1920x1080 | 79px inside |
| Frame pacing with GPU, before / after | locked 60fps / locked 60fps, no dropped frames |
| Settings in the panel editor | all apply live |

- **The first lighting pass was wrong, and only a screenshot showed it.** Sides were lit by how far the face pointed away from the light, not by how much side was in view, so the lettering read as dark shapes on a bright slab and the highlight never appeared. Fixed by lighting the side actually visible and moving the key light near the line of sight.
- **Readability is the honest cost of the spec.** About 3% of the time, windows of about 5 seconds, a median of 2 minutes apart. Simulation showed the share does not depend on the speeds at all, only on tumbling freely. Measured alternatives, if that trade is ever wanted: dropping roll gives 7.1% with a median wait of 49s; dropping pitch gives 5.9% with 78s. Both are two-axis, which the spec's "pitch, yaw and/or roll" allows.

## Honest limits — one pair of levels, and a ceiling on boxes

Two of the five "ideal input" assumptions, each handled the way it should be. No ticket number: NIB-017 to
NIB-022 are already claimed below for different work.

**One pair of levels for the whole query** is documentation, because the answer is a choice the user makes.

- [x] `docs/metrics.md` explains it with worked numbers: checkout at 99.9% and search at 99%, both reading
      99.5%, mean opposite things, and no pair of levels reads both correctly
- [x] Two answers given: a panel per objective group, which needs nothing new, or a normalised number for
      teams that already publish one
- [x] Says plainly why the panel does not read per-service objectives from the data: it would have to guess
      which label holds them and over what window, and guessing wrong is a confidently wrong board
- [x] A "what you are responsible for" section covering units, direction, stable names, fresh data, and
      aggregating to one number per service

**No ceiling on boxes** is code.

- [x] `src/render/cap.ts`, pure and deterministic, keeps the worst
- [x] The ceiling counts every box including the one for the rest, so it is a real guarantee
- [x] Never silent: the rest share one box saying "+19 more, not shown", coloured and sized by the worst of them
- [x] Panel option, twenty by default, passed through with a wiring test that fails without the wiring
- [x] Every provisioned dashboard swept, plus a panel showing thirty broken services in twelve boxes
- [x] 391 unit tests, 20 end-to-end tests

### A silent bug this turned up

The wiring test for the cap failed with the wiring present, which turned out to be a different fault
entirely. `NoisePanel` kept its own copy of the adapter defaults. When the defaults changed to availability,
that copy was missed, so **a panel with no options set read a 90% availability as healthy**. A calm screen
during an outage, which is the worst thing this panel can do.

The panel now falls back to `DEFAULT_ADAPTER` and nothing else, and there are tests for an unconfigured panel
reading availability correctly. I put the old fallback back to confirm the test fails without the fix.

Thirteen existing panel tests had been passing *because of* that bug: they were written with status numbers
and relied on the stale fallback. They now speak availability, which is what the product promises.

**The lesson, worth keeping:** a default that exists in two places will drift, and when it drifts the failure
here is silence rather than an error.

## Next — get the code into the repository

`git@github.com:triwats/noise-is-bad.git` exists, `main` is pushed, and it contains **one file: `README.md`**.
Everything else is untracked. Nothing below is hard, but the order matters and the first step is a trap.

### First, stop `git add -A` being a disaster

Right now the working tree holds things that must never be committed, and `.gitignore` does not cover them.

- [ ] `.cache/` — **267MB**. Add to `.gitignore` before anything else.
- [ ] `triwats-noiseisbad-panel-*.zip` — two packaged builds, 117K and 120K. Ignore the pattern, not the files,
      so future builds are covered too.
- [ ] Check nothing else has appeared: `git status --short` should list only things you mean to publish.

### Then decide what is public

These are judgement calls, not chores, and they are easier now than after the first push.

- [ ] `tasks/todo.md` and `tasks/lessons.md` — the full development narrative, including mistakes and the
      reasoning behind the DVD logo. Publishing it is a legitimate choice and some projects do. Just choose it
      rather than discovering it.
- [ ] `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.claude/`, `.codex/` — agent scaffolding. Harmless, but they say
      how the project was built.
- [ ] `noise-is-bad-prototype-project-plan.md` — the original brief.
- [ ] `design/` — working design files, 5 canvases and the generator. Useful to a contributor, noisy to a user.

### Then commit and push

- [ ] Commit the source. One initial commit is fine; the history starts here either way.
- [ ] Push to `main`. **This is the first time CI has ever run.** The workflows came from the scaffold and have
      never been exercised, so expect something to fail on the first attempt and budget for it.
- [ ] Fix whatever CI finds, then confirm it is green before doing anything else.

### Then the things the repository unblocks

- [ ] Add the repository and documentation links to `plugin.json`, beside the existing sponsor links
- [ ] `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`
- [ ] A real `CHANGELOG.md` entry; it is still a three line stub
- [ ] The release workflow needs a Grafana signing key as a repository secret, which needs the Grafana Cloud
      organisation whose slug matches the `triwats` plugin id prefix

### Deferred by decision — the DVD logo

Credit it, do not block on it. Decided deliberately, not overlooked.

The DVD logo stays as the default quiet mark and stays credited in `THIRD_PARTY_NOTICES.md`, which names the
trademark holder and claims no licence. That is the right handling for a repository and for running it on your
own wall.

It becomes a live question again only at submission to the Grafana catalogue, where a third-party mark as the
shipped default is likely to be challenged. The escape hatch is already built and already tested: set the
quiet mark to `text` and the panel uses its own lockup. One default value, no code.

## Next — brand sheet and media pack

The assets exist; the sheet and the pack do not. Unnumbered on purpose: NIB-017 to NIB-022 are already claimed
below for different work.

**Why it matters now:** `plugin.json` still has `screenshots: []`, and Grafana's catalogue validator rejects a
submission without them. This is on the release path, not beside it.

### The brand sheet — `docs/brand/README.md`

Everything below already exists somewhere; the job is writing it down where another person can find it.

- [ ] The name is `noise is bad.` — lowercase, full stop included, everywhere a person reads it, including the
      start of a sentence. Identifiers are the only exception.
- [ ] Which lockup goes on which background: `lockup-dark.svg` and `lockup-light.svg`
- [ ] Colours, taken from `design/brand/generate.py` rather than retyped by eye
- [ ] Clear space and minimum legible size, taken from `design/Sizes.dc.html`
- [ ] The don'ts: do not title-case the name, do not recolour or stretch the lockup, do not put the light
      lockup on a light ground
- [ ] Where the assets live, and that `design/brand/generate.py` regenerates them
- [ ] The DVD logo is not ours: a registered trademark, credited in `THIRD_PARTY_NOTICES.md`, and not part of
      this brand

### The media pack — `docs/brand/media/`

- [ ] Screenshots from the running stack, not mockups: quiet mode, one incident taking the screen, the
      treemap, the cap with its "+19 more", and the panel on real Prometheus data
- [ ] 1920x1080 PNGs, plus whatever sizes the catalogue asks for
- [ ] The logo as PNG at 128, 256 and 512 alongside the SVGs
- [ ] A one-line and a one-paragraph description, written once and reused on GitHub, the catalogue and
      anywhere else, so they never drift
- [ ] A short README naming each file and the terms it may be used under

### `plugin.json`

- [ ] Populate `screenshots` with the pack's images
- [ ] Add repository and documentation links beside the existing sponsor links

### Order

Take the screenshots **after** the television test, not before. If the gate changes any visual behaviour, every
image in the pack is stale the moment it is shot.

## Next — NIB-017 to NIB-022, SLIs and SLOs

Queued behind the gate and behind Epic 10's Compose demo, because none of it can be tested without a real
Prometheus. Epic 12 of the plan has the reasoning; the short version is that the panel currently reads a
number that is already a severity, and nobody has that metric. What teams have is a recording rule producing
a ratio.

- [ ] **NIB-017** — threshold direction. `severityOf` only knows "at or above", so an availability of 0.5
      reads as healthy. Nothing else here works until this does.
- [ ] **NIB-018** — honour `field.config.unit`. `percentunit` is 0–1, `percent` is 0–100, and `0.5` is
      ambiguous between them. A percentage with no unit is unreadable, not healthy.
- [ ] **NIB-019** — name by label. A PromQL instant vector is named by its whole label set, which is
      unreadable at ten metres.
- [ ] **NIB-020** — objectives rather than thresholds. Same arithmetic, the vocabulary teams already use.
- [ ] **NIB-021** — example recording rules on the demo exporter. The panel must not compute SLIs: it gets
      one instant value per series and cannot window it, and `sli:` in the metric name keeps the contract
      visible.
- [ ] **NIB-022** — a provisioned SLO dashboard driven by real PromQL, with e2e.

Out of scope, deliberately: burn rate, error budgets, multi-window alerting. One instant value per service,
one objective.
