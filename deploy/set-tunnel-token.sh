#!/usr/bin/env bash
# Puts the Cloudflare Tunnel token into deploy/.env on the server, and nowhere
# else, then restarts the tunnel if it is already running.
#
#   deploy/set-tunnel-token.sh          # asks for the token, input hidden
#
# The token never appears on screen, in your shell history, in a command line
# (so not in either machine's process list), in a file on your laptop, or in
# this repository. It is read here with a hidden prompt and sent to the server
# over SSH's standard input, where it is written to deploy/.env, readable by
# its owner only.
#
# Like deploy.sh, it knows nothing about the server: it connects to an SSH
# alias, `noiseisbad-demo` unless DEPLOY_HOST says otherwise. Run deploy.sh
# once first, so the checkout exists on the server.
set -euo pipefail

host="${DEPLOY_HOST:-noiseisbad-demo}"
dir="${DEPLOY_DIR:-noise-is-bad}"   # relative to the server user's home

if [ -t 0 ]; then
  read -rsp "Cloudflare Tunnel token (input hidden): " token
  echo
else
  IFS= read -r token
fi
token="${token//[[:space:]]/}"

# A tunnel token is base64 JSON naming the account, tunnel and secret. Check
# the shape without ever printing it.
case "$token" in
  eyJ*) ;;
  *) echo "that is not a tunnel token: they start with eyJ" >&2; exit 1 ;;
esac

remote='set -euo pipefail
umask 077
cd ~/"$1/deploy" 2>/dev/null || { echo "no ~/$1/deploy on the server: run deploy/deploy.sh first" >&2; exit 1; }
IFS= read -r token
[ -f .env ] || cp .env.example .env
{ grep -v "^TUNNEL_TOKEN=" .env || true; printf "TUNNEL_TOKEN=%s\n" "$token"; } > .env.new
chmod 600 .env.new
mv .env.new .env
echo "token saved to ~/$1/deploy/.env"
if [ -n "$(docker compose ps -q cloudflared 2>/dev/null)" ]; then
  docker compose up -d cloudflared >/dev/null 2>&1
  echo "tunnel restarted with the new token"
fi'

printf '%s\n' "$token" | ssh "$host" "bash -c $(printf %q "$remote") _ $(printf %q "$dir")"
unset token
