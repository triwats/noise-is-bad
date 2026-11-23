#!/usr/bin/env bash
# Deploys the public demo: the server checks out a pushed commit of this
# repository and restarts the stack, then the site is checked from outside.
#
#   deploy/deploy.sh                    # deploy the current commit
#   deploy/deploy.sh v0.0.2             # deploy a tag or any pushed ref
#   deploy/deploy.sh --plugin 0.0.2     # also switch the panel release
#
# Nothing about the server lives in this repository, which is public. The
# script connects to an SSH alias, `noiseisbad-demo` unless DEPLOY_HOST says
# otherwise, so the address, user and key stay in your own ~/.ssh/config:
#
#   Host noiseisbad-demo
#     HostName <the server's IP>
#     User deploy
#     IdentityFile ~/.ssh/<your key>
#     IdentitiesOnly yes
#
# The server's settings stay in deploy/.env on the server, which git ignores.
set -euo pipefail

host="${DEPLOY_HOST:-noiseisbad-demo}"
dir="${DEPLOY_DIR:-noise-is-bad}"          # relative to the server user's home
url="${DEPLOY_URL:-https://noiseisbad.triwats.com}"
repo="https://github.com/triwats/noise-is-bad.git"

ref=HEAD
plugin=""
while [ $# -gt 0 ]; do
  case "$1" in
    --plugin) plugin="${2:?--plugin needs a version, e.g. 0.0.2}"; shift 2 ;;
    -h|--help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) echo "unknown option: $1" >&2; exit 2 ;;
    *) ref="$1"; shift ;;
  esac
done

if [ -n "$plugin" ] && ! [[ "$plugin" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-.][A-Za-z0-9.]+)?$ ]]; then
  echo "not a version: $plugin" >&2; exit 2
fi

here="$(cd "$(dirname "$0")" && pwd)"
cd "$here/.."

# Only what is on GitHub can be deployed, because that is what the server pulls.
git fetch --quiet --tags origin
sha="$(git rev-parse --verify "$ref^{commit}")"
if [ -z "$(git branch -r --contains "$sha")" ] && [ -z "$(git tag --contains "$sha" | head -1)" ]; then
  echo "$ref ($sha) is not on GitHub yet. Push it first." >&2
  exit 1
fi
if [ "$ref" = HEAD ] && [ -n "$(git status --porcelain)" ]; then
  echo "note: uncommitted changes here are not deployed; the server gets $sha"
fi

echo "deploying $(git log -1 --format='%h %s' "$sha") to $host"

# SSH joins its arguments into one string for the remote shell, which drops an
# empty one (no --plugin) and splits any with spaces. Quote each for that shell.
ssh "$host" "bash -s -- $(printf '%q ' "$repo" "$dir" "$sha" "$plugin")" <<'REMOTE'
set -euo pipefail
repo="$1"; dir="$2"; sha="$3"; plugin="$4"
cd ~
[ -d "$dir/.git" ] || git clone --quiet "$repo" "$dir"
cd "$dir"
git fetch --quiet --tags origin
git -c advice.detachedHead=false checkout --quiet --detach "$sha"
cd deploy
if [ ! -f .env ]; then
  cp .env.example .env
  chmod 600 .env   # it will hold the tunnel token
  echo "created deploy/.env from the example; review it on the server"
fi
if [ -n "$plugin" ]; then
  sed -i "s/^PLUGIN_VERSION=.*/PLUGIN_VERSION=$plugin/; s/^PLUGIN_SHA256=.*/PLUGIN_SHA256=/" .env
  echo "panel release set to $plugin"
fi
docker compose up -d --build --remove-orphans
# Grafana reads plugins and provisioned dashboards only when it starts.
docker compose restart grafana
docker compose ps --format 'table {{.Service}}\t{{.Status}}'
REMOTE

echo "waiting for $url"
for _ in $(seq 1 30); do
  curl -fsS -o /dev/null "$url/demo/api/health" 2>/dev/null && break
  sleep 2
done
"$here/check.sh" "$url"
