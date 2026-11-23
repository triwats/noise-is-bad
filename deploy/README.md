# noise is bad. public demo

The panel running in real Grafana at <https://demo.noiseisbad.triwats.com>, for anyone to look at and nobody to change.

```
internet ──80/443──▶ caddy ──▶ grafana ──▶ prometheus ──▶ exporter (the pretend shop)
                     (TLS)     (anonymous   └──────── internal network, no ports ───────┘
                               viewer)
```

- **Only Caddy listens publicly**, on 80 and 443. The exporter's control page (9101) and Prometheus (9090) are on an internal Docker network with no published ports and no internet access, so visitors can watch the shop break but cannot break it themselves.
- **Visitors are anonymous Viewers.** There is no login form, no basic auth, no sign-up, and no admin account at all. Explore, alerting, snapshots, public dashboards, query history, live and Grafana's own `/metrics` are switched off; Caddy also sends the pages behind them (login, admin, connections, plugins, profile) back to the front door and returns 404 for the plugin list, the datasource list, the raw datasource proxy and the admin API.
- **The front door** (`/`) redirects to the main demo (the `lifecycle` scenario), full screen in kiosk mode.
- **Dashboards shown:** the demo, real data (Prometheus), Sloth, quiet (DVD logo, 3D text, flip clock) and transitions. `states` (for the e2e suite) and `recording` (for the README GIF) are left off.
- **Unattended for months:** every container restarts unless stopped, logs rotate at 3 × 10 MB per container, Prometheus keeps one day, and the plugin is downloaded once per version, so a reboot never depends on GitHub being up.

Files:

| File | What it is |
| --- | --- |
| `compose.yaml` | The stack. Images are pinned; versions come from `.env`. |
| `Caddyfile` | TLS, security headers, the front-door redirect, the blocked paths. |
| `fetch-plugin.sh` | Run by the `plugin` container before Grafana starts: downloads the release zip into a volume. |
| `grafana/dashboards.yaml` | Provisions the dashboards mounted from `../provisioning/dashboards`. |
| `compose.local.yaml` | Runs the same stack on your laptop at <https://localhost:8443>, with the panel from `../dist`. |
| `check.sh` | Checks the live site from outside, as a visitor. |
| `deploy.sh` | Deploys a pushed commit from your laptop over SSH. Knows nothing about the server. |
| `.env.example` | Settings. Copy to `.env`. |

Memory limits: Grafana 512 MB, Prometheus 256 MB, Caddy 128 MB, exporter 64 MB, 960 MB in all, so the stack fits a 2 GB server with room for the OS.

## 1. Create the server

Hetzner Cloud, **CX22** (2 vCPU, 4 GB; or whatever the smallest shared x86 plan is called now, since anything with 2 GB will do), Ubuntu 24.04 LTS. Add your SSH public key when creating it, so the server never has a root password.

Then, as root:

```bash
# A user for yourself, keys only.
adduser --disabled-password --gecos '' deploy
usermod -aG sudo deploy
echo 'deploy ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/deploy
rsync -a --chown=deploy:deploy ~/.ssh /home/deploy/

# No passwords, no root over SSH.
cat > /etc/ssh/sshd_config.d/10-hardening.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
systemctl reload ssh

# Firewall: SSH and the web, nothing else.
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp
ufw --force enable

# Security updates install themselves; reboot at 04:00 when a kernel needs it.
apt-get update && apt-get install -y unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades
cat > /etc/apt/apt.conf.d/52reboot <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
EOF

# Docker, from Docker's own repository.
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
```

Check you can `ssh deploy@<ip>` from a second terminal before closing the root session.

**Docker and ufw:** ports Docker publishes bypass ufw entirely. That is harmless here because only Caddy publishes anything, and only 80 and 443. Never add `ports:` to another service on the assumption that ufw will stop it.

## 2. Point the name at it

In Cloudflare DNS for `triwats.com`: an **A** record, name `demo.noiseisbad`, value the server's IPv4 address, proxy status **DNS only** (grey cloud). Caddy needs to answer Let's Encrypt itself, and a proxied (orange) record puts Cloudflare in the way. Add an **AAAA** record for the IPv6 address too if you like, also grey.

Wait until `dig +short demo.noiseisbad.triwats.com` returns the address before the first deploy, or Caddy's first attempts at a certificate fail and it backs off for a while.

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
deploy/deploy.sh v1.0.1            # a tag or any pushed ref
deploy/deploy.sh --plugin 1.0.1    # also switch the panel release
```

The server checks out that exact commit from GitHub, so nothing uncommitted on your laptop ever ships. It then rebuilds, restarts Grafana and runs `check.sh` against the live site. The server's settings stay in `deploy/.env` on the server, which git ignores; the first deploy creates it from `.env.example`. `DEPLOY_HOST`, `DEPLOY_DIR` and `DEPLOY_URL` override the alias, the checkout directory and the address.

Never commit an IP address, username or key to this repository. The IP is not truly secret (the DNS record publishes it), but the rest is.

The manual steps follow, for when you are on the server anyway.

### First deploy by hand

As your user on the server:

```bash
git clone https://github.com/triwats/noise-is-bad.git
cd noise-is-bad/deploy
cp .env.example .env
nano .env            # PLUGIN_VERSION must be a release that exists; ACME_EMAIL optional
docker compose up -d --build
docker compose ps    # plugin "exited (0)", everything else "running"/"healthy"
./check.sh
```

Open <https://demo.noiseisbad.triwats.com>. The first certificate takes a few seconds.

If the `plugin` container failed, `docker compose logs plugin` says why: usually a release that does not exist yet, or a version in `.env` that does not match the zip.

### Updating the panel by hand

When a new release is tagged on GitHub:

```bash
cd ~/noise-is-bad/deploy
nano .env                         # PLUGIN_VERSION=1.0.1 (and PLUGIN_SHA256 if you use it)
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

From your laptop, these should all fail to connect, which is the point:

```bash
nc -zv -w 3 demo.noiseisbad.triwats.com 9101   # exporter control page
nc -zv -w 3 demo.noiseisbad.triwats.com 9090   # Prometheus
nc -zv -w 3 demo.noiseisbad.triwats.com 3000   # Grafana directly
```

## Trying it locally first

From this directory, with the dev stack still running if you like (this uses 8080 and 8443 only):

```bash
(cd .. && npm run build)           # if dist/ is missing
docker compose -f compose.yaml -f compose.local.yaml -p noise-is-bad-demo-local up -d --build
./check.sh https://localhost:8443 -k
docker compose -p noise-is-bad-demo-local down -v
```

Caddy uses its own internal certificate authority for `localhost`, hence `-k`.

## Embedding

`EMBED_ORIGINS` in `.env` lists the sites allowed to put the demo in an iframe (default: the project site). Grafana sends it as the CSP `frame-ancestors`, so any other site gets a blank frame.
