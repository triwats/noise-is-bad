# Getting started

You have it installed. Let us get something on a screen.

## See it work in thirty seconds

You do not need a query to try it.

1. Add a panel and pick **noise is bad.** as the visualisation.
2. In the panel options, set **Demo** to *Shipping Incident*.
3. Watch.

A shipping service starts missing its objective. Checkout follows, because it
cannot quote a delivery date. Then the basket, then orders. Search and the rest
of the shop never appear, because nothing is wrong with them. After a couple of
minutes everything is fixed and the screensaver comes back.

That is the whole idea, running with no data at all. Once you are happy with it,
set **Demo** back to *Live data* and point it at something real.

## Point it at your own data

The panel wants one number per service: an availability, where 1 is perfect and
smaller is worse.

If you run Prometheus, something like this gets you started:

```promql
sum by (service) (rate(http_requests_total{code!~"5.."}[5m]))
  / sum by (service) (rate(http_requests_total[5m]))
```

Set the legend to `{{service}}` so the panel has a tidy name to draw, and you
are done. The defaults expect exactly this shape: below 99% is a warning, below
95% is critical.

Already computing SLOs? Even easier. With Sloth, query
`1 - slo:sli_error:ratio_rate1h` and set **Name** to `sloth_service`. Nothing
else to configure.

Got error budgets, burn rate, or a plain status number instead? All fine. Set
the two levels in whatever units your query returns and say which way the
number runs. [The metrics guide](metrics.md) has a table for each.

## Put it on the wall

Make the panel the only thing on its dashboard, then open it with `?kiosk` on
the end of the URL. Grafana drops its own furniture and you get the panel,
edge to edge.

Set the dashboard to refresh every 30 seconds or so. The panel handles the rest:
it remembers problems between refreshes, so it knows how long each one has been
going, and it waits for two healthy readings before clearing anything. A service
flapping on and off will not make your wall flash.

Then walk to the other side of the room and look back. If you cannot tell how
bad things are without reading a word, something needs adjusting, and it is
probably the thresholds.

## When it does not look right

**The board stays quiet, even during an outage.** Almost always units. The
defaults expect a ratio between 0 and 1. If your query returns percentages, set
the levels to 99 and 95 instead of 0.99 and 0.95.

**Everything shows as broken.** The direction is inverted. Availability and
budget remaining fall as things get worse; burn rate and budget burned rise.
There is a **Worse when** setting for this.

**The names are unreadable.** A Prometheus series with no legend is named by its
entire label set, which no television can show. Set a legend format, or point
**Name** at a single label.

**Too many boxes to read.** There is a ceiling, twenty by default, under **Most
boxes on screen**. Past it the worst keep their own box and the rest share one
that says how many more there are.

**Boxes keep resizing.** Long-running problems grow, which is deliberate, but
you can turn it off with **Grow with age**.

## Going deeper

- [The metrics guide](metrics.md) — every input shape, what the panel does with
  a number, and the handful of things only you can get right.
- [Install](install.md) — if you are setting this up somewhere new.
