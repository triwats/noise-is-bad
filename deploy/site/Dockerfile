# Builds the project site on the server: site/build.sh needs Node (to lift the
# embedded font out of brandData.ts, and to render README.md with marked) and
# ffmpeg (to turn the README's GIFs into video). Runs once per deploy, with no
# network, and exits, which is why marked is installed here, into the image.
FROM node:24-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*
# The version the plugin's own lockfile resolves, so the site renders the same
# on the server as `make site` does locally.
RUN npm install -g marked@16.3.0
ENV NODE_PATH=/usr/local/lib/node_modules
