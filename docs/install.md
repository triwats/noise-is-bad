# Install

noise is bad. is a Grafana panel plugin. You need Grafana 12.3 or newer.

It is not on the Grafana catalogue yet, so you put the files in place yourself.
It takes about two minutes.

## 1. Get the files

**From a release.** Grab the zip from the
[releases page](https://github.com/triwats/noise-is-bad/releases) and unzip it
into Grafana's plugin directory. If that page is still empty, there has not been
a tagged release yet, so build it instead. It takes a minute longer.

```bash
unzip triwats-noiseisbad-panel-*.zip -d /var/lib/grafana/plugins/
```

**Or build it yourself.** Handy if you want to change something, or if there is
no release for your platform yet.

```bash
git clone https://github.com/triwats/noise-is-bad.git
cd noise-is-bad
npm ci
npm run build
cp -r dist /var/lib/grafana/plugins/triwats-noiseisbad-panel
```

Either way you should end up with a folder named exactly after the plugin:

```
/var/lib/grafana/plugins/triwats-noiseisbad-panel/
├── module.js
├── plugin.json
└── img/
```

The folder name matters. Grafana matches it against the id inside
`plugin.json`, and quietly ignores the plugin if they disagree.

### Where the plugin directory lives

| How you run Grafana | Directory |
| --- | --- |
| Package install on Linux | `/var/lib/grafana/plugins` |
| Docker | `/var/lib/grafana/plugins`, usually a mounted volume |
| Homebrew on macOS | `/opt/homebrew/var/lib/grafana/plugins` |
| Anything else | whatever `paths.plugins` says in `grafana.ini` |

## 2. Let Grafana load it

The plugin is not signed yet, so Grafana will refuse to load it until you say
you are happy with that. Add the plugin id to the allow list.

In `grafana.ini`:

```ini
[plugins]
allow_loading_unsigned_plugins = triwats-noiseisbad-panel
```

Or as an environment variable, which is easier in Docker:

```bash
GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=triwats-noiseisbad-panel
```

In `docker-compose.yaml`:

```yaml
services:
  grafana:
    image: grafana/grafana:12.3.0
    volumes:
      - ./plugins:/var/lib/grafana/plugins
    environment:
      GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS: triwats-noiseisbad-panel
```

## 3. Restart Grafana

```bash
sudo systemctl restart grafana-server   # package install
docker compose restart grafana          # docker
brew services restart grafana           # homebrew
```

## 4. Check it worked

Open **Administration → Plugins**, clear the filter so it includes panels, and
search for *noise*. You should see it listed, marked unsigned.

Quicker still: edit any panel, open the visualisation picker and type *noise*.

## If it does not show up

Nine times out of ten it is one of three things.

**The allow list.** Check the id is spelled exactly `triwats-noiseisbad-panel`,
and that you restarted afterwards. Grafana only reads this at startup.

**The folder name.** It has to match the plugin id, not the zip name and not
the repository name.

**Grafana cannot see the directory.** In Docker this is usually a volume mount
that did not land where you thought. `docker compose exec grafana ls
/var/lib/grafana/plugins` settles it.

Still stuck? Grafana's logs say plenty. Look for `plugin.loader` lines at
startup, which name the plugin and the reason it was skipped.

## Next

[Getting started](getting-started.md) takes you from an installed plugin to a
panel on the wall.
