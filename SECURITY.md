# Security

## Reporting something

Please do not open a public issue for a security problem.

Use GitHub's private vulnerability reporting on this repository, under
**Security → Report a vulnerability**. That reaches the maintainer directly and
keeps the details out of public view until there is a fix.

Include what you found, how to reproduce it, and what an attacker could do with
it. A proof of concept helps; a working exploit is not necessary.

You should get a first response within a week. If you do not, please chase it.

## What is in scope

This is a Grafana panel plugin. It renders in the browser, alongside everything
else Grafana loads, and it reads only what a panel query returns.

Worth reporting:

- Anything that lets query data escape as executed code, for example a service
  name that becomes markup or script
- Anything that reads or exfiltrates data the panel has no business touching
- A dependency this package bundles that carries a known vulnerability

Out of scope, because they are not this plugin:

- Grafana itself, its authentication, or its data source permissions
- The demo stack under `demo/`, which exists to make things up on a laptop. It
  ships an unauthenticated exporter and an anonymous-access Grafana on purpose.
  Do not put it on a network you care about.

## What this plugin can and cannot do

It makes no network requests of its own. It has no backend. It stores nothing
beyond the panel options saved in a dashboard, and it reads no credentials.

Everything the package bundles is listed in `THIRD_PARTY_NOTICES.md`, and a test
fails if that file drifts from what is actually shipped.
