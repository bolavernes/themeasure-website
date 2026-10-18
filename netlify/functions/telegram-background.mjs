/**
 * THE MEASURE – Journal-Bot (Telegram → GitHub → Netlify baut neu)
 *
 * Philipp schreibt dem Bot direkt:
 *   Einfügen   Fotos und Text schicken → Vorschau → „Veröffentlichen“
 *   Bearbeiten auf die Bestätigung des Bots antworten, oder /liste → Beitrag → „Bearbeiten“
 *              neuer Text ersetzt den alten (erste Zeile = Titel), neue Fotos kommen dazu
 *   Löschen    /liste → Beitrag → „Löschen“ → bestätigen
 *
 * Läuft als Netlify Background Function: Telegram bekommt sofort eine Antwort, die Arbeit läuft danach.
 */
import {
  env, store, tg, send, edit, downloadTelegramFile, readPosts, commit, postsFile,
  splitText, slugify, viennaNow, imageSize
} from "../lib/journal.mjs";

export const config = { path: "/api/telegram" };

const SITE = () => env("SITE_URL", "https://themeasure.watch").replace(/\/$/, "");
const postUrl = (slug) => `${SITE()}/journal/${slug}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async (req) => {
  if (req.headers.get("x-telegram-bot-api-secret-token") !== env("TELEGRAM_SECRET")) return new Response("forbidden", { status: 403 });
  const update = await req.json();
  try {
    await handle(update);
  } catch (e) {
    console.error(e);
    const chat = (update.message && update.message.chat.id) || (update.callback_query && update.callback_query.message.chat.id);
    if (chat) await send(chat, `Das hat nicht geklappt: ${e.message}\nBitte noch einmal versuchen oder Bola Bescheid geben.`);
  }
  return new Response("ok");
};

function allowed(userId) {
  return env("ALLOWED_USER_IDS").split(",").map((s) => s.trim()).filter(Boolean).includes(String(userId));
}

/* ================================================================ Eingang */

async function handle(u) {
  if (u.callback_query) return onButton(u.callback_query);
  const m = u.message;
  if (!m || m.chat.type !== "private") return;
  const chat = m.chat.id;
  const text = (m.text || m.caption || "").trim();

  if (text === "/id") return send(chat, `Deine Telegram-ID: ${m.from.id}`);
  if (!allowed(m.from.id)) return send(chat, `Dieser Bot ist nur für The Measure freigeschaltet.\nDeine Telegram-ID: ${m.from.id}`);

  if (text.startsWith("/")) return command(text, chat);

  const photo = largestPhoto(m);
  if (!text && !photo) return send(chat, "Ich übernehme Fotos und Text. Videos bitte auf YouTube oder Vimeo laden und den Link in den Text schreiben.");

  const s = store();
  const meta = (await s.get(`draft/${chat}/meta`, { type: "json" })) || {};

  // Antwort auf eine Bestätigung des Bots: das ist eine Änderung an genau diesem Beitrag
  if (m.reply_to_message) {
    const slug = await s.get(`map/${chat}/${m.reply_to_message.message_id}`, { type: "text" });
    if (slug && meta.target !== slug) {
      await clearDraft(chat);
      Object.assign(meta, { target: slug });
      await s.setJSON(`draft/${chat}/meta`, meta);
    }
  }

  await s.setJSON(`draft/${chat}/item/${String(m.message_id).padStart(12, "0")}`, {
    id: m.message_id, text, photo: photo || null
  });

  // Alben kommen als mehrere Nachrichten gleichzeitig: nur die neueste zeigt die Vorschau
  await sleep(2500);
  const items = await draftItems(chat);
  if (!items.length || items[items.length - 1].id !== m.message_id) return;
  await showPreview(chat, items);
}

function largestPhoto(m) {
  if (m.photo && m.photo.length) { const p = m.photo[m.photo.length - 1]; return { file_id: p.file_id, width: p.width, height: p.height }; }
  if (m.document && /^image\/(jpeg|png|webp)$/.test(m.document.mime_type || "") && m.document.file_size < 19 * 1024 * 1024) {
    return { file_id: m.document.file_id, width: null, height: null };
  }
  return null;
}

async function draftItems(chat) {
  const s = store();
  const { blobs } = await s.list({ prefix: `draft/${chat}/item/` });
  const items = [];
  for (const b of blobs.sort((a, c) => a.key.localeCompare(c.key))) {
    const it = await s.get(b.key, { type: "json" });
    if (it) items.push(it);
  }
  return items;
}

async function clearDraft(chat) {
  const s = store();
  const { blobs } = await s.list({ prefix: `draft/${chat}/` });
  for (const b of blobs) await s.delete(b.key);
}

/* ================================================================ Vorschau */

async function showPreview(chat, items) {
  const s = store();
  const meta = (await s.get(`draft/${chat}/meta`, { type: "json" })) || {};
  const allText = items.map((i) => i.text).filter(Boolean).join("\n\n");
  const photos = items.filter((i) => i.photo).length;
  const { title, body } = splitText(allText);
  let head, buttons;

  if (meta.target) {
    const data = await readPosts();
    const post = data.posts.find((p) => p.slug === meta.target);
    head = `Änderung für „${post ? post.title : meta.target}“\n`
      + (allText ? `Neuer Titel: ${title}\nNeuer Text: ${body ? short(body) : "(nur Titel)"}\n` : "Text bleibt gleich.\n")
      + (photos ? `${photos} ${photos === 1 ? "Foto kommt" : "Fotos kommen"} dazu.` : "Keine neuen Fotos.");
    buttons = [[["Übernehmen", "pub"], ["Verwerfen", "drop"]]];
  } else {
    head = `Neuer Beitrag\nTitel: ${title || "(noch kein Text, erste Zeile wird der Titel)"}\n`
      + (body ? `Text: ${short(body)}\n` : "")
      + `${photos} ${photos === 1 ? "Foto" : "Fotos"}`
      + `\n\nDu kannst noch mehr schicken, die Vorschau wächst mit.`;
    buttons = [[["Veröffentlichen", "pub"], ["Verwerfen", "drop"]]];
  }
  if (meta.previewId) await tg("deleteMessage", { chat_id: chat, message_id: meta.previewId }).catch(() => {});
  const r = await send(chat, head, buttons);
  meta.previewId = r.result && r.result.message_id;
  await s.setJSON(`draft/${chat}/meta`, meta);
}
const short = (t) => (t.length > 140 ? t.slice(0, t.lastIndexOf(" ", 137)) + " …" : t).replace(/\n+/g, " ");

/* ================================================================ Knöpfe */

async function onButton(cq) {
  const chat = cq.message.chat.id, mid = cq.message.message_id;
  await tg("answerCallbackQuery", { callback_query_id: cq.id });
  if (!allowed(cq.from.id)) return;
  const [action, slug] = cq.data.split(":");
  const s = store();

  if (action === "drop") { await clearDraft(chat); return edit(chat, mid, "Entwurf verworfen."); }
  if (action === "cancel") return edit(chat, mid, "Abgebrochen.");

  if (action === "pub") {
    const meta = (await s.get(`draft/${chat}/meta`, { type: "json" })) || {};
    if (meta.publishing) return;
    meta.publishing = true; await s.setJSON(`draft/${chat}/meta`, meta);
    await edit(chat, mid, "Wird übernommen …");
    const items = await draftItems(chat);
    if (!items.length) { await clearDraft(chat); return edit(chat, mid, "Der Entwurf ist leer."); }
    const result = meta.target ? await applyChange(meta.target, items) : await publishNew(items);
    await clearDraft(chat);
    await edit(chat, mid, meta.target ? "Änderung übernommen." : "Veröffentlicht.");
    return confirm(chat, result.slug, result.title, meta.target ? "Geändert. In etwa einer Minute ist es online:" : "Online in etwa einer Minute:");
  }

  if (action === "post") {
    const data = await readPosts();
    const p = data.posts.find((x) => x.slug === slug);
    if (!p) return edit(chat, mid, "Diesen Beitrag gibt es nicht mehr.");
    return send(chat, `${p.title}\n${p.date}\n${postUrl(p.slug)}`, [[["Bearbeiten", `edit:${p.slug}`], ["Löschen", `del:${p.slug}`]], [["Ansehen", postUrl(p.slug)]]]);
  }

  if (action === "edit") {
    await clearDraft(chat);
    await s.setJSON(`draft/${chat}/meta`, { target: slug });
    return send(chat, "Schick mir jetzt die Änderung:\n• neuer Text ersetzt den alten (erste Zeile = Titel)\n• neue Fotos kommen dazu\nDanach zeige ich dir eine Vorschau.");
  }

  if (action === "del") {
    return edit(chat, mid, `${cq.message.text.split("\n")[0]}\n\nWirklich von der Website löschen?`, [[["Ja, löschen", `delok:${slug}`], ["Abbrechen", "cancel"]]]);
  }

  if (action === "delok") {
    const data = await readPosts();
    const post = data.posts.find((p) => p.slug === slug);
    if (!post) return edit(chat, mid, "Diesen Beitrag gibt es schon nicht mehr.");
    data.posts = data.posts.filter((p) => p.slug !== slug);
    const files = [postsFile(data), ...(post.images || []).filter((im) => im.src.startsWith("/media/")).map((im) => ({ path: "content" + im.src, delete: true }))];
    await commit(files, `Journal: „${post.title}“ gelöscht`);
    return edit(chat, mid, `Gelöscht: „${post.title}“. In etwa einer Minute ist der Beitrag von der Website verschwunden.`);
  }
}

async function confirm(chat, slug, title, lead) {
  const r = await send(chat, `${lead}\n${title}\n${postUrl(slug)}\n\nTipp: Antworte auf diese Nachricht, um den Beitrag zu ändern.`, [[["Ansehen", postUrl(slug)]], [["Bearbeiten", `edit:${slug}`], ["Löschen", `del:${slug}`]]]);
  if (r.result) await store().set(`map/${chat}/${r.result.message_id}`, slug);
}

/* ================================================================ Befehle */

async function command(text, chat) {
  const cmd = text.split(/\s+/)[0].replace(/@.*$/, "");
  if (cmd === "/start" || cmd === "/hilfe") {
    return send(chat, [
      "So kommt ein Beitrag ins Journal auf themeasure.watch:",
      "",
      "Einfügen: Fotos auswählen (gern mehrere), Text dazuschreiben, senden. Die erste Zeile wird der Titel. Ich zeige dir eine Vorschau, du tippst auf „Veröffentlichen“.",
      "",
      "Bearbeiten: auf meine Bestätigung antworten, oder /liste → Beitrag → Bearbeiten. Neuer Text ersetzt den alten, neue Fotos kommen dazu.",
      "",
      "Löschen: /liste → Beitrag → Löschen.",
      "",
      "/liste  alle Beiträge\n/neu  Entwurf verwerfen und neu anfangen"
    ].join("\n"));
  }
  if (cmd === "/neu" || cmd === "/abbrechen") { await clearDraft(chat); return send(chat, "Alles zurückgesetzt. Schick mir Fotos und Text für einen neuen Beitrag."); }
  if (cmd === "/liste") {
    const data = await readPosts();
    const posts = data.posts.slice().sort((a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || ""))).slice(0, 12);
    if (!posts.length) return send(chat, "Noch keine Beiträge. Schick mir Fotos und Text für den ersten.");
    return send(chat, "Welchen Beitrag?", posts.map((p) => [[`${p.date.slice(8, 10)}.${p.date.slice(5, 7)}.  ${p.title}`.slice(0, 60), `post:${p.slug}`]]));
  }
  return send(chat, "Den Befehl kenne ich nicht. /hilfe zeigt, was geht.");
}

/* ================================================================ Schreiben */

async function photosToFiles(items, slug, startAt, title) {
  const files = [], images = [];
  let k = startAt;
  for (const it of items.filter((i) => i.photo)) {
    const { bytes, ext } = await downloadTelegramFile(it.photo.file_id);
    const src = `/media/${slug}/${k}-${Date.now().toString(36)}.${ext}`;
    files.push({ path: "content" + src, bytes });
    const size = it.photo.width ? { width: it.photo.width, height: it.photo.height } : imageSize(bytes);
    images.push({ src, width: size.width || 1600, height: size.height || 1067, alt: k === 1 ? title : `${title}, Bild ${k}` });
    k++;
  }
  return { files, images };
}

async function publishNew(items) {
  const { title: t, body } = splitText(items.map((i) => i.text).filter(Boolean).join("\n\n"));
  const now = viennaNow();
  const title = t || `Eindrücke vom ${now.date.split("-").reverse().join(".")}`;
  const data = await readPosts();
  let slug = slugify(title) || `beitrag-${now.date}`, n = 2;
  const base = slug;
  while (data.posts.some((p) => p.slug === slug)) slug = `${base}-${n++}`;
  const { files, images } = await photosToFiles(items, slug, 1, title);
  data.posts.unshift({ slug, title, date: now.date, time: now.time, body, images, source: "telegram" });
  await commit([...files, postsFile(data)], `Journal: ${title}`);
  return { slug, title };
}

async function applyChange(slug, items) {
  const data = await readPosts();
  const post = data.posts.find((p) => p.slug === slug);
  if (!post) throw new Error("Diesen Beitrag gibt es nicht mehr.");
  const allText = items.map((i) => i.text).filter(Boolean).join("\n\n");
  if (allText) { const { title, body } = splitText(allText); post.title = title || post.title; post.body = body; }
  const { files, images } = await photosToFiles(items, slug, (post.images || []).length + 1, post.title);
  post.images = [...(post.images || []), ...images];
  post.updated = viennaNow().date;
  await commit([...files, postsFile(data)], `Journal: „${post.title}“ geändert`);
  return { slug, title: post.title };
}
