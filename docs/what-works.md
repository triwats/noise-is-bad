# What data works

noise is bad. does not read every metric. It needs a particular kind of number,
and most of what a Prometheus server holds is not that kind. This page is the
quick answer to "will my data work?", followed by exactly how the demo in this
repository is wired, so you can copy the setup.

For every input shape and the arithmetic behind it, see
[the metrics guide](metrics.md).

## The three-question test

A query works if you can answer yes to all three.

1. **Does it return one number per service?** Not per pod, per endpoint or per
   request. One row, or one series, for each thing someone would fix.
2. **Is it clear which way is worse?** Lower availability is worse. A higher
   burn rate is worse. If "is 400 bad?" depends on the time of day or how busy
   the service is, the answer is no.
3. **Can you name a level where someone should act?** A warning level and a
   critical level, in the query's own units, that mean the same thing for every
   service the query returns.

Availability, error budget and burn rate pass all three by construction, which
is why they are the recommended inputs. Most other metrics fail at least one.

## What works, and what does not

| Metric | Works? | Why | What to use instead |
| --- | --- | --- | --- |
| Availability ratio (good over total) | **Yes, the default** | One number per service, 1 is perfect, no configuration | — |
| Error budget remaining or burned | **Yes** | Already normalised against each service's own objective | — |
| Burn rate | **Yes** | Same, and it reacts faster than the budget | — |
| Sloth or Pyrra recording rules | **Yes** | They are one of the three above, with the names already on labels | — |
| `avg by (job) (up)` | **Yes** | The fraction of targets up: 1 is perfect, and the defaults read it as is | — |
| A 0 / 1 / 2 status number | **Yes** | Set warning 1, critical 2, higher is worse | — |
| A SQL table with a name column and a number column | **Yes** | The first text column names things, the first number column scores them | — |
| p99 latency via `histogram_quantile` | **With care** | Works, but every service gets the same latency levels | One panel per group with a shared latency target |
| A raw counter, like `http_requests_total` | **No** | It only ever goes up. The number means nothing on its own | A ratio of two `rate()`s: good over total |
| Error count or error rate on its own | **No** | Busy services look worse than quiet ones at the same failure rate | Errors over total requests |
| Histogram buckets (`_bucket`) | **No** | Many series per service, none of them a reading | `histogram_quantile`, or better, a latency SLI ratio |
| Per-pod or per-instance series | **No** | Fills the board with things nobody can act on, and resets whenever a pod restarts | `sum by (service)` or `avg by (service)` first |
| CPU, memory, disk | **Reads, but tells the wrong story** | A busy machine is not an outage. The board lights up while users are fine | What users feel: availability, latency |
| `ALERTS` | **Not usefully** | Always 1, so every box is the same size and it becomes an alert list | A recording rule mapping severity to a number, in [the metrics guide](metrics.md#what-about-alerts) |
| Text statuses like `"DEGRADED"` | **No** | The panel reads numbers. A Grafana value mapping changes the label shown, not the value | Map to a number in the query: `CASE status WHEN 'DOWN' THEN 2 …` |
| Services held to different objectives, as raw availability | **Not with one panel** | One pair of levels cannot read a 99.9% and a 99% service correctly at once | Budget or burn rate, or a panel per objective. [Worked through here](metrics.md#one-set-of-levels-for-the-whole-query) |

When a query gives the panel nothing it can read, the panel says so. It does
not fall into the screensaver. A blank, calm screen always means healthy, never
"could not tell".

## How the demo is set up

`make setup` brings up the same chain you would build yourself, with a pretend
shop standing in for your services. Every link is a file in this repository.

```
demo/exporter  ──scrape every 5s──▶  Prometheus  ──query──▶  Grafana  ──▶  noise is bad.
 (seven services)                    :9090                   :3000         panel
 :9101
```

### 1. Something publishes a number per service

[`demo/exporter/exporter.js`](../demo/exporter/exporter.js) plays the part of
your services. It publishes each shape from the table above, one series per
service, with the service on a label:

```
# HELP demo_availability_ratio Good events over total events. 1 is perfect, lower is worse.
# TYPE demo_availability_ratio gauge
demo_availability_ratio{service="shipping"} 0.94
demo_availability_ratio{service="checkout"} 0.984
demo_availability_ratio{service="basket"} 0.9999
demo_availability_ratio{service="orders"} 0.9999
demo_availability_ratio{service="search"} 0.9999
demo_availability_ratio{service="accounts"} 0.9999
demo_availability_ratio{service="reviews"} 0.9999
```

Shipping is critical (below 0.95), checkout is a warning (below 0.99), and the
other five are healthy, so they never appear on screen.

**In your estate this step is a recording rule**, not an exporter. The panel
never computes an SLO itself; something upstream does and the panel reads the
answer. The rule that produces this exact shape from request counts is:

```yaml
groups:
  - name: availability
    rules:
      - record: service:availability:ratio_rate5m
        expr: |
          sum by (service) (rate(http_requests_total{code!~"5.."}[5m]))
            / sum by (service) (rate(http_requests_total[5m]))
```

If you run Sloth or Pyrra, you already have this and can skip to step 3.

### 2. Prometheus scrapes it

[`demo/prometheus/prometheus.yml`](../demo/prometheus/prometheus.yml) scrapes
the exporter every five seconds. That is fast on purpose, so the demo reacts
while someone is watching. Your existing Prometheus and its interval are fine.

### 3. Grafana has Prometheus as a data source

[`provisioning/datasources/datasources.yml`](../provisioning/datasources/datasources.yml)
adds it. Any Prometheus-compatible source works: Mimir, Thanos, VictoriaMetrics,
Grafana Cloud.

### 4. The panel queries it, with default settings

The **noise is bad. real data** dashboard
([`provisioning/dashboards/prometheus.json`](../provisioning/dashboards/prometheus.json))
holds one panel set up like this:

| Setting | Value |
| --- | --- |
| Query | `demo_availability_ratio` |
| Legend | `{{service}}` |
| Demo | Live data |
| Everything else | Left at its default: lower is worse, warning 0.99, critical 0.95 |

That is the whole setup. The legend is only there to give each box a short
name; without it Prometheus names a series by its entire label set.

The **noise is bad. Sloth** dashboard
([`provisioning/dashboards/sloth.json`](../provisioning/dashboards/sloth.json))
shows the other common case, reading error budget from Sloth's metric names:

| Setting | Value |
| --- | --- |
| Query | `slo:period_error_budget_remaining:ratio` |
| Legend | none |
| Name | `sloth_service` |
| Worse when | Lower |
| Warning, Critical | `0.5`, `0.1` |

Setting **Name** to a label replaces the legend. Nothing else changes.

### 5. Break something and watch

Open <http://localhost:9101> for the exporter's control page. It runs a
scripted story by default, which overwrites anything set by hand, so **stop the
script first**. Then each service has a button for healthy, warning and
critical.

Make `search` critical and, within one scrape and one dashboard refresh (both
five seconds in the demo), it takes over the screen. Make it healthy again and
it stays for two more refreshes before leaving, so a flapping service does not
make the wall flash.

The same controls work from a terminal:

```bash
curl 'localhost:9101/script?on=false'            # stop the story first
curl 'localhost:9101/set?name=search&status=2'   # break search
curl 'localhost:9101/all?status=0'               # fix everything
curl 'localhost:9101/script?on=true'             # start the story again
```

## Moving it to your own data

1. Pick the number. Availability if you have request counts, error budget or
   burn rate if you have SLO tooling. Run it through the three-question test.
2. Make sure it comes back one series per service: `sum by (service)` or an
   existing recording rule.
3. Put it in the panel's query and give it a name, through the legend or the
   **Name** setting.
4. If it is not an availability ratio, set **Worse when** and the two levels
   from [the table in the metrics guide](metrics.md#other-shapes).
5. Check it lights up. Temporarily raise the warning level above what a healthy
   service reads (for availability, set it to `1`) and confirm every service
   appears. Then put it back. **A board that has never lit up has not been
   tested**: wrong units or a wrong direction look exactly like a healthy estate.
