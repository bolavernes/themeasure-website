# THE MEASURE – Website (themeasure.watch)

Statische Website ohne Framework. Ein kleines Build-Script setzt Header, Footer und Journal zusammen und schreibt alles nach `dist/`.

```
src/            Seiten (index, impressum, datenschutz, 404)
partials/       Header, Footer, Logo-Sprite (aus den Original-SVGs)
assets/         CSS, JS (GSAP, ScrollTrigger, Lenis – selbst gehostet), Schriften (WOFF2), Bilder
static/         Favicon, robots.txt – landen direkt im Wurzelverzeichnis
content/        posts.json + media/  →  Startinhalt des Journals (live liegt es in Netlify Blobs)
netlify/        Journal-Bot (Telegram) und Live-Journal als Netlify Functions
netlify.toml    Build-Einstellungen für Netlify
build.mjs       node build.mjs  →  dist/
```

## Lokal ansehen

```
node build.mjs
cd dist && python3 -m http.server 8000
```
Dann http://localhost:8000 öffnen. (Direkt per Doppelklick auf die HTML-Datei geht nicht, weil die Pfade absolut sind.)

## Online stellen (Netlify, mit GitHub verbunden)

1. Dieses Repo liegt auf GitHub unter `bolavernes/themeasure-website`.
2. Netlify → **Add new project → Import an existing project → GitHub** → `themeasure-website` wählen.
   Die Build-Einstellungen kommen aus `netlify.toml` (Build `node build.mjs`, Ordner `dist`), nichts eintippen.
3. Später unter **Domain management** `themeasure.watch` verbinden.

Jeder Commit ins Repo baut die Seite neu (kostet einen Deploy). Journal-Beiträge brauchen **keinen** Deploy: der Bot speichert sie in Netlify Blobs, die Seiten `/journal/…` werden live daraus erzeugt und gecacht.

## Journal per Telegram

Philipp schreibt dem Bot direkt, wie einem Kontakt.

- **Einfügen:** Fotos auswählen (gern mehrere), Text dazuschreiben, senden. Die erste Zeile wird der Titel. Der Bot zeigt eine Vorschau → **Veröffentlichen**. Was nachgeschickt wird, landet im selben Entwurf.
- **Bearbeiten:** auf die Bestätigung des Bots antworten, oder `/liste` → Beitrag → **Bearbeiten**. Neuer Text ersetzt den alten, neue Fotos kommen dazu. Vorschau → **Übernehmen**.
- **Löschen:** `/liste` → Beitrag → **Löschen** → bestätigen.
- `/neu` verwirft einen angefangenen Entwurf.
- Fotos als normales Foto schicken (ideal fürs Web). Videos übernimmt der Bot nicht: auf YouTube/Vimeo laden und den Link in den Text schreiben.

### Einrichtung (einmalig, ca. 10 Minuten)

1. **Bot anlegen:** Telegram → @BotFather → `/newbot` → Name „The Measure Journal“, Benutzername z. B. `themeasure_journal_bot` → **Token** kopieren.
2. **Netlify → Project configuration → Environment variables**:

   | Name | Wert |
   |---|---|
   | `TELEGRAM_TOKEN` | Token aus Schritt 1 |
   | `TELEGRAM_SECRET` | lange Zufallszeichenkette |
   | `SITE_URL` | die Netlify-Adresse, später `https://themeasure.watch` |
   | `ALLOWED_USER_IDS` | Telegram-IDs von Philipp und Bola, mit Komma getrennt |

   Danach **Deploys → Trigger deploy**, damit die Werte greifen.
3. **Verbinden:** einmal im Browser öffnen: `https://<netlify-adresse>/api/telegram-setup?secret=<TELEGRAM_SECRET>`. Steht dort `"ok": true`, ist der Bot verbunden.
4. **IDs:** Philipp und Bola schreiben dem Bot `/id`, die Zahlen bei `ALLOWED_USER_IDS` eintragen, neu deployen.
5. Philipp schreibt `/hilfe` und schickt einen Testbeitrag.

Kosten: Telegram und Netlify Blobs/Functions in diesem Umfang praktisch null Credits. Nur Code-Änderungen (Commits) kosten je einen Deploy.

## Vor dem Livegang offen

- Webfont-Lizenz (Pangram Pangram) für PP Frama / PP Playground im Web.
- Impressum und Datenschutz: Firmendaten und Hoster eintragen (`src/impressum.html`, `src/datenschutz.html`, Stellen mit „[ergänzen]“), Datenschutz prüfen lassen.
- Mailadresse auf philipp@themeasure.watch umgestellt (Schreibweise immer „Philipp“). Prüfen, dass das Postfach so existiert.
- „Über den Start informiert werden“ öffnet derzeit eine Mail. Für eine echte Liste: Newsletter-Tool (z. B. Brevo) anbinden.
- Fotos: Josef Bar, Philipp, Vitrinen, Uhren. Bildplätze sind vorbereitet (`assets/img/`).
- Favicon: aus LOGO/theMEASURE_favicon.svg (hell/dunkel-Variante im SVG).
