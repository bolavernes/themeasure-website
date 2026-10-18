/* THE MEASURE – Journal-Bot: gemeinsame Bausteine (Telegram, GitHub, Speicher) */
import { getStore } from "@netlify/blobs";

export const env = (k, d = "") => {
  try { const v = globalThis.Netlify && globalThis.Netlify.env && globalThis.Netlify.env.get(k); if (v) return v; } catch (e) {}
  return process.env[k] || d;
};

/* ---------- Speicher (Entwürfe, Zustände) ---------- */
export const store = () => getStore({ name: "themeasure-journal", consistency: "strong" });

/* ---------- Telegram ---------- */
export async function tg(method, payload) {
  const r = await fetch(`https://api.telegram.org/bot${env("TELEGRAM_TOKEN")}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload)
  });
  return r.json();
}
export const kb = (rows) => ({ inline_keyboard: rows.map((row) => row.map(([text, data]) => (data.startsWith("http") ? { text, url: data } : { text, callback_data: data }))) });
export const send = (chatId, text, rows) => tg("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true, ...(rows ? { reply_markup: kb(rows) } : {}) });
export const edit = (chatId, messageId, text, rows) => tg("editMessageText", { chat_id: chatId, message_id: messageId, text, disable_web_page_preview: true, reply_markup: rows ? kb(rows) : { inline_keyboard: [] } });

export async function downloadTelegramFile(fileId) {
  const info = await tg("getFile", { file_id: fileId });
  if (!info.ok) throw new Error("Ein Foto ist zu groß (Telegram erlaubt Bots maximal 20 MB).");
  const path = info.result.file_path;
  const r = await fetch(`https://api.telegram.org/file/bot${env("TELEGRAM_TOKEN")}/${path}`);
  if (!r.ok) throw new Error("Ein Foto konnte nicht von Telegram geladen werden.");
  const ext = (path.split(".").pop() || "jpg").toLowerCase().replace("jpeg", "jpg");
  return { bytes: new Uint8Array(await r.arrayBuffer()), ext: ["jpg", "png", "webp"].includes(ext) ? ext : "jpg" };
}

/* ---------- GitHub: ein Commit pro Änderung, danach baut Netlify die Seite neu ---------- */
async function gh(path, init = {}) {
  const r = await fetch(`https://api.github.com/repos/${env("GITHUB_REPO")}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env("GITHUB_TOKEN")}`,
      accept: init.accept || "application/vnd.github+json",
      "user-agent": "themeasure-journal-bot",
      "x-github-api-version": "2022-11-28",
      ...(init.body ? { "content-type": "application/json" } : {})
    }
  });
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return init.accept === "application/vnd.github.raw+json" ? r.text() : r.json();
}

export async function readPosts() {
  const raw = await gh(`/contents/content/posts.json?ref=${env("GITHUB_BRANCH", "main")}`, { accept: "application/vnd.github.raw+json" });
  const data = JSON.parse(raw);
  data.posts = data.posts || [];
  return data;
}

function toBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function commit(files, message) {
  const branch = env("GITHUB_BRANCH", "main");
  const ref = await gh(`/git/ref/heads/${branch}`);
  const parent = ref.object.sha;
  const base = await gh(`/git/commits/${parent}`);
  const tree = [];
  for (const f of files) {
    if (f.delete) { tree.push({ path: f.path, mode: "100644", type: "blob", sha: null }); continue; }
    const blob = await gh("/git/blobs", { method: "POST", body: JSON.stringify(f.bytes ? { content: toBase64(f.bytes), encoding: "base64" } : { content: f.content, encoding: "utf-8" }) });
    tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  const newTree = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: base.tree.sha, tree }) });
  const c = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message, tree: newTree.sha, parents: [parent] }) });
  await gh(`/git/refs/heads/${branch}`, { method: "PATCH", body: JSON.stringify({ sha: c.sha }) });
}
export const postsFile = (data) => ({ path: "content/posts.json", content: JSON.stringify(data, null, 2) + "\n" });

/* ---------- Text ---------- */
export function splitText(raw) {
  const text = (raw || "").replace(/\r/g, "").trim();
  if (!text) return { title: "", body: "" };
  const lines = text.split("\n");
  let title = lines[0].trim();
  let rest = lines.slice(1).join("\n").trim();
  if (title.length > 90) {
    const cut = title.search(/[.!?](\s|$)/);
    const t = cut > 10 && cut < 90 ? title.slice(0, cut + 1) : title.slice(0, title.lastIndexOf(" ", 86));
    rest = (title.slice(t.length).trim() + "\n" + rest).trim();
    title = t;
  }
  return { title: title.replace(/[.:]$/, ""), body: rest };
}

export function slugify(s) {
  return s.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/, "");
}

export function viennaNow() {
  const d = new Date();
  const f = (o) => new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", ...o }).format(d);
  return { date: `${f({ year: "numeric" })}-${f({ month: "2-digit" })}-${f({ day: "2-digit" })}`, time: f({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) };
}

export function imageSize(b) {
  if (b[0] === 0x89 && b[1] === 0x50) return { width: (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19], height: (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23] };
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1], len = (b[i + 2] << 8) | b[i + 3];
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
    i += 2 + len;
  }
  return {};
}
