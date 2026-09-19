# noise is bad. — development tasks.
#
# Run `make` on its own to see everything available.
# `make setup` takes a clean checkout to a running Grafana with the panel loaded.

PLUGIN_ID   := triwats-noiseisbad-panel
DASHBOARD   := a538aeff-5a8a-42a5-901c-938d896fdd6f
GRAFANA_URL := http://localhost:3000
DASHBOARD_URL := $(GRAFANA_URL)/d/$(DASHBOARD)
REAL_URL    := $(GRAFANA_URL)/d/noise-is-bad-prometheus
SLOTH_URL   := $(GRAFANA_URL)/d/noise-is-bad-sloth
MOTION_URL  := $(GRAFANA_URL)/d/noise-is-bad-transitions
ESTATE_URL  := http://localhost:9101
PROM_URL    := http://localhost:9090
QUIET_URL   := $(GRAFANA_URL)/d/noise-is-bad-quiet?viewPanel=1&kiosk
SPIN_URL    := $(GRAFANA_URL)/d/noise-is-bad-quiet?viewPanel=2&kiosk

# Extra flags for npm install. On a degraded network link, --maxsockets=3 stops
# npm stalling on too many parallel connections.
NPM_INSTALL_FLAGS ?= --no-audit --no-fund

# How long `make up` waits for Grafana to report healthy, in seconds.
HEALTH_TIMEOUT ?= 120

.DEFAULT_GOAL := help
.PHONY: help setup install playwright dev build up down restart logs shell \
	open tv real sloth motion estate check typecheck lint lint-fix test e2e clean clean-all doctor

help: ## Show this help
	@echo "noise is bad. — make targets"
	@echo
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "} {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "Quick start:  make setup"

# --- setup -------------------------------------------------------------------

setup: install playwright build up ## Full setup: dependencies, build, and a running Grafana
	@echo
	@echo "Ready."
	@echo "  Demo, the whole story on one panel:  $(DASHBOARD_URL)"
	@echo "  Same panel on real Prometheus data:  $(REAL_URL)"
	@echo "  Break services by hand:              $(ESTATE_URL)"
	@echo "Run 'make dev' in another shell to rebuild on save."

install: ## Install frontend dependencies
	@if [ -f package-lock.json ]; then npm ci $(NPM_INSTALL_FLAGS); \
	else npm install $(NPM_INSTALL_FLAGS); fi

playwright: ## Install the Chromium build used by the e2e tests
	@npx playwright install chromium

# --- building ----------------------------------------------------------------

dev: ## Rebuild the plugin on every save (leave running)
	@npm run dev

build: ## Production build into dist/
	@npm run build

# --- the Grafana server ------------------------------------------------------

up: ## Start Grafana with the plugin mounted, and wait for it
	@docker info > /dev/null 2>&1 || { echo "Docker is not running. Start Docker Desktop, then retry."; exit 1; }
	@test -f dist/module.js || { echo "dist/ is empty. Run 'make build' first."; exit 1; }
	@docker compose up --build -d
	@printf "Waiting for Grafana"
	@elapsed=0; until curl -sf $(GRAFANA_URL)/api/health > /dev/null 2>&1; do \
		if [ $$elapsed -ge $(HEALTH_TIMEOUT) ]; then \
			echo " timed out after $(HEALTH_TIMEOUT)s. Try 'make logs'."; exit 1; fi; \
		printf "."; sleep 2; elapsed=$$((elapsed + 2)); \
	done
	@echo " healthy at $(GRAFANA_URL)"

down: ## Stop and remove the Grafana container
	@docker compose down

restart: ## Restart Grafana (needed after any src/plugin.json change)
	@docker compose restart
	@echo "Restarted. Give it a few seconds, then reload the browser."

logs: ## Follow the Grafana logs
	@docker compose logs -f

shell: ## Open a shell inside the Grafana container
	@docker compose exec grafana /bin/bash

estate: ## Open the page for breaking services by hand
	@open "$(ESTATE_URL)" 2>/dev/null || echo "$(ESTATE_URL)"

motion: ## Compare the four appear-and-disappear styles side by side
	@open "$(MOTION_URL)?kiosk" 2>/dev/null || echo "$(MOTION_URL)?kiosk"

sloth: ## Open the dashboard reading Sloth-shaped recording rules
	@open "$(SLOTH_URL)?kiosk" 2>/dev/null || echo "$(SLOTH_URL)?kiosk"

real: ## Open the dashboard reading real Prometheus data
	@open "$(REAL_URL)?kiosk" 2>/dev/null || echo "$(REAL_URL)?kiosk"

open: ## Open the provisioned dashboard in a browser
	@open "$(DASHBOARD_URL)" 2>/dev/null || echo "$(DASHBOARD_URL)"

tv: ## Open the panel full-screen, no Grafana chrome
	@open "$(DASHBOARD_URL)?viewPanel=1&kiosk" 2>/dev/null || echo "$(DASHBOARD_URL)?viewPanel=1&kiosk"

quiet: ## Open the quiet state full-screen: the DVD logo, bouncing
	@open "$(QUIET_URL)" 2>/dev/null || echo "$(QUIET_URL)"

spin: ## Open the quiet state full-screen: the 3D text, turning
	@open "$(SPIN_URL)" 2>/dev/null || echo "$(SPIN_URL)"

# --- checks ------------------------------------------------------------------

check: typecheck lint test ## Typecheck, lint and unit tests

typecheck: ## Run tsc
	@npm run typecheck

lint: ## Run eslint
	@npm run lint

lint-fix: ## Fix what eslint and prettier can fix
	@npm run lint:fix

test: ## Unit tests, single run
	@npm run test:ci

e2e: ## End-to-end tests (needs 'make up' first)
	@curl -sf $(GRAFANA_URL)/api/health > /dev/null 2>&1 || { echo "Grafana is not running. Run 'make up' first."; exit 1; }
	@npm run e2e

doctor: ## Report the state of the local environment
	@printf "node       "; node --version 2>/dev/null || echo "missing"
	@printf "node pin   "; v=$$(cat .nvmrc); \
		case "$$(node --version 2>/dev/null)" in v$$v.*) echo ".nvmrc wants $$v, matches";; \
		*) echo ".nvmrc wants $$v, you are on $$(node --version 2>/dev/null) — run 'nvm use'";; esac
	@printf "npm        "; npm --version 2>/dev/null || echo "missing"
	@printf "deps       "; test -d node_modules && echo "installed" || echo "run 'make install'"
	@printf "dist       "; test -f dist/module.js && echo "built" || echo "run 'make build'"
	@printf "docker     "; docker info > /dev/null 2>&1 && echo "running" || echo "not running"
	@printf "grafana    "; curl -sf $(GRAFANA_URL)/api/health > /dev/null 2>&1 && echo "healthy at $(GRAFANA_URL)" || echo "not up — run 'make up'"
	@printf "estate     "; curl -sf $(ESTATE_URL)/metrics > /dev/null 2>&1 && echo "reporting at $(ESTATE_URL)" || echo "not up"
	@printf "prometheus "; curl -sf $(PROM_URL)/-/ready > /dev/null 2>&1 && echo "ready at $(PROM_URL)" || echo "not up — a bus error here means Docker's disk is full"
	@printf "plugin     "; curl -sf "$(GRAFANA_URL)/api/plugins?core=0" 2>/dev/null | grep -q "$(PLUGIN_ID)" && echo "registered" || echo "not registered"

# --- cleaning ----------------------------------------------------------------

clean: ## Remove build output and tool caches
	@rm -rf dist coverage test-results playwright-report blob-report .eslintcache
	@echo "Removed build output and caches."

clean-all: clean ## Also remove node_modules
	@rm -rf node_modules
	@echo "Removed node_modules. Run 'make install' to restore."
