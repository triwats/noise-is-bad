## What and why

<!-- What changed, and the problem it solves. Link the issue if there is one. -->

## How it looks

<!-- For anything visual, a screenshot or a short clip. `make tv` puts the panel full-screen. -->

## Checklist

- [ ] `make check` passes (typecheck, lint, unit tests)
- [ ] `make e2e` passes, if rendering or options changed
- [ ] A new panel option has a test proving it reaches the drawing code, and is added to every dashboard in `provisioning/dashboards/`
- [ ] No default repeated at a use site; defaults come from their one constant
- [ ] Nothing under `src/noise/`, `src/demo/` or `src/render/` imports `@grafana/*`
- [ ] Nothing in `.config/` edited
- [ ] A new bundled dependency, font or image is credited in `THIRD_PARTY_NOTICES.md`
- [ ] `CHANGELOG.md` updated, if a user would notice
