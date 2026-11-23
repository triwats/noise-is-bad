# Builds the project site on the server: site/build.sh needs Node (to lift the
# embedded font out of brandData.ts) and ffmpeg (to turn the README's GIFs into
# video). Runs once per deploy, with no network, and exits.
FROM node:24-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*
