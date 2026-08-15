# X, der KI-Assistent von lynq-x.de

Dieser Ordner enthält den kleinen Server, der zwischen deiner Website und dem
Sprachmodell sitzt. Er läuft **komplett kostenlos** auf deinem Cloudflare-Account.

Kein API-Schlüssel, keine Kreditkarte, keine Rechnung: Cloudflare betreibt das
Sprachmodell selbst (das nennt sich *Workers AI*) und stellt dir jeden Tag ein
Gratis-Kontingent zur Verfügung. Dein Worker spricht das Modell direkt an.
Es ist gar kein zweiter Anbieter im Spiel, bei dem du etwas bezahlen müsstest.

Solange der Worker nicht eingerichtet ist, läuft der Assistent auf der Website
weiter, dann eben mit den fest hinterlegten Antworten statt mit echter KI.
Es geht also nichts kaputt, wenn du dir Zeit lässt.

---

## Weg A: Ohne Terminal, direkt im Browser (empfohlen)

Du brauchst nur deinen Cloudflare-Account. Kein Node.js, keine Installation.

**1. Worker anlegen**

- [dash.cloudflare.com](https://dash.cloudflare.com) öffnen
- Links im Menü: **Compute (Workers)** → **Workers & Pages**
- **Create** → **Start with Hello World!** → **Deploy**
- Als Namen `lynq-x-assistant` eintragen

**2. Code einfügen**

- Beim erstellten Worker auf **Edit code** (bzw. **Bearbeiten**) klicken
- Den kompletten vorhandenen Inhalt löschen
- Den kompletten Inhalt der Datei `worker/worker.js` aus diesem Repository
  hineinkopieren
- Oben rechts auf **Deploy**

**3. Das Sprachmodell freischalten**

Das ist der entscheidende Schritt. Ohne ihn kennt der Worker kein Modell.

- Zurück zur Übersicht des Workers → Reiter **Settings** → **Bindings**
  (bei manchen Ansichten: **Variables and Secrets** → daneben **Bindings**)
- **Add binding** → Typ **Workers AI** wählen
- Als *Variable name* exakt `AI` eintragen (nur diese zwei Buchstaben)
- Speichern und **Deploy**

**4. Deine Domain eintragen**

- Gleicher Bereich, **Add binding** → Typ **Environment variable** (Text)
- Name: `ALLOWED_ORIGINS`
- Wert: `https://lynq-x.de,https://www.lynq-x.de`
- Speichern und **Deploy**

**5. Die URL holen**

Oben auf der Worker-Seite steht eine Adresse in der Form

```
https://lynq-x-assistant.DEIN-NAME.workers.dev
```

Die brauchst du gleich.

---

## Weg B: Mit Terminal

Falls du lieber im Terminal arbeitest, Node.js vorausgesetzt:

```bash
cd worker
npx wrangler login
npx wrangler deploy
```

Die AI-Bindung und `ALLOWED_ORIGINS` stehen bereits in `wrangler.toml`, es ist
also nichts weiter zu konfigurieren.

---

## Zum Schluss: Website verbinden

In `js/config.js` (im Hauptordner, nicht hier) steht eine einzige Zeile:

```js
window.LYNQX_API = "";
```

Dort die Worker-URL eintragen:

```js
window.LYNQX_API = "https://lynq-x-assistant.DEIN-NAME.workers.dev";
```

Speichern, committen, pushen. Ab dann läuft der Assistent mit echter KI, das
Kontaktformular schickt seine Anfragen an den Worker statt ins Mailprogramm,
und der interne Bereich hat etwas zu zeigen. Diese eine Zeile versorgt alle
drei Dinge, an anderer Stelle musst du nichts eintragen.

---

## Was "kostenlos" hier genau heißt

Cloudflare rechnet Workers AI in *Neuronen* ab. Im Gratis-Kontingent stehen dir
**10.000 Neuronen pro Tag** zu, die jede Nacht um 01:00 Uhr deutscher Zeit
zurückgesetzt werden. Eine Kreditkarte wird nicht verlangt, und es gibt keine
Testphase, die irgendwann ausläuft.

Wie viele Gespräche das sind, hängt vom Modell ab. Eingestellt ist
`@cf/meta/llama-3.3-70b-instruct-fp8-fast`, das größte der frei nutzbaren
Modelle, weil es deutlich besseres Deutsch schreibt als die kleinen. Dafür
verbraucht es mehr pro Antwort. Für eine Agentur-Website mit normalem
Besucheraufkommen reicht das Tageskontingent locker.

**Wenn das Kontingent doch einmal aufgebraucht ist, passiert nichts Schlimmes:**
Die Website merkt das und antwortet für den Rest des Tages automatisch aus ihrer
eigenen Wissensbasis weiter. Der Besucher sieht keine Fehlermeldung, nur etwas
knappere Antworten.

Falls dir das zu oft passiert, tausch in `worker.js` in der Zeile

```js
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
```

das Modell gegen `"@cf/meta/llama-3.1-8b-instruct-fast"`. Deutlich sparsamer,
dafür schwächeres Deutsch. Danach neu deployen.

Wichtig: Solange du auf dem kostenlosen Cloudflare-Plan bleibst, **kann gar
keine Rechnung entstehen.** Über das Kontingent hinaus wird nicht abgerechnet,
sondern schlicht abgelehnt.

---

## Missbrauch begrenzen (optional)

Ohne Begrenzung könnte jemand den Chat in einer Schleife ansprechen und dein
Tageskontingent leerlaufen lassen. Über das Dashboard:

- **Storage & Databases** → **KV** → **Create a namespace**, Name `RATE_LIMIT`
- Zurück zum Worker → **Settings** → **Bindings** → **Add binding** → **KV namespace**
- Variable name: `RATE_LIMIT`, den eben erstellten Namespace auswählen
- Speichern und **Deploy**

Danach sind pro Besucher 25 Fragen in 10 Minuten möglich, mehr als jeder echte
Interessent braucht.

---

## Der interne Bereich (admin.html)

Die Seite `admin.html` ist deine Übersicht: alle Anfragen aus dem Formular,
Angebote direkt am Auftrag, Status und die Einnahmen. Sie ist von nirgendwo
verlinkt, steht in `robots.txt` auf Disallow und trägt ein `noindex`. Du
erreichst sie nur, wenn du `lynq-x.de/admin.html` direkt eintippst.

Damit sie funktioniert, braucht der Worker einen Speicher. Ohne ihn nimmt er
keine Anfragen an und die Seite bleibt leer.

**1. Speicher anlegen**

- Im Dashboard: **Storage & Databases** → **KV** → **Create a namespace**
- Name: `ANFRAGEN`

**2. Speicher an den Worker hängen**

- Zurück zum Worker → **Settings** → **Bindings** → **Add binding**
- Typ **KV namespace**, Variable name exakt `ANFRAGEN`, den eben erstellten
  Namespace auswählen
- Speichern und **Deploy**

**3. Passwort setzen (empfohlen)**

Im Code steht ein Standardpasswort. Das steht damit auch öffentlich auf
GitHub. Sobald du eines per Bindung setzt, gilt nur noch dieses:

- **Settings** → **Bindings** → **Add binding** → **Secret**
- Name: `ADMIN_PASSWORT`, Wert: dein Passwort
- Speichern und **Deploy**

Das ist die ganze Änderung. Am Code musst du dafür nichts anfassen.

**Wie der Zugang abgesichert ist**

Auf `admin.html` selbst liegen keine Daten, die Seite ist eine leere Hülle.
Anfragen und Beträge liegen im Worker und werden erst geschickt, nachdem das
Passwort dort geprüft wurde. Wer den Quelltext ansieht, findet nichts.
Nach fünf Fehlversuchen ist die IP für 15 Minuten gesperrt, Durchprobieren
läuft also ins Leere. Die Anmeldung gilt 12 Stunden und endet, wenn du den
Tab schließt.

**Was du dort tun kannst**

Anfrage aufklappen, Betrag und Leistungen eintragen, speichern. Über
*Angebotstext kopieren* bekommst du einen fertigen Text für die Mail. Den
Status ziehst du von *Neu* über *Angebot raus* bis *Bezahlt*; sobald etwas auf
*Bezahlt* steht, taucht es in den Einnahmen und in der Monatsübersicht auf.

---

## Etwas ändern

**Was X weiß** (Leistungen, Ablauf, Kontaktdaten, Tonfall) steht ganz oben in
`worker.js` im Block `SYSTEM_PROMPT`. Text anpassen, neu deployen, fertig.
Am restlichen Code musst du nie etwas ändern.

**Mitschauen, was passiert:** im Dashboard beim Worker der Reiter **Logs**
(bzw. `npx wrangler tail` im Terminal).

---

## Datenschutz

Sobald der Worker aktiv ist, verlassen Chat-Nachrichten den Browser des
Besuchers. Die Datenschutzerklärung ist darauf vorbereitet: Ziffer 6 in
`datenschutz.html` beschreibt genau diese Verarbeitung mit Cloudflare als
Auftragsverarbeiter.

Ein Punkt bleibt für dich: Bei Cloudflare im Dashboard unter
**Manage Account → Configurations → Data Protection** (bzw. im Bereich Legal)
den **Auftragsverarbeitungsvertrag (DPA)** akzeptieren. Und wie gesagt: die
Rechtstexte einmal von einem Anwalt prüfen lassen. Ich bin keiner.
