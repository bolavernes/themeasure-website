/* Fotos aus dem Journal (Netlify Blobs). Dateinamen sind eindeutig, daher lange cachebar. */
import { store } from "../lib/journal.mjs";

export const config = { path: "/media/*", preferStatic: true };

export default async (req) => {
  const key = "media/" + decodeURIComponent(new URL(req.url).pathname.slice("/media/".length));
  const res = await store().getWithMetadata(key, { type: "arrayBuffer" });
  if (!res) return new Response("Nicht gefunden", { status: 404 });
  return new Response(res.data, {
    headers: {
      "content-type": (res.metadata && res.metadata.contentType) || "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable"
    }
  });
};
