/* Die neuesten Beiträge als JSON für die Karten auf der Startseite. */
import { loadPosts } from "../lib/journal.mjs";
import { card, sortPosts } from "../lib/render.mjs";

export const config = { path: "/api/journal.json" };

export default async () => {
  const posts = sortPosts((await loadPosts()).posts).slice(0, 3);
  return Response.json({ html: posts.map((p, i) => card(p, i)).join("\n"), count: posts.length }, {
    headers: {
      "cache-control": "public, max-age=0, must-revalidate",
      "netlify-cdn-cache-control": "public, durable, max-age=31536000, stale-while-revalidate=60",
      "netlify-cache-tag": "journal"
    }
  });
};
