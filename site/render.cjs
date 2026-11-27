#!/usr/bin/env node
// Renders README.md into the project site, so the site and the README can never
// disagree. site/index.html is only the frame around it: head, navigation, footer.
//
//   node site/render.cjs README.md site/index.html OUT_DIR
//
// The README is written for GitHub, so a few things change on the way:
//   - its centred opening block becomes the page's hero, minus the lockup the
//     page header already shows, and its first GIF becomes the launch video
//   - links into the repository go to GitHub; links to this site become relative
//   - the demo GIFs become the videos site/build.sh encodes from them
//   - the mermaid pipeline is drawn as boxes, so the page needs no diagram library
//   - every ## heading starts a section, with an id to link to
//
// Afterwards every relative link and image on the page must exist in OUT_DIR, so
// a README change that the site cannot follow fails the build instead of shipping
// a broken page.
'use strict';

const fs = require('fs');
const path = require('path');
const { Marked } = require('marked');

const [readmePath, framePath, outDir] = process.argv.slice(2);
if (!readmePath || !framePath || !outDir) {
  console.error('usage: render.cjs README.md site/index.html OUT_DIR');
  process.exit(2);
}

const SITE = 'https://noiseisbad.triwats.com';
const REPO = 'https://github.com/triwats/noise-is-bad/blob/main/';
// Served by Grafana, not by the files in OUT_DIR.
const SERVED_ELSEWHERE = /^demo(\/|$)/;
const missing = [];

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (text) =>
  text
    .replace(/<[^>]+>/g, '')
    .toLowerCase()
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// --- the mermaid pipeline, as boxes ---------------------------------------------
// Understands the README's one diagram: nodes in order, optionally grouped into
// subgraphs. Anything it cannot read falls back to the source as a code block.
function pipeline(source) {
  const groups = [];
  let group = null;
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    let m;
    if ((m = line.match(/^subgraph\s+\S+\s*\["(.+)"\]$/))) {
      group = { title: m[1], nodes: [] };
      groups.push(group);
    } else if (line === 'end') {
      group = null;
    } else if ((m = line.match(/^\w+\s*\(?\["(.+)"\]\)?$/))) {
      const node = m[1].replace(/<br\s*\/?>/g, '<br>');
      if (group) {
        group.nodes.push(node);
      } else {
        groups.push({ title: null, nodes: [node] });
      }
    }
  }
  if (groups.length === 0) {
    return null;
  }
  const box = (n) => `<li>${n}</li>`;
  return (
    '<ol class="pipeline">' +
    groups
      .map((g) =>
        g.title
          ? `<li class="group"><span class="group-title">${g.title}</span><ol>${g.nodes.map(box).join('')}</ol></li>`
          : g.nodes.map(box).join('')
      )
      .join('') +
    '</ol>'
  );
}

const marked = new Marked({
  gfm: true,
  renderer: {
    heading({ tokens, depth }) {
      const inner = this.parser.parseInline(tokens);
      return `<h${depth} id="${slug(inner)}">${inner}</h${depth}>\n`;
    },
    code({ text, lang }) {
      if (lang === 'mermaid') {
        const drawn = pipeline(text);
        if (drawn) {
          return drawn + '\n';
        }
      }
      return false; // marked's own rendering
    },
  },
});

// --- links and media ------------------------------------------------------------
function rewriteUrl(url) {
  if (url.startsWith(SITE)) {
    const rest = url.slice(SITE.length).replace(/^\//, '');
    return rest === '' ? './' : rest;
  }
  if (/^([a-z]+:|#|\/\/)/i.test(url)) {
    return url;
  }
  if (url.startsWith('media/')) {
    return url; // the site's own, put there by site/build.sh
  }
  if (url.startsWith('docs/brand/')) {
    return 'media/' + url.slice('docs/brand/'.length);
  }
  // Anything else is a file in the repository, so it had better be one.
  if (!fs.existsSync(path.join(path.dirname(readmePath), url.split(/[?#]/)[0]))) {
    missing.push(url);
  }
  return REPO + url;
}

const video = (clip, alt, cls = 'screen') =>
  `<figure class="${cls}"><video autoplay muted loop playsinline preload="metadata" ` +
  `poster="media/${clip}.png" aria-label="${alt}">` +
  `<source src="media/${clip}.webm" type="video/webm" />` +
  `<source src="media/${clip}.mp4" type="video/mp4" /></video></figure>`;

function rewriteHtml(html, { launch = false } = {}) {
  let first = launch;
  return html
    .replace(/<table>/g, '<div class="table"><table>')
    .replace(/<\/table>/g, '</table></div>')
    .replace(/<img alt="([^"]*)" src="demo\/recording\/([\w-]+)\.gif">/g, (_, alt, clip) => {
      const cls = first ? 'screen launch' : 'screen';
      first = false;
      return video(clip, alt, cls);
    })
    .replace(/\b(href|src|srcset)="([^"]+)"/g, (_, attr, url) => `${attr}="${rewriteUrl(url)}"`);
}

// --- the page ---------------------------------------------------------------------
const readme = fs.readFileSync(readmePath, 'utf8');
const frame = fs.readFileSync(framePath, 'utf8');

// The README opens with a centred block of plain HTML: that is the hero.
const heroMatch = readme.match(/^<div align="center">\n([\s\S]*?)\n<\/div>\n/);
if (!heroMatch) {
  console.error('README.md no longer opens with <div align="center">; site/render.cjs needs updating');
  process.exit(1);
}
const hero = rewriteHtml(
  heroMatch[1]
    .replace(/<picture>[\s\S]*?<\/picture>\s*/, '') // the page header already shows the lockup
    .replace(/<h3>([\s\S]*?)<\/h3>/, '<h1>$1</h1>')
    // A paragraph of nothing but links is a row of buttons.
    .replace(
      /<p>((?:\s*(?:<a [^>]+>[\s\S]*?<\/a>)\s*(?:·)?)+)<\/p>/g,
      (_, links) =>
        `<p class="actions">${links
          .replace(/\s*·\s*/g, ' ')
          .replace(/<a /g, '<a class="button quiet" ')
          .replace('button quiet', 'button')}</p>`
    )
    .replace(/<p>/, '<p class="lede">'),
  { launch: true }
);

// Everything after it, one section per ## heading.
const tokens = marked.lexer(readme.slice(heroMatch[0].length));
const sections = [[]];
for (const t of tokens) {
  if (t.type === 'heading' && t.depth === 2) {
    sections.push([]);
  }
  sections[sections.length - 1].push(t);
}
const body = sections
  .filter((s) => s.length > 0)
  .map((s) => {
    const tokensOf = Object.assign(s, { links: tokens.links });
    return `<section>\n${rewriteHtml(marked.parser(tokensOf))}</section>`;
  })
  .join('\n');

const marker = '<!-- README -->';
if (!frame.includes(marker)) {
  console.error(`${framePath} has no ${marker} to put the README in`);
  process.exit(1);
}
const page = frame.replace(marker, `<section class="hero">\n${hero}\n</section>\n${body}`);
fs.writeFileSync(path.join(outDir, 'index.html'), page);

// --- nothing on the page may point at nothing ---------------------------------------
for (const [, url] of page.matchAll(/\b(?:href|src|srcset|poster)="([^"]+)"/g)) {
  if (/^([a-z]+:|#|\/\/)/i.test(url) || url === './' || SERVED_ELSEWHERE.test(url)) {
    continue;
  }
  const file = path.join(outDir, url.split(/[?#]/)[0]);
  if (!fs.existsSync(file)) {
    missing.push(url);
  }
}
const ids = new Set([...page.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
for (const [, id] of page.matchAll(/\bhref="#([^"]+)"/g)) {
  if (!ids.has(id)) {
    missing.push('#' + id);
  }
}
if (missing.length > 0) {
  console.error('The site points at things that are not there:\n  ' + [...new Set(missing)].join('\n  '));
  process.exit(1);
}
console.log(`Rendered README.md into ${path.join(outDir, 'index.html')}`);
