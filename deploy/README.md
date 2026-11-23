# noise is bad. site and public demo

One server, one name: the project site at <https://noiseisbad.triwats.com/>, and the panel running in real Grafana at <https://noiseisbad.triwats.com/demo/>, for anyone to look at and nobody to change.

```
visitor ──HTTPS──▶ Cloudflare ◀──outbound tunnel── cloudflared ──▶ caddy ─┬─ /        the site (static files)
                   (TLS, DDoS,                                               └─ /demo/*  grafana ──▶ prometheus ──▶ exporter
                    WAF, cache)                    └────────── on the server, no published ports ──────────┘
you ──Tailscale──▶ SSH
```

- **Nothing on the server listens publicly.** Visitors reach it through a Cloudflare Tunnel: `cloudflared` dials out to Cloudflare and hands requests to Caddy, so the firewall allows no inbound traffic from the internet and the server's address is never published. Cloudflare terminates HTTPS. SSH answers only on the Tailscale interface.
- **Caddy is the gatekeeper, not the front.** It serves the site, sends `/demo/` to Grafana, sets the headers and blocks the paths a viewer has no business on, over plain HTTP on the internal network.
- **The site is built on the server** from this repository by `site/build.sh`, in a throwaway container with no network, and only when its sources changed since the last build. Nothing generated is committed. The site shares the server's fate: if the server is down, so is the site.
- The exporter's control page (9101) and Prometheus (9090) are on an internal Docker network with no internet access, so visitors can watch the shop break but cannot break it themselves.
- **Visitors are anonymous Viewers.** There is no login form, no basic auth, no sign-up, and no admin account at all. Explore, alerting, snapshots, public dashboards, query history, live and Grafana's own `/metrics` are switched off; Caddy also sends the pages behind them (login, admin, connections, plugins, profile) back to the demo and returns 404 for the plugin list, the datasource list, the raw datasource proxy and the admin API.
- **The way into the demo** (`/demo/`) redirects to the main demo (the `lifecycle` scenario), full screen in kiosk mode. Grafana serves from the `/demo/` sub-path.
- **Dashboards shown:** the demo, real data (Prometheus), Sloth, quiet (DVD logo, 3D text, flip clock, Boing ball) and transitions. `states` (for the e2e suite) and `recording` (for the README GIF) are left off.
- **Unattended for months:** every container restarts unless stopped, logs rotate at 3 × 10 MB per container, Prometheus keeps one day, and the plugin is downloaded once per version, so a reboot never depends on GitHub being up.

Files:

| File | What it is |
| --- | --- |
| `compose.yaml` | The stack. Images are pinned; versions come from `.env`. |
| `Caddyfile` | The site at `/`, Grafana at `/demo/`, security headers, the blocked paths. |
| `build-site.sh`, `site/Dockerfile` | Run by the `site` container before Caddy starts: builds the project site into a volume, skipping the build when nothing changed. |
| `fetch-plugin.sh` | Run by the `plugin` container before Grafana starts: downloads the release zip into a volume. |
| `grafana/dashboards.yaml` | Provisions the dashboards mounted from `../provisioning/dashboards`. |
| `compose.local.yaml` | Runs the same stack on your laptop at <http://localhost:8080>, without the tunnel, with the panel from `../dist`. |
| `check.sh` | Checks the live site and demo from outside, as a visitor. |
| `deploy.sh` | Deploys a pushed commit from your laptop over SSH. Knows nothing about the server. |
| `set-tunnel-token.sh` | Puts the Cloudflare Tunnel token on the server from your laptop, input hidden. |
| `.env.example` | Settings. Copy to `.env`. |

Memory limits: Grafana 512 MB, Prometheus 256 MB, Caddy 128 MB, cloudflared 64 MB, exporter 64 MB, about 1 GB in all, so the stack fits a 2 GB server with room for the OS. The site builder may use up to 1 GB while it runs, during a deploy only.

## 1. Create the server

Any small x86 VPS with 2 GB or more and Ubuntu 24.04 LTS. Give it your SSH public key when creating it, so it never has a password. The examples assume the image's default `ubuntu` user, with sudo.

Then, as that user:

```bash
# No passwords, no root over SSH.
printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin no\n' \
  | sudo tee /etc/ssh/sshd_config.d/10-hardening.conf
sudo sshd -t && sudo systemctl reload ssh

# Security updates install themselves; reboot at 04:00 when a kernel needs it.
sudo apt-get update && sudo apt-get install -y unattended-upgrades
printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' \
  | sudo tee /etc/apt/apt.conf.d/20auto-upgrades
printf 'Unattended-Upgrade::Automatic-Reboot "true";\nUnattended-Upgrade::Automatic-Reboot-Time "04:00";\n' \
  | sudo tee /etc/apt/apt.conf.d/52reboot

# Docker, from Docker's own repository, and Tailscale.
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
curl -fsSL https://tailscale.com/install.sh | sudo sh
sudo tailscale up --hostname=noiseisbad-demo   # open the link it prints

# Firewall: SSH for now, nothing else ever. The tunnel only dials out.
sudo ufw allow 22/tcp && sudo ufw --force enable
```

**Then move SSH onto Tailscale.** With your laptop on the same tailnet, check that `ssh ubuntu@noiseisbad-demo` works over it, *then*:

```bash
sudo ufw allow in on tailscale0 to any port 22 proto tcp
sudo ufw delete allow 22/tcp
```

Afterwards `sudo ufw status` should list only the `tailscale0` rule. If Tailscale is ever down, your provider's web console is the way back in.

**Docker and ufw:** ports Docker publishes bypass ufw entirely. This stack publishes none. Never add `ports:` to a service on the assumption that ufw will stop it.

## 2. Cloudflare

The tunnel is created in Cloudflare and only *run* on the server.

1. In the Cloudflare dashboard, open **Zero Trust → Networks → Tunnels** and **Create a tunnel**. Choose **Cloudflared** and name it `noiseisbad-demo`.
2. On the install step, pick **Docker**. The command shown ends in `--token <long string>`. That string is the token: copy it, and do not run the command. The token is a password for the tunnel; it goes in the server's `deploy/.env` and nowhere else (see below).
3. Add the **public hostname** (also called a published application route): subdomain `noiseisbad`, domain `triwats.com`, no path, service type **HTTP**, URL **`caddy:80`**. Cloudflare creates the proxied DNS record itself; do not add an A record, and delete any record already on that name. Keep the name **one level** under `triwats.com`: the free Universal certificate covers `*.triwats.com` only, and a deeper name fails the TLS handshake at Cloudflare (`SSL_ERROR_NO_CYPHER_OVERLAP`) unless you pay for Advanced Certificate Manager.
4. Optional, in the `triwats.com` zone: **SSL/TLS → Edge Certificates**, turn on **Always Use HTTPS** and set the minimum TLS version to 1.2.

Then, from the repository root on your laptop, after the first `deploy/deploy.sh` (so the checkout exists on the server):

```bash
deploy/set-tunnel-token.sh
```

It asks for the token with the input hidden and sends it over SSH's standard input into the server's `deploy/.env`, readable by its owner only, restarting the tunnel if it is running. The token never appears on screen, in your shell history, in a command line or in a file on your laptop. Never paste it anywhere else: not into a chat, a ticket, or this repository.

If the token ever leaks, refresh it under the tunnel's settings in Cloudflare, and run `deploy/set-tunnel-token.sh` again with the new one.

## 3. Deploy from your laptop

`deploy.sh` does sections 3 and 4 for you. This repository is public, so the script knows nothing about the server: it connects to an SSH alias, and the address, user and key live only in your own `~/.ssh/config`:

```
Host noiseisbad-demo
  HostName <the server's IP>
  User deploy
  IdentityFile ~/.ssh/<your key>
  IdentitiesOnly yes
```

Then, from the repository root:

```bash
deploy/deploy.sh                   # the current commit, which must be pushed
deploy/deploy.sh v0.0.2            # a tag or any pushed ref
deploy/deploy.sh --plugin 0.0.2    # also switch the panel release
```

The server checks out that exact commit from GitHub, so nothing uncommitted on your laptop ever ships. It then rebuilds, restarts Grafana and runs `check.sh` against the live site. Once SSH has moved onto Tailscale, point the alias's `HostName` at the server's Tailscale name. The server's settings stay in `deploy/.env` on the server, which git ignores; the first deploy creates it from `.env.example`. `DEPLOY_HOST`, `DEPLOY_DIR` and `DEPLOY_URL` override the alias, the checkout directory and the address.

Never commit an IP address, username or key to this repository. The IP is not truly secret (the DNS record publishes it), but the rest is.

The manual steps follow, for when you are on the server anyway.

### First deploy by hand

As your user on the server:

```bash
git clone https://github.com/triwats/noise-is-bad.git
cd noise-is-bad/deploy
cp .env.example .env
nano .env            # PLUGIN_VERSION must be a release that exists; TUNNEL_TOKEN as in section 2
docker compose up -d --build
docker compose ps    # plugin "exited (0)", everything else "running"/"healthy"
./check.sh
```

Open <https://noiseisbad.triwats.com/> and <https://noiseisbad.triwats.com/demo/>. The first deploy builds the site, which takes a few minutes. If Cloudflare shows an error page, `docker compose logs cloudflared` says whether the tunnel connected.

If the `plugin` container failed, `docker compose logs plugin` says why: usually a release that does not exist yet, or a version in `.env` that does not match the zip.

### Updating the panel by hand

When a new release is tagged on GitHub:

```bash
cd ~/noise-is-bad/deploy
nano .env                         # PLUGIN_VERSION=0.0.2 (and PLUGIN_SHA256 if you use it)
docker compose up -d              # downloads the new zip once
docker compose restart grafana    # Grafana reads plugins only at start
./check.sh
```

To roll back, set the old version and do the same.

When the dashboards or the demo estate change in the repository:

```bash
git pull
docker compose up -d --build
docker compose restart grafana
```

## 4. Updating Grafana (or Caddy, or Prometheus)

Images are pinned and never update by themselves. unattended-upgrades installs Ubuntu's security updates only: not Docker Engine (from Docker's repository, so `sudo apt upgrade` now and then) and not the containers. Every few months:

```bash
nano .env                          # e.g. GRAFANA_VERSION=13.2.0
docker compose pull && docker compose up -d
./check.sh
docker image prune -f              # reclaim the old images
```

Keep Grafana within the panel's `grafanaDependency` in `src/plugin.json` (currently `>=12.3.0`). After a Grafana upgrade, look at the demo in a browser as well as running `check.sh`: Grafana occasionally renames a page, and Caddy's list of blocked paths matches the names, not the meaning.

## 5. Is it healthy?

```bash
./check.sh                         # from anywhere: every line should say ok
docker compose ps                  # on the server
docker stats --no-stream           # memory against the limits
docker compose logs --tail 50 grafana caddy
df -h /                            # Prometheus is capped at a day; logs at 30 MB per container
```

From outside the tailnet, the server's own address should answer on nothing at all, which is the point:

```bash
for port in 22 80 443 3000 9090 9101; do nc -zv -w 3 <the server's public IP> $port; done
```

The demo's name resolves to Cloudflare, not to the server, so test the server by its address.

## Trying it locally first

From this directory, with the dev stack still running if you like (this uses 8080 only):

```bash
(cd .. && npm run build)           # if dist/ is missing
docker compose -f compose.yaml -f compose.local.yaml -p noise-is-bad-demo-local up -d --build
./check.sh http://localhost:8080
docker compose -p noise-is-bad-demo-local down -v
```

There is no tunnel locally, so the HSTS and Server-header checks describe Caddy alone.

## Embedding

`EMBED_ORIGINS` in `.env` lists the sites allowed to put the demo in an iframe (default: the project site). Grafana sends it as the CSP `frame-ancestors`, so any other site gets a blank frame.
