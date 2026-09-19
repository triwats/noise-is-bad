# Lessons

## The product's name is a brand mark, not a title

**Mistake:** wrote the plugin's name title-cased, "Noise Is Bad", in `plugin.json`, dashboard titles, docs and
comments, because that is how a product name normally reads.

**Rule:** the name is `noise is bad.` — lowercase, full stop included — everywhere a person reads it, including
the start of a sentence. Check any new user-facing string, title or doc heading against that before writing it.
Identifiers (the plugin id, CSS family labels) are the only exception.

## Defaults belong in one place, or they drift silently

**Mistake:** changed the panel's defaults to availability in the adapter and the panel options, but missed a
third copy inside `NoisePanel`. An unconfigured panel went on reading a 90% availability as healthy.

**Why it matters here:** this panel's worst failure is a calm screen during an outage. A wrong default does
not raise an error, it just quietly shows nothing wrong.

**Rule:** one exported constant is the source of truth for every default, and every fallback reads from it.
Never repeat a default value at a use site. When changing one, grep for the old value before believing it is
done.

## Test the wiring, not just the component

**Mistake:** built and thoroughly tested a panel option's behaviour in the renderer, but never added the line
passing it from the panel. Every board silently used the default, and the tests all passed.

**Rule:** a panel option needs a test at the panel level proving the setting reaches the drawing code. Remove
the wiring, watch the test fail, put it back.
