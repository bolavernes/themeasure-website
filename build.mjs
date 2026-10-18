#!/usr/bin/env node
/* THE MEASURE – Build
   Baut die statische Website nach dist/:
   - Seiten aus src/ mit Header, Footer und Logo-Sprite
   - Journal (Übersicht + eine Seite pro Beitrag) aus content/posts.json als statische Vorschau
   - die drei neuesten Beiträge als Karten auf der Startseite
   - sitemap.xml
   - netlify/lib/templates.generated.mjs: Header, Footer usw. für das Live-Journal (Netlify Function)
   Live auf Netlify kommt das Journal aus Netlify Blobs (der Telegram-Bot schreibt dorthin, ohne Deploy).
   Keine Abhängigkeiten, nur Node 18+.  Aufruf: node build.mjs */

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { card, journalIndexHtml, postHtml, page as renderPage, sortPosts } from "./netlify/lib/render.mjs";

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

const TPL = { head: HEAD_COMMON, sprite, header: headerTpl, footer, scripts: SCRIPTS };
const page = (html, opts) => renderPage(html, TPL, opts);
writeFileSync(join(ROOT, "netlify/lib/templates.generated.mjs"),
  "// Automatisch erzeugt von build.mjs. Nicht von Hand ändern.\nexport default " + JSON.stringify(TPL) + ";\n"
  + "export const seed = " + read("content/posts.json").trim() + ";\n");
function out(path, html) {
  const file = join(DIST, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

/* ---------- Inhalte ---------- */
const data = JSON.parse(read("content/posts.json"));
const posts = sortPosts(data.posts);

/* ---------- Startseite ---------- */
let index = read("src/index.html");
const latest = posts.slice(0, 3);
index = index.replace("<!--JOURNAL-CARDS-->", `<div class="cards" data-journal-cards>\n${latest.map((p, i) => card(p, i)).join("\n")}\n</div>`);
out("index.html", page(index, { headerTheme: "hero" }));

/* ---------- Weitere Seiten aus src/ ---------- */
for (const f of readdirSync(join(ROOT, "src"))) {
  if (f === "index.html" || !f.endsWith(".html")) continue;
  const name = f.replace(/\.html$/, "");
  const target = name === "404" ? "404.html" : `${name}/index.html`;
  out(target, page(read(`src/${f}`)));
}

/* ---------- Journal (statische Vorschau; live rendert die Netlify Function) ---------- */
out("journal/index.html", journalIndexHtml(posts, TPL, SITE));
for (const p of posts) out(`journal/${p.slug}/index.html`, postHtml(p, TPL, SITE));

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
