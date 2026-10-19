/* THE MEASURE – HTML für das Journal.
   Wird vom Build (statische Vorschau) und von der Netlify Function (live, ohne Deploy) genutzt. */

export const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const linkify = (s) => s.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
export const paragraphs = (body = "") => body.trim() ? body.trim().split(/\n\s*\n/).map((p) => `<p>${linkify(esc(p.trim())).replace(/\n/g, "<br>")}</p>`).join("\n") : "";
const months = ["Jänner", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
export const fmtDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d}. ${months[m - 1]} ${y}`; };
export const excerpt = (p) => { const t = (p.excerpt || p.body || "").replace(/\s+/g, " ").trim(); return t.length > 150 ? t.slice(0, t.lastIndexOf(" ", 147)) + " …" : t; };
export const sortPosts = (posts) => (posts || []).filter((p) => !p.hidden).sort((a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")));

export function card(p, i = 0, tag = "h3") {
  const img = p.images && p.images[0];
  return `<a class="card" href="/journal/${p.slug}/" data-reveal style="--d:${i}">
  ${img ? `<div class="frame"><img src="${esc(img.src)}" alt="${esc(img.alt || p.title)}" width="${img.width || 1200}" height="${img.height || 900}" loading="lazy"></div>` : ""}
  <p class="tm-overline">Journal · ${fmtDate(p.date)}</p>
  <${tag} class="h3">${esc(p.title)}</${tag}>
  <p>${esc(excerpt(p))}</p>
</a>`;
}

export function page(html, tpl, { headerTheme = "paper", journalCurrent = false, lang = "de", deHref = "/", enHref = "/en/" } = {}) {
  const cur = ' aria-current="true"';
  const header = tpl.header
    .replace("{{HEADER_THEME}}", headerTheme)
    .replace("{{JOURNAL_CURRENT}}", journalCurrent ? ' aria-current="page"' : "")
    .replace("{{LANG_DE_HREF}}", deHref).replace("{{LANG_EN_HREF}}", enHref)
    .replace("{{LANG_DE_CUR}}", lang === "de" ? cur : "").replace("{{LANG_EN_CUR}}", lang === "en" ? cur : "");
  return html
    .replace("{{HEAD_COMMON}}", tpl.head)
    .replace("{{SPRITE}}", tpl.sprite)
    .replace("{{HEADER}}", header)
    .replace("{{FOOTER}}", tpl.footer)
    .replace("{{SCRIPTS}}", tpl.scripts);
}

function shell({ title, description, canonical, ogImage, body, jsonld = "", type = "article" }) {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="${type}">
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

export function journalIndexHtml(posts, tpl, site) {
  return page(shell({
    title: "Journal – The Measure",
    description: "Geschichten, Bilder und Uhrenwissen aus The Measure in der Josef Cocktailbar in Wien.",
    canonical: `${site}/journal/`,
    ogImage: `${site}/assets/img/og.jpg`,
    type: "website",
    body: `<section class="section tm-paper page-top">
  <div class="wrap">
    <div class="grid">
      <div class="page-title"><p class="tm-overline">Journal</p><h1>Watches · Stories · People</h1></div>
      <p class="page-lead">Geschichten, Bilder und Uhrenwissen aus The Measure. Direkt aus der Josef Cocktailbar in Wien.</p>
    </div>
    ${posts.length ? `<div class="cards">\n${posts.map((p, i) => card(p, i % 3, "h2")).join("\n")}\n</div>` : `<p class="empty-note">Die ersten Beiträge erscheinen hier in Kürze.</p>`}
  </div>
</section>`
  }), tpl, { journalCurrent: true, deHref: "/journal/" });
}

export function postHtml(p, tpl, site) {
  const [cover, ...rest] = p.images || [];
  const url = `${site}/journal/${p.slug}/`;
  const abs = (src) => (src.startsWith("http") ? src : site + src);
  const jsonld = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "BlogPosting", headline: p.title, datePublished: p.date,
    ...(p.updated ? { dateModified: p.updated } : {}),
    author: { "@type": "Person", name: p.author || "Philipp M. Ernst" }, publisher: { "@type": "Organization", name: "The Measure" },
    image: cover ? abs(cover.src) : undefined, mainEntityOfPage: url
  }).replace(/</g, "\\u003c")}</script>`;
  return page(shell({
    title: `${p.title} – The Measure`,
    description: excerpt(p).slice(0, 160) || p.title,
    canonical: url,
    ogImage: cover ? abs(cover.src) : `${site}/assets/img/og.jpg`,
    jsonld,
    body: `<article class="section tm-paper page-top">
  <div class="wrap">
    <a class="back" href="/journal/">← Journal</a>
    <div class="grid"><div class="page-title"><p class="tm-overline">${fmtDate(p.date)}</p><h1>${esc(p.title)}</h1></div></div>
    ${cover ? `<figure class="post-hero"><div class="frame" data-shutter><img src="${esc(cover.src)}" alt="${esc(cover.alt || p.title)}" width="${cover.width || 1600}" height="${cover.height || 1067}"></div></figure>` : ""}
    ${p.body ? `<div class="post-body"><div class="prose">${paragraphs(p.body)}</div></div>` : ""}
    ${rest.length ? `<div class="post-gallery">${rest.map((im) => `<figure><div class="frame"><img src="${esc(im.src)}" alt="${esc(im.alt || p.title)}" width="${im.width || 1200}" height="${im.height || 900}" loading="lazy"></div></figure>`).join("")}</div>` : ""}
  </div>
</article>`
  }), tpl, { journalCurrent: true, deHref: `/journal/${p.slug}/` });
}
