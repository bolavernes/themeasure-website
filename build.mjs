#!/usr/bin/env node
/* THE MEASURE – Build
   Baut die statische Website nach dist/:
   - Seiten aus src/ mit Header, Footer und Logo-Sprite
   - Journal (Übersicht + eine Seite pro Beitrag) aus content/posts.json
   - die drei neuesten Beiträge als Karten auf der Startseite
   - sitemap.xml
   Keine Abhängigkeiten, nur Node 18+.  Aufruf: node build.mjs */

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, "dist");
const SITE = "https://themeasure.watch";
const read = (p) => readFileSync(join(ROOT, p), "utf8");

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(join(ROOT, "assets"), join(DIST, "assets"), { recursive: true });
cpSync(join(ROOT, "static"), DIST, { recursive: true });
if (existsSync(join(ROOT, "content/media"))) cpSync(join(ROOT, "content/media"), join(DIST, "media"), { recursive: true });

const sprite = read("partials/sprite.svg");
const headerTpl = read("partials/header.html");
const footer = read("partials/footer.html");
const VER = Date.now().toString(36);

const HEAD_COMMON = `<meta name="theme-color" content="#232323">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/PPFrama-Medium.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/PPFramaText-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/site.css?v=${VER}">`;

const SCRIPTS = `<script src="/assets/js/gsap.min.js" defer></script>
<script src="/assets/js/ScrollTrigger.min.js" defer></script>
<script src="/assets/js/lenis.min.js" defer></script>
<script src="/assets/js/site.js?v=${VER}" defer></script>`;

function page(html, { headerTheme = "paper", journalCurrent = false } = {}) {
  const header = headerTpl
    .replace("{{HEADER_THEME}}", headerTheme)
    .replace("{{JOURNAL_CURRENT}}", journalCurrent ? ' aria-current="page"' : "");
  return html
    .replace("{{HEAD_COMMON}}", HEAD_COMMON)
    .replace("{{SPRITE}}", sprite)
    .replace("{{HEADER}}", header)
    .replace("{{FOOTER}}", footer)
    .replace("{{SCRIPTS}}", SCRIPTS);
}
function out(path, html) {
  const file = join(DIST, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

/* ---------- Inhalte ---------- */
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const linkify = (s) => s.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
const paragraphs = (body = "") => body.trim().split(/\n\s*\n/).map((p) => `<p>${linkify(esc(p.trim())).replace(/\n/g, "<br>")}</p>`).join("\n");
const months = ["Jänner", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const fmtDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d}. ${months[m - 1]} ${y}`; };
const excerpt = (p) => { const t = (p.excerpt || p.body || "").replace(/\s+/g, " ").trim(); return t.length > 150 ? t.slice(0, t.lastIndexOf(" ", 147)) + " …" : t; };

const data = JSON.parse(read("content/posts.json"));
const posts = (data.posts || []).filter((p) => !p.hidden).sort((a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")));

function card(p, i = 0, tag = "h3") {
  const img = p.images && p.images[0];
  return `<a class="card" href="/journal/${p.slug}/" data-reveal style="--d:${i}">
  ${img ? `<div class="frame"><img src="${esc(img.src)}" alt="${esc(img.alt || p.title)}" width="${img.width || 1200}" height="${img.height || 900}" loading="lazy"></div>` : ""}
  <p class="tm-overline">Journal · ${fmtDate(p.date)}</p>
  <${tag} class="h3">${esc(p.title)}</${tag}>
  <p>${esc(excerpt(p))}</p>
</a>`;
}

/* ---------- Startseite ---------- */
let index = read("src/index.html");
const latest = posts.slice(0, 3);
index = index.replace("<!--JOURNAL-CARDS-->", latest.length ? `<div class="cards">\n${latest.map((p, i) => card(p, i)).join("\n")}\n</div>` : "");
out("index.html", page(index, { headerTheme: "hero" }));

/* ---------- Weitere Seiten aus src/ ---------- */
for (const f of readdirSync(join(ROOT, "src"))) {
  if (f === "index.html" || !f.endsWith(".html")) continue;
  const name = f.replace(/\.html$/, "");
  const target = name === "404" ? "404.html" : `${name}/index.html`;
  out(target, page(read(`src/${f}`)));
}

/* ---------- Journal ---------- */
function shell({ title, description, canonical, ogImage, body, jsonld = "" }) {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta name="twitter:card" content="summary_large_image">
{{HEAD_COMMON}}
${jsonld}
</head>
<body>
{{SPRITE}}
{{HEADER}}
<main id="inhalt">
${body}
</main>
{{FOOTER}}
{{SCRIPTS}}
</body>
</html>`;
}

out("journal/index.html", page(shell({
  title: "Journal – The Measure",
  description: "Geschichten, Bilder und Uhrenwissen aus The Measure in der Josef Cocktailbar in Wien.",
  canonical: `${SITE}/journal/`,
  ogImage: `${SITE}/assets/img/og.jpg`,
  body: `<section class="section tm-paper page-top">
  <div class="wrap">
    <div class="grid">
      <div class="page-title"><p class="tm-overline">Journal</p><h1>Watches · Stories · People</h1></div>
      <p class="page-lead">Geschichten, Bilder und Uhrenwissen aus The Measure. Direkt aus der Josef Cocktailbar in Wien.</p>
    </div>
    ${posts.length ? `<div class="cards">\n${posts.map((p, i) => card(p, i % 3, "h2")).join("\n")}\n</div>` : `<p class="empty-note">Die ersten Beiträge erscheinen hier in Kürze.</p>`}
  </div>
</section>`
}), { journalCurrent: true }));

for (const p of posts) {
  const [cover, ...rest] = p.images || [];
  const desc = excerpt(p).slice(0, 160);
  const url = `${SITE}/journal/${p.slug}/`;
  const jsonld = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "BlogPosting", headline: p.title, datePublished: p.date,
    author: { "@type": "Person", name: p.author || "Philipp M. Ernst" }, publisher: { "@type": "Organization", name: "The Measure" },
    image: cover ? SITE + cover.src : undefined, mainEntityOfPage: url
  })}</script>`;
  out(`journal/${p.slug}/index.html`, page(shell({
    title: `${p.title} – The Measure`,
    description: desc,
    canonical: url,
    ogImage: cover ? SITE + cover.src : `${SITE}/assets/img/og.jpg`,
    jsonld,
    body: `<article class="section tm-paper page-top">
  <div class="wrap">
    <a class="back" href="/journal/">← Journal</a>
    <div class="grid"><div class="page-title"><p class="tm-overline">${fmtDate(p.date)}</p><h1>${esc(p.title)}</h1></div></div>
    ${cover ? `<figure class="post-hero"><div class="frame" data-shutter><img src="${esc(cover.src)}" alt="${esc(cover.alt || p.title)}" width="${cover.width || 1600}" height="${cover.height || 1067}"></div></figure>` : ""}
    <div class="post-body"><div class="prose">${paragraphs(p.body)}</div></div>
    ${rest.length ? `<div class="post-gallery">${rest.map((im) => `<figure><div class="frame"><img src="${esc(im.src)}" alt="${esc(im.alt || p.title)}" width="${im.width || 1200}" height="${im.height || 900}" loading="lazy"></div></figure>`).join("")}</div>` : ""}
  </div>
</article>`
  }), { journalCurrent: true }));
}

/* ---------- Sitemap ---------- */
const today = new Date().toISOString().slice(0, 10);
const urls = [
  [`${SITE}/`, today], [`${SITE}/journal/`, posts[0]?.date || today],
  ...posts.map((p) => [`${SITE}/journal/${p.slug}/`, p.date]),
  [`${SITE}/impressum/`, today], [`${SITE}/datenschutz/`, today]
];
out("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, d]) => `  <url><loc>${u}</loc><lastmod>${d}</lastmod></url>`).join("\n")}
</urlset>
`);

console.log(`Gebaut: ${posts.length} Journal-Beitrag/Beiträge → dist/`);
