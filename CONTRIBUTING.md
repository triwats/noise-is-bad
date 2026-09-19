# Contributing to noise is bad.

Thanks for looking. This is a small project with strong opinions, so it is worth
a couple of minutes reading before you write code.

## What it is trying to be

One question, answered from across a room: **how bad are things right now?**

The governing rule is that **the screen represents available attention, not
infrastructure topology**. Healthy things are never drawn. Every pixel goes to
something that currently deserves attention. A change that puts healthy services
on screen, or adds detail nobody can read from ten metres away, is working
against the point of it.

## Getting set up

```bash
make setup
```

That installs everything, builds the plugin, and starts Grafana, a pretend
estate of seven services and Prometheus scraping them. `make` on its own lists
every target, and `make doctor` says what is and is not ready.

```bash
make dev      # rebuild on save, leave running in its own shell
make check    # typecheck, lint, unit tests
make e2e      # browser tests, needs the stack up
```

## Things worth knowing before you change anything

**Four layers, one direction.** Grafana data enters through the signal adapter
and nothing downstream knows Grafana exists. `src/noise/`, `src/demo/` and
`src/render/` may not import from `@grafana/*`, and `src/architecture.test.ts`
fails if they ever do. This is what would let the interesting parts outlive the
plugin.

**Never edit `.config/`.** It belongs to `@grafana/create-plugin` and is
regenerated wholesale. Extend the root config files instead.

**The name is `noise is bad.`** — lowercase, with the full stop, everywhere a
person reads it, including the start of a sentence. Identifiers are the only
exception.

**A setting is not finished until it reaches the screen.** Panel options are
built in one place and passed to the renderer in another. Add a test that the
setting actually arrives, not just that the renderer honours it once given. This
has been a real bug more than once.

**Defaults live in one place.** `DEFAULT_ADAPTER` is the source of truth; never
repeat a default value at a use site. When defaults drift here, the failure is a
calm screen during an outage, which is the worst thing this panel can do.

## Tests

Unit tests cover the maths and the components. End-to-end tests drive a real
browser against a real Grafana, and they exist because several things here can
only be judged on a rendered page: whether boxes animate, whether text fits,
whether a setting arrives.

If you are changing how something looks, look at it. `make tv` puts the panel
full-screen.

## Pull requests

Small and focused is easier to take than large and sweeping. Say what you
changed and why, and if it is a visual change, a screenshot or a clip saves
everyone a round trip.

Questions and disagreements are welcome in an issue before you build something
large. It is cheaper than finding out afterwards.
