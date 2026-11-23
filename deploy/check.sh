#!/bin/sh
# Checks the public demo from the outside, as an anonymous visitor would see it.
#
#   ./check.sh                                  # the real thing
#   ./check.sh http://localhost:8080            # the local trial (no tunnel)
#
# Prints one line per check and exits non-zero if any failed.
set -u

BASE="${1:-https://demo.noiseisbad.triwats.com}"
shift 2>/dev/null || true
CURL="curl -s --max-time 15 $*"
DASH=a538aeff-5a8a-42a5-901c-938d896fdd6f
FAILED=0

ok()   { printf 'ok    %s\n' "$1"; }
fail() { printf 'FAIL  %s (%s)\n' "$1" "$2"; FAILED=1; }

# expect_status METHOD PATH STATUS DESCRIPTION
expect_status() {
  got=$($CURL -o /dev/null -w '%{http_code}' -X "$1" "$BASE$2")
  [ "$got" = "$3" ] && ok "$4" || fail "$4" "$1 $2 gave $got, wanted $3"
}

# expect_body PATH TEXT DESCRIPTION
expect_body() {
  $CURL "$BASE$1" | grep -q "$2" && ok "$3" || fail "$3" "$1 lacks $2"
}

# --- it works ---------------------------------------------------------------
expect_status GET /api/health 200 'Grafana is healthy'
loc=$($CURL -o /dev/null -w '%{redirect_url}' "$BASE/")
case "$loc" in
  *"/d/$DASH/"*kiosk*) ok 'the front door lands on the demo in kiosk mode' ;;
  *) fail 'the front door lands on the demo in kiosk mode' "redirects to '$loc'" ;;
esac
expect_body "/api/dashboards/uid/$DASH" '"type":"triwats-noiseisbad-panel"' 'the demo dashboard holds the panel'
expect_body /api/dashboards/uid/noise-is-bad-prometheus '"type":"triwats-noiseisbad-panel"' 'the real data dashboard is provisioned'
expect_body /api/frontend/settings '"triwats-noiseisbad-panel"' 'Grafana has loaded the plugin'
expect_status GET /public/plugins/triwats-noiseisbad-panel/module.js 200 'the plugin code is served'

frames=$($CURL -X POST -H 'Content-Type: application/json' "$BASE/api/ds/query" \
  -d '{"queries":[{"refId":"A","datasource":{"uid":"noise-is-bad-prometheus"},"expr":"demo_availability_ratio","instant":true}],"from":"now-1m","to":"now"}')
echo "$frames" | grep -q 'demo_availability_ratio' && ok 'Prometheus is scraping the pretend estate' \
  || fail 'Prometheus is scraping the pretend estate' "$(echo "$frames" | head -c 200)"

# --- it gives nothing away --------------------------------------------------
$CURL "$BASE/api/health" | grep -q '"version"' && fail 'health hides the version' 'version present' \
  || ok 'health hides the version'
for p in /login /signup /explore /admin /admin/users /connections/datasources /plugins /profile /alerting/list /dashboard/new; do
  got=$($CURL -o /dev/null -w '%{http_code} %{redirect_url}' "$BASE$p")
  case "$got" in
    "302 $BASE/") ok "$p sends visitors home" ;;
    *) fail "$p sends visitors home" "got $got" ;;
  esac
done
expect_status GET /api/plugins 404 'the plugin list is hidden'
expect_status GET /metrics 404 "Grafana's metrics are hidden"
expect_status GET /api/datasources 404 'the datasource list is hidden'
expect_status GET '/api/datasources/proxy/uid/noise-is-bad-prometheus/api/v1/query?query=up' 404 'the raw datasource proxy is closed'
expect_status POST '/api/datasources/proxy/uid/noise-is-bad-prometheus/api/v1/admin/tsdb/delete_series' 404 'datasource proxy writes are closed'
expect_status GET /api/admin/settings 404 'the admin API is closed'

# Grafana's own refusals, reached through the proxy: a viewer cannot change anything.
for spec in 'POST /api/dashboards/db' 'POST /api/annotations' 'POST /api/folders' 'PUT /api/org/preferences' 'DELETE /api/dashboards/uid/'"$DASH"; do
  set -- $spec
  got=$($CURL -o /dev/null -w '%{http_code}' -X "$1" -H 'Content-Type: application/json' -d '{}' "$BASE$2")
  case "$got" in
    401|403|404) ok "$1 $2 is refused ($got)" ;;
    *) fail "$1 $2 is refused" "got $got" ;;
  esac
done

headers=$($CURL -D - -o /dev/null "$BASE/d/$DASH/noise-is-bad")
echo "$headers" | grep -qi '^strict-transport-security:' && ok 'HSTS is set' || fail 'HSTS is set' 'missing'
echo "$headers" | grep -qi "frame-ancestors" && ok 'framing is limited by CSP' || fail 'framing is limited by CSP' 'no frame-ancestors'
# Cloudflare names itself; nothing behind it may.
server=$(echo "$headers" | grep -i '^server:' | tr -d '\r' | cut -d' ' -f2-)
case "$server" in
  ''|cloudflare) ok 'the Server header names nothing behind Cloudflare' ;;
  *) fail 'the Server header names nothing behind Cloudflare' "server: $server" ;;
esac

exit $FAILED
