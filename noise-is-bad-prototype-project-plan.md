# noise is bad. --- Prototype Project Plan

## Goal

Build a Grafana panel that answers one question from across an office:

> **How bad are things right now?**

The screen should become more visually noisy as operational problems
increase.

The prototype is successful if someone can see the demo for \~10 seconds
and immediately understand what it does.

------------------------------------------------------------------------

## Core Behaviour

``` text
ALL HEALTHY
    ↓
DVD / quiet mode

1 UNHEALTHY
    ↓
Problem takes the screen

2 UNHEALTHY
    ↓
Screen dynamically splits

3+ UNHEALTHY
    ↓
Dynamic treemap

PROBLEMS PERSIST
    ↓
Visual pressure increases

PROBLEM RECOVERS
    ↓
Tile disappears
Remaining problems expand

ALL RECOVER
    ↓
Return to DVD
```

The display is **not a representation of the entire estate**.

Healthy things aren't shown.

The available screen is entirely allocated to things currently deserving
attention.

------------------------------------------------------------------------

## Epic 1 --- Grafana Plugin Skeleton

### Objective

Get the smallest possible custom Grafana panel running.

Use Grafana's official plugin tooling and create a React/TypeScript
panel plugin.

``` text
noise-is-bad/
├── src/
│   ├── module.ts
│   ├── NoisePanel.tsx
│   ├── types.ts
│   └── components/
├── plugin.json
├── package.json
└── README.md
```

Initially it can simply render:

``` text
noise is bad.

3 signals received
```

### Done When

-   Plugin runs locally inside Grafana.
-   Panel receives Grafana data.
-   Panel responds correctly to resizing.

------------------------------------------------------------------------

## Epic 2 --- Define the Initial Data Contract

Do not attempt to solve arbitrary Grafana data yet.

Start with:

``` ts
interface NoiseSignal {
  name: string;
  severity: number;
}
```

Severity:

``` text
0 = healthy
1 = warning
2 = critical
```

Example:

``` text
checkout     2
search       1
kafka        0
```

Healthy signals are removed before layout.

Internally transform these into a richer state model:

``` ts
interface NoiseItem {
  id: string;
  name: string;
  severity: 1 | 2;
  firstSeen: number;
  lastSeen: number;
  persistence: number;
  pressure: number;
}
```

Keep Grafana parsing separate from the actual visualisation engine.

### Done When

Changing query values reliably creates, updates and removes `NoiseItem`
objects.

------------------------------------------------------------------------

## Epic 3 --- Build a Simulator

This should be an early priority.

Add a development/demo mode:

``` text
Demo Mode

[ All Quiet ]
[ One Warning ]
[ One Critical ]
[ Two Problems ]
[ Growing Incident ]
[ Major Incident ]
[ Recovery ]
[ Chaos ]
```

Ideally allow individual signals to be manipulated:

``` text
Checkout

○ Healthy
○ Warning
● Critical

Age
[────────●──] 180 sec
```

This allows development without constantly creating real Prometheus
alerts.

Later, this simulator can also become part of the public demo.

### Done When

The entire noise is bad. lifecycle can be demonstrated without a real
datasource.

------------------------------------------------------------------------

## Epic 4 --- Quiet Mode

When:

``` text
unhealthy.length === 0
```

render the quiet state.

``` text
┌──────────────────────────────────────────┐
│                                          │
│       NIB                                │
│          ↘                               │
│                                          │
│                                          │
│                                          │
└──────────────────────────────────────────┘
```

Implement the bouncing DVD-style object using `requestAnimationFrame`.

Originally: use an original noise is bad. mark rather than the DVD trademark/logo.

**Superseded.** Both ship, as the `quietMark` panel option, and the DVD logo is the default. It changes colour on every wall it hits, which is the half of the joke that matters. The wordmark below remains available. The logo is a trademark of DVD Format/Logo Licensing Corporation; it is kept deliberately and credited, not licensed: the risk that the Grafana catalog review rejects it, or Grafana removes the plugin later, is accepted, and it is credited in `THIRD_PARTY_NOTICES.md`.

For example:

``` text
noise
is
bad.
```

Initial configuration:

``` text
Quiet mode: enabled
```

### Done When

-   Zero unhealthy signals triggers quiet mode.
-   Animation works indefinitely.
-   Panel resizing doesn't break the animation.
-   Animation doesn't leak resources.

------------------------------------------------------------------------

## Epic 5 --- Single Incident Mode

A single incident gets special treatment.

If:

``` text
unhealthy.length === 1
```

do not render a treemap.

Give the incident the whole display:

``` text
┌──────────────────────────────────────────┐
│                                          │
│                                          │
│                CHECKOUT                  │
│                                          │
│                CRITICAL                  │
│                                          │
│                                          │
└──────────────────────────────────────────┘
```

This establishes the fundamental rule:

> **The screen represents available attention, not infrastructure
> topology.**

Warning and critical states should be visually distinct.

Avoid adding graphs, values, timestamps or detailed explanations.

### Done When

One unhealthy signal completely replaces quiet mode.

------------------------------------------------------------------------

## Epic 6 --- Dynamic Multi-Problem Layout

Introduce a treemap-style layout when multiple things require attention.

Input:

``` text
checkout    pressure=80
search      pressure=20
kafka       pressure=40
```

Approximate output:

``` text
┌─────────────────────────────┬────────────┐
│                             │            │
│                             │   KAFKA    │
│          CHECKOUT           │            │
│                             ├────────────┤
│                             │   SEARCH   │
└─────────────────────────────┴────────────┘
```

Use an existing treemap layout library.

Do not spend prototype time inventing rectangle-packing algorithms.

### Dynamic Behaviour

When a new incident appears:

-   Existing rectangles resize.
-   New rectangle enters.
-   Screen space is redistributed.
-   Entire layout should not flash/re-render abruptly.

Target transition:

``` text
300–800ms
```

Enough to perceive movement without making the dashboard feel sluggish.

### Done When

Adding and removing signals results in smooth redistribution of screen
space.

------------------------------------------------------------------------

## Epic 7 --- Visual Pressure

This is one of the major experiments the prototype needs to test.

Start with:

``` text
pressure =
  severityWeight
  × persistenceWeight
```

Example severity weights:

``` text
warning     1
critical    3
```

Example persistence:

``` text
<30 sec      1.0
30–120 sec   1.2
2–5 min      1.5
5+ min       2.0
```

Therefore:

``` text
critical incident lasting 5 minutes

3 × 2 = 6
```

Compared with:

``` text
new warning

1 × 1 = 1
```

The critical incident therefore receives substantially more screen
space.

### Pressure Experiments

Do not assume that increasing area with persistence is automatically the
correct behaviour.

Test several approaches:

-   **Area** --- persistence increases tile size.
-   **Colour** --- persistence increases colour intensity.
-   **Pulse** --- persistent incidents begin to pulse or breathe.
-   **Border** --- persistent incidents receive increasingly prominent
    borders.
-   **Saturation** --- persistent incidents become visually stronger.

The prototype should determine which behaviour works best from across an
actual office.

------------------------------------------------------------------------

## Epic 8 --- Refresh Behaviour and Hysteresis

Grafana will continually refresh its data.

Noise should maintain state between refreshes rather than rebuilding
everything.

Example:

``` text
checkout

refresh 1    critical    firstSeen = 14:02:00
refresh 2    critical    firstSeen = 14:02:00
refresh 3    critical    firstSeen = 14:02:00
refresh 4    healthy
```

This allows Noise to calculate persistence.

### Recovery Hysteresis

Avoid rapidly switching between incident and quiet mode.

Bad:

``` text
████████
   DVD
████████
   DVD
████████
```

For the prototype, start with:

``` text
New bad state
→ display immediately

Recovery
→ require 2 consecutive healthy refreshes
```

Later this behaviour can become configurable.

### Done When

Flapping metrics don't cause distracting layout changes.

------------------------------------------------------------------------

## Epic 9 --- Basic Grafana Configuration

Only after the visual engine works should the data input become more
generic.

Initial configuration:

``` text
DATA

Name
[ service        ▾ ]

Value
[ status         ▾ ]


THRESHOLDS

Warning
[ 1 ]

Critical
[ 2 ]


DISPLAY

Quiet mode
[✓]

Persistence
[✓]

Transition
[ 500ms ]
```

For time-series data, support a simple reduction:

``` text
Value calculation

● Last
○ Max
○ Mean
```

This provides enough flexibility for real-world testing without trying
to support every Grafana datasource shape.

------------------------------------------------------------------------

## Epic 10 --- Real Prometheus Example

Prove that Noise works with real observability infrastructure.

Create a Docker Compose demo containing:

``` text
Grafana
Prometheus
noise is bad.
Demo metrics exporter
```

The exporter could expose:

``` text
demo_service_health{service="checkout"} 0
demo_service_health{service="auth"} 0
demo_service_health{service="search"} 0
```

Provide a mechanism for simulating:

``` text
checkout → critical
search → warning
checkout → healthy
everything → healthy
```

A developer should eventually be able to run:

``` bash
docker compose up
```

and immediately see noise is bad. working.

### Done When

Someone unfamiliar with the project can run the demo locally without
configuring their own observability infrastructure.

------------------------------------------------------------------------

## Epic 11 --- Create the Killer Demo

The demo itself is a major project deliverable.

Record a 15--20 second sequence.

``` text
0:00

       noise is bad.
             ↘


0:03

CHECKOUT
WARNING


0:06

CHECKOUT
CRITICAL


0:09

CHECKOUT       SEARCH
CRITICAL       WARNING


0:12

CHECKOUT    SEARCH
            KAFKA


0:15

checkout recovers

SEARCH         KAFKA


0:18

all recover


          noise is bad.
                ↗
```

The GIF/video should appear at the very top of the GitHub README.

Before:

-   Installation instructions
-   Architecture
-   Configuration
-   Grafana explanation

The demo is the pitch.

------------------------------------------------------------------------

## Epic 12 --- SLIs, SLOs and PromQL

Sequenced after Epic 10. Everything here needs a real Prometheus to
test against, and none of it should start before the prototype gate.

The prototype reads a number that is already a severity: 0, 1 or 2.
Almost nobody has that metric. What teams actually have is an SLI --- a
ratio, produced by a recording rule, that says what fraction of
something worked. Four things have to change before a PromQL query can
drive this screen honestly.

### The four problems

**Direction.** Availability is bad when it goes *down*. `severityOf`
only knows "at or above", so an availability of 0.5 reads as healthy.
That is the same class of lie as `Number(null)` being 0, and worse,
because it looks deliberate.

**Scale.** `0.9995` and `99.95` are the same claim, and `0.5` is
ambiguous between them. Grafana already knows which is meant, in
`field.config.unit`: `percentunit` for 0--1, `percent` for 0--100. Read
it, and refuse to read a percentage with no unit rather than guess.

**Names.** A PromQL instant vector names its series with the whole label
set:

``` text
{__name__="sli:availability:ratio_rate5m", service="checkout", job="api", instance="10.0.0.4:9090"}
```

At ten metres that is a wall of noise. The panel has to name by one
label.

**The comparison.** An SLI is not compared to a threshold, it is
compared to an objective. "99.9% availability" is how the team already
writes it down, and it makes 99.95% healthy and 99.5% a breach. The
arithmetic is the same; the vocabulary is not.

### Recording rules are the contract

**The panel does not compute SLIs.** Prometheus does, in recording
rules, and the panel reads the result. Three reasons: the panel gets one
instant value per series and cannot window it; recording rules are
already where teams keep this definition; and a `sli:` prefix makes the
contract visible in the metric name rather than buried in a dashboard.

``` yaml
groups:
  - name: sli
    interval: 30s
    rules:
      - record: sli:availability:ratio_rate5m
        expr: |
          sum by (service) (rate(http_requests_total{code!~"5.."}[5m]))
          /
          sum by (service) (rate(http_requests_total[5m]))
```

Which makes the panel's query the whole of the configuration:

``` text
Query        sli:availability:ratio_rate5m
Type         Instant
Name by      service
Unit         percentunit
Direction    below is worse
Objective    0.999
Critical at  0.99
```

Instant, not range: a wallboard wants one number per service now, and
the recording rule has already done the windowing.

### Not in scope

Multi-window multi-burn-rate alerting, error-budget accounting, burn
rate as a displayed quantity, and anything that needs history. "Complex
SLO logic" stays out of scope. This epic is one instant value per
service, compared against one objective.

### Done When

-   A PromQL query of a recording-rule SLI drives the screen.
-   99.99% availability is quiet; 98% is critical.
-   A percentage with no unit reports as unreadable, never as healthy.
-   Names on the screen read `checkout`, not a label set.

------------------------------------------------------------------------

## Prototype Architecture

Keep the system separated into four major pieces.

``` text
Grafana DataFrame
       │
       ▼
┌─────────────────────┐
│ Signal Adapter      │
│                     │
│ Grafana → signals   │
└──────────┬──────────┘
           │
           ▼
      NoiseSignal[]
           │
           ▼
┌─────────────────────┐
│ State Engine        │
│                     │
│ firstSeen           │
│ persistence         │
│ hysteresis          │
│ severity            │
│ pressure            │
└──────────┬──────────┘
           │
           ▼
       NoiseItem[]
           │
           ▼
┌─────────────────────┐
│ Layout Engine       │
│                     │
│ 0 → quiet           │
│ 1 → fullscreen      │
│ 2+ → treemap        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Renderer            │
│                     │
│ animation           │
│ typography          │
│ colours             │
│ transitions         │
└─────────────────────┘
```

Keep these boundaries.

If noise is bad. eventually becomes something larger than a Grafana
plugin, the interesting components --- State Engine, Layout Engine and
Renderer --- should not be tightly coupled to Grafana.

------------------------------------------------------------------------

## Initial Engineering Tickets

### Foundation

#### NIB-001 --- Scaffold Grafana panel plugin

Create the React/TypeScript Grafana panel and local development
environment.

#### NIB-002 --- Add demo signal generator

Create fake health signals for rapid visual development.

#### NIB-003 --- Implement signal adapter

Normalise Grafana DataFrames into:

``` ts
NoiseSignal[]
```

### Quiet State

#### NIB-004 --- Implement quiet state

Render quiet mode when no unhealthy signals exist.

#### NIB-005 --- Implement bouncing NIB mark

Create the DVD-style screensaver animation.

### Incident Display

#### NIB-006 --- Implement single-incident fullscreen state

One problem occupies the full display.

#### NIB-007 --- Implement multi-incident treemap

Two or more problems dynamically divide available screen space.

#### NIB-008 --- Animate layout transitions

Smoothly animate tiles when incidents appear, disappear or change
importance.

### Dynamic State

#### NIB-009 --- Track incident persistence

Maintain `firstSeen` and duration across Grafana refreshes.

#### NIB-010 --- Calculate visual pressure

Calculate pressure using severity and persistence.

#### NIB-011 --- Add recovery hysteresis

Prevent flapping metrics from constantly changing the display.

### Grafana Integration

#### NIB-012 --- Add field selection

Allow users to select the signal name/value fields.

#### NIB-013 --- Add threshold configuration

Allow users to define warning and critical thresholds.

### Demo Environment

#### NIB-014 --- Build Prometheus demo exporter

Expose fake service-health metrics.

#### NIB-015 --- Build Docker Compose demo

Provide Grafana + Prometheus + noise is bad. in one development
environment.

#### NIB-016 --- Create README and demo

Create documentation and the primary animated demo.

### SLIs and SLOs

#### NIB-017 --- Add threshold direction

Let a signal be bad when it falls rather than when it rises. Without it
no availability SLI can be read at all.

#### NIB-018 --- Honour the field's unit

Normalise `percentunit` (0--1) and `percent` (0--100) to one internal
scale. A percentage with no unit is unreadable, not healthy.

#### NIB-019 --- Name series by label

Pick the label that names a service, and fall back to the display name.
A wallboard cannot show a label set.

#### NIB-020 --- Express thresholds as an objective

Configure warning and critical as an SLO objective and a critical
margin, in the vocabulary teams already use.

#### NIB-021 --- Ship example recording rules

Extend the demo exporter with SLI metrics and the recording rules that
turn them into `sli:*` ratios, as the documented contract.

#### NIB-022 --- Provision an SLO dashboard

A provisioned dashboard driven by real PromQL against the Compose
Prometheus, and e2e coverage that a breaching objective reaches the
screen.

------------------------------------------------------------------------

## Prototype Gate

Stop after:

``` text
NIB-011
```

before investing heavily in generic Grafana integration.

Put the prototype fullscreen on an actual television.

Stand approximately 5--10 metres away.

Simulate:

-   Everything healthy
-   One warning
-   One critical
-   Multiple incidents
-   A growing incident
-   A persistent incident
-   A flapping incident
-   Partial recovery
-   Full recovery

Run it for at least 30 minutes.

Ask:

> **Can I tell how bad things are without reading the screen?**

If the answer is yes, continue with the Grafana integration: NIB-012
and NIB-013 first, then Epic 10's Compose demo, and NIB-017 to
NIB-022 on top of it. The SLI work needs a real Prometheus to test
against, so it follows the demo environment rather than preceding it.

If not, iterate on the visual behaviour before building additional
functionality.

------------------------------------------------------------------------

## Explicitly Out of Scope

Do **not** build during the prototype:

-   SaaS
-   Accounts
-   Billing
-   Multi-TV management
-   Datadog integration
-   PagerDuty integration
-   Sentry integration
-   Alertmanager integration
-   Historical Noise score
-   Custom screensavers
-   SSO
-   RBAC
-   Mobile UI
-   Incident acknowledgement
-   Notifications
-   Complex SLO logic (burn rate, error budgets, multi-window alerting ---
    see Epic 12 for the simple objective comparison that is in scope)
-   AI features
-   Service topology
-   Dependency mapping
-   Complex weighting formulas
-   Large numbers of configuration options

Grafana is initially the integration layer.

noise is bad. is initially just a panel.

------------------------------------------------------------------------

## Prototype Success Criteria

The prototype succeeds if:

1.  Healthy infrastructure results in a calm/quiet display.
2.  A single incident immediately takes over the display.
3.  Additional incidents dynamically divide the available space.
4.  More severe/persistent incidents receive greater visual attention.
5.  Layout changes are smooth rather than distracting.
6.  Flapping metrics don't make the display chaotic.
7.  Recovery visibly reduces noise.
8.  Full recovery returns the display to quiet mode.
9.  The display can be understood from across an office.
10. Someone understands the concept after seeing a \~10-second demo.

The ultimate test is:

> **Can I tell how bad things are without reading the screen?**
