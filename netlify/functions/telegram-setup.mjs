/* Einmal im Browser aufrufen, um den Bot mit der Website zu verbinden:
   https://<deine-seite>/api/telegram-setup?secret=<TELEGRAM_SECRET> */
import { env, tg } from "../lib/journal.mjs";

export const config = { path: "/api/telegram-setup" };

export default async (req) => {
  const url = new URL(req.url);
  if (!env("TELEGRAM_SECRET") || url.searchParams.get("secret") !== env("TELEGRAM_SECRET")) return new Response("forbidden", { status: 403 });
  const hook = await tg("setWebhook", {
    url: `${url.origin}/api/telegram`,
    secret_token: env("TELEGRAM_SECRET"),
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true
  });
  const cmds = await tg("setMyCommands", { commands: [
    { command: "liste", description: "Alle Beiträge: ansehen, bearbeiten, löschen" },
    { command: "neu", description: "Entwurf verwerfen und neu anfangen" },
    { command: "hilfe", description: "So funktioniert's" }
  ] });
  const me = await tg("getMe", {});
  return Response.json({ webhook: hook, commands: cmds.ok, bot: me.result && me.result.username, repo: env("GITHUB_REPO") || "FEHLT", site: env("SITE_URL") || "FEHLT", erlaubt: env("ALLOWED_USER_IDS") || "noch niemand" });
};
