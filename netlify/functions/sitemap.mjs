/* sitemap.xml live aus dem Journal-Speicher: neue Beiträge vom Bot sind sofort drin, gelöschte fliegen raus. */
import { loadPosts } from "../lib/journal.mjs";
import { sortPosts } from "../lib/render.mjs";

export const config = { path: "/sitemap.xml" };

const SITE = "https://themeasure.watch";

export default async () => {
  const posts = sortPosts((await loadPosts()).posts);
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    [`${SITE}/`, today], [`${SITE}/en/`, today],
    [`${SITE}/journal/`, posts[0] ? (posts[0].updated || posts[0].date) : today],
    ...posts.map((p) => [`${SITE}/journal/${p.slug}/`, p.updated || p.date]),
    [`${SITE}/impressum/`, today], [`${SITE}/datenschutz/`, today]
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, d]) => `  <url><loc>${u}</loc><lastmod>${String(d).slice(0, 10)}</lastmod></url>`).join("\n")}
</urlset>
`;
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      "netlify-cdn-cache-control": "public, durable, max-age=31536000, stale-while-revalidate=60",
      "netlify-cache-tag": "journal"
    }
  });
};
