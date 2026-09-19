# Changelog

## 1.0.0 — unreleased

First release of **noise is bad.**, a Grafana panel for the office television.

### What it does

- **Nothing wrong** — the screen falls quiet and a mark drifts around it, either
  the DVD logo or the wordmark, or the Windows XP *3D Text* screensaver rebuilt
  in CSS.
- **One problem** — it takes the entire screen: the name, how bad it is, nothing
  else.
- **More than one** — a treemap, where each box is sized by how bad the problem
  is and how long it has lasted. Healthy services are never drawn.
- **Too many** — the worst keep their own box and the rest share one that says
  how many more there are. Nothing is hidden silently.

### Reading your data

- Expects availability by default: good events over total events, where 1 is
  perfect. Below 0.99 is a warning, below 0.95 critical.
- Also reads error budget remaining, budget burned, burn rate, or a plain status
  number, by setting the two levels and which way the number runs.
- Works with Sloth and Pyrra untouched, including naming services from a label
  rather than a column.
- A query it cannot read says so, rather than showing a calm screen.
- A service that disappears from the query is held, not cleared. A missing
  metric is not the same as a fixed problem.

### Behaviour

- Problems are remembered between refreshes, so how long one has lasted is real
  and grows its box.
- A service flicking between broken and fixed has to read healthy twice before
  it leaves, so the screen does not flash.
- Boxes slide to their new size rather than being rebuilt, and how they arrive
  and leave is a setting.

Everything the package bundles is credited in `THIRD_PARTY_NOTICES.md`.
