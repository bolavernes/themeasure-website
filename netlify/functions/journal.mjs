/* Live-Journal: rendert Übersicht und Beiträge aus Netlify Blobs.
   Antworten werden im Netlify-CDN gecacht und beim Speichern durch den Bot geleert (Cache-Tag "journal"). */
import { loadPosts, env } from "../lib/journal.mjs";
import { journalIndexHtml, postHtml, sortPosts } from "../lib/render.mjs";
import tpl from "../lib/templates.generated.mjs";

export const config = { path: ["/journal", "/journal/", "/journal/*"] };

const headers = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "public, max-age=0, must-revalidate",
  "netlify-cdn-cache-control": "public, durable, max-age=31536000, stale-while-revalidate=60",
  "netlify-cache-tag": "journal"
};

export default async (req) => {
  const site = env("SITE_URL", "https://themeasure.watch").replace(/\/$/, "");
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  const posts = sortPosts((await loadPosts()).posts);
  if (path === "/journal") return new Response(journalIndexHtml(posts, tpl, site), { headers });
  const slug = decodeURIComponent(path.slice("/journal/".length));
  const post = posts.find((p) => p.slug === slug);
  if (!post) return new Response(null, { status: 404, headers: { "netlify-cache-tag": "journal" } });
  if (!new URL(req.url).pathname.endsWith("/")) return Response.redirect(new URL(`/journal/${slug}/`, req.url), 301);
  return new Response(postHtml(post, tpl, site), { headers });
};
