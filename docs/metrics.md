# What to feed noise is bad.

The whole contract in one sentence:

> Give the panel an availability per service, where 1 is perfect and smaller is worse.

That is the default. Point it at an availability query, tell it which column or
label holds the service name, and change nothing else.

Availability is good events over total events, which is the ordinary shape of an
SLO and what most people already compute. Out of the box, below 99% is a warning
and below 95% is critical.

## Other shapes

The same panel reads anything else you already have. Set the two levels in
whatever units your query returns and say which way the number runs.

| What you have | Worse when | Warning | Critical |
| --- | --- | --- | --- |
| **Availability, ratio** | **Lower** | **0.99** | **0.95** |
| Availability, percent | Lower | 99 | 95 |
| Error budget remaining, ratio | Lower | 0.5 | 0.1 |
| Error budget burned, percent | Higher | 50 | 90 |
| Burn rate | Higher | 6 | 14.4 |
| Plain status number | Higher | 1 | 2 |

The burn rate levels are the usual multi-window multi-burn-rate numbers: 14.4x
is the rate that would exhaust a 30-day budget in two days, which is normally
the point at which somebody gets paged.

**Availability is the shape to reach for.** It needs no configuration, it is
comparable across services of wildly different traffic, and a percentage needs
no explanation to anybody walking past the screen.

## Sloth

Sloth's generated recording rules already contain everything the panel needs.
Nothing has to be rewritten.

**Availability**, which needs no threshold configuration at all:

| Setting | Value |
| --- | --- |
| Query | `1 - slo:sli_error:ratio_rate1h` |
| Name | `sloth_service` |

That is the whole setup. Sloth publishes the error ratio, so one minus it is the
availability, and the panel's own defaults take it from there.

**Error budget left**, if you would rather see cumulative damage than the
current rate:

| Setting | Value |
| --- | --- |
| Query | `slo:period_error_budget_remaining:ratio` |
| Name | `sloth_service` |
| Worse when | Lower |
| Warning | `0.5` |
| Critical | `0.1` |

The value goes negative once an SLO is blown through, and the panel handles
that: further below zero simply scores higher.

**Burn rate**, if you want to see what is happening right now:

| Setting | Value |
| --- | --- |
| Query | `slo:current_burn_rate:ratio` |
| Name | `sloth_service` |
| Worse when | Higher |
| Warning | `6` |
| Critical | `14.4` |

Setting **Name** to `sloth_service` is the whole trick. Sloth hangs its labels
off the series rather than giving them columns, so telling the panel which label
holds the name saves you setting a legend format on every query. Use
`sloth_slo` instead if one service has several objectives and you want them
drawn separately.

This is not a claim made from reading the documentation. The demo in this
repository publishes metrics under exactly these names and labels, and the
provisioned **noise is bad. Sloth** dashboard reads them with no legend format
set at all.

## Pyrra

Pyrra publishes an availability ratio and the objective each SLO is held to.
Budget left is the gap between them, over the budget:

```promql
(pyrra_availability - pyrra_objective) / (1 - pyrra_objective)
```

Set **Name** to `slo`, **Worse when** to `Lower`, warning `0.5` and critical
`0.1`, exactly as for Sloth.

Metric and label names have moved between Pyrra versions, so check what your
install actually exposes on `/metrics` before copying this. The arithmetic is
the part that matters and it does not change.

## Rolling your own

If you have no SLO tooling, two recording rules get you there.

**Availability**, straight from request counts:

```promql
sum by (service) (rate(http_requests_total{code!~"5.."}[1h]))
  / sum by (service) (rate(http_requests_total[1h]))
```

That needs no threshold configuration. The panel's defaults already expect it.

**Error budget burned, as a percentage**, for a 99.9% objective over 30 days:

```promql
100 * (
  sum by (service) (rate(http_requests_total{code=~"5.."}[30d]))
  / sum by (service) (rate(http_requests_total[30d]))
) / (1 - 0.999)
```

**Burn rate over the last hour**, same objective:

```promql
(
  sum by (service) (rate(http_requests_total{code=~"5.."}[1h]))
  / sum by (service) (rate(http_requests_total[1h]))
) / (1 - 0.999)
```

Change `0.999` to match your objective, and `service` to whatever label holds
your service name.

## One set of levels for the whole query

This is the limit worth understanding before you wire anything up.

You set one warning level and one critical level, and they apply to every
service the query returns. Real estates do not work that way. If checkout is
held to 99.9% and search is held to 99%, then both sitting at 99.5% mean
opposite things: checkout has blown through its objective, search is comfortably
meeting its own.

There is no pair of levels that reads both correctly.

| Levels you set | What happens to checkout, target 99.9% | What happens to search, target 99% |
| --- | --- | --- |
| Warning 0.99 | Nothing. Its outage is invisible. | Correct, it is fine. |
| Warning 0.999 | Correct, it is in trouble. | Shows a warning while meeting its target. |

Either the strict service's outage is silent, or the relaxed service cries wolf.
Both are bad, and the second is worse, because a board that shows a problem
where there is none stops being believed.

### What to do about it

**If your services share an objective, you have no problem.** Point the panel at
availability and use the defaults. This is most teams, most of the time.

**If they do not, put each group on its own panel.** One panel for everything
held to 99.9% and another for everything held to 99%, each with its own levels,
is the simplest fix and needs nothing you do not already have. Two panels
side by side on a television read perfectly well.

**If you already publish a normalised number, use that instead.** Error budget
remaining and burn rate are both measured against each service's own objective,
which makes them directly comparable no matter what each service is held to.
One set of levels then works across the whole estate, because the number has
already done the normalising. The tables above show the levels to use.

The panel deliberately does not read per-service objectives from your data. It
would have to guess which label holds them and what window they apply over, and
guessing wrong here produces a confidently wrong board, which is worse than a
limitation you know about.

## What you are responsible for

The panel cannot check these for you. They are worth ten minutes before you put
it on a wall.

**The levels match the units of your query.** The defaults expect a ratio, where
1 is perfect. Point the panel at a percentage and leave them at 0.99 and nothing
can ever cross a threshold: the board sits quiet through an outage. If the board
has never once lit up, this is why.

**The direction matches your metric.** Availability and budget remaining fall as
things get worse. Burn rate and budget burned rise. Get this backwards and the
board inverts: healthy services light up and broken ones vanish.

**The service name is stable.** The panel measures how long a problem has lasted
by tracking each service by name. If the name is the whole label set, a pod
restart looks like one problem clearing and a different one starting, and
nothing ever ages. Set the **Name** setting to a label, or set a legend format.

**The data is fresh.** The panel reads the last valid value and has no notion of
how old that is. A service whose metric stopped reporting an hour ago still
shows its last good reading. Alert on your exporters being up; this panel is not
that alarm.

**The query returns services, not series.** One number per service. A query that
returns a series per pod per endpoint will fill the board with things nobody can
act on. Aggregate first.

## When a lot is broken at once

There is a ceiling on how many boxes appear, twenty by default, because a
treemap of three hundred boxes is not a picture of anything.

Past the ceiling the worst problems keep their own box and everything else is
gathered into one last box that says how many more there are. Nothing is dropped
silently. The ceiling counts every box including that one, so setting it to
twenty means never more than twenty boxes, and you can change it under
**Most boxes on screen**.

The box standing in for the rest takes the colour and size of the worst thing
inside it, so a critical is never hidden behind a warning.

## Panel settings

| Setting | What to set it to |
| --- | --- |
| Name | The column or label holding the service name: `service` for a table, `sloth_service` for Sloth, `slo` for Pyrra. Leave empty to use the first text column. |
| Most boxes on screen | The ceiling on boxes. The rest share one that says how many more. |
| Value | The column holding the number. Leave empty to use the first number column. |
| Value to use | `Last` for a current reading. `Worst` if you would rather not miss a spike between refreshes. |
| Worse when | `Higher` for budget burned and burn rate. `Lower` for budget remaining and compliance. |
| Warning, Critical | From the table above, in whatever units your query returns. |

If you set **Name** to a label, you do not need a legend format. If you leave
it empty on a Prometheus query, set the legend to `{{service}}` so the panel has
something clean to draw.

## How a number becomes a box

1. **Below the warning level** (or above it, when smaller numbers are worse), a
   service scores nothing and is never drawn. Healthy services do not take up
   screen.
2. **At the warning level** it scores 1. **At the critical level** it scores 3.
   Between them it rises smoothly, and past critical it keeps rising at the same
   rate up to a cap of 9.
3. **The score is multiplied by how long the problem has lasted**: 1.0 under 30
   seconds, 1.2 to two minutes, 1.5 to five, and 2.0 beyond. This can be turned
   off with the "Grow with age" setting.
4. **The result decides the share of screen** and how strongly the box is
   filled. A service that has burned 99% of its budget takes visibly more room
   than one that has burned 91%, which is the whole reason the panel reads a
   number rather than a status.

The cap matters. Without it a service burning its budget a hundred times over
would take the entire screen and hide everything else, which is the opposite of
what a board like this is for.

## Two behaviours worth knowing

**A service that reads healthy stays on screen for two more refreshes** before
its box goes. A service flicking between broken and fixed therefore does not
make the screen flash.

**A service that disappears from the query entirely is kept, not cleared.** A
metric going missing is not the same as a problem being fixed, and a board that
quietly drops an incident because its target stopped reporting is lying to the
room.

## What about alerts?

You can point the panel at alerts, but it is not the recommended default.

`ALERTS{alertstate="firing"}` always has the value 1, with the severity in a
label, so there is no number to size a box by: everything comes out the same and
the treemap stops saying anything. It also makes this an alert list, which is a
thing you already have.

Reading severity from a label is planned. Until then, if alerts are all you
have, a recording rule that maps severity to a number works today:

```promql
count by (service) (ALERTS{alertstate="firing", severity="critical"}) * 2
  or
count by (service) (ALERTS{alertstate="firing", severity="warning"})
```

with the warning level at 1 and critical at 2.

## Trying it without any of this

The panel ships a set of built-in examples. Set **Demo** to *Shipping Incident*
and it runs a whole incident with no query at all: shipping starts missing its
objective, and checkout, the basket and orders follow it down while the rest of
the shop carries on as normal.

The repository also includes a pretend estate of seven services that publishes
every shape on this page, including Sloth's, so you can see the real wiring end
to end before touching your own metrics.
