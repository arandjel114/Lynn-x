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

Die Seite hat zwei Reiter.

Unter **Anfragen** liegt alles, was über das Formular reinkommt, mit sämtlichen
Antworten aus dem Fragebogen. Du kannst direkt aus der Anfrage heraus
antworten: der Text ist vorbereitet, du änderst ihn und schickst ihn ab.
*Angebot daraus schreiben* öffnet ein Angebot, in dem Name, E-Mail und Thema
schon eingetragen sind.

Unter **Angebote** stehen die Angebote selbst. Sie hängen nicht an einer
Anfrage: über *Neues Angebot* legst du auch eins für jemanden an, der dich
angerufen oder empfohlen bekommen hat. Jedes Angebot bekommt eine fortlaufende
Nummer (2026-001, 2026-002 …), Kundenanschrift, beliebig viele Positionen mit
Menge und Einzelpreis, optional einen Rabatt, Gültigkeitsdatum, Zeitrahmen und
Zahlungsbedingungen. Die Summen rechnen sich beim Tippen mit.

Voreingestellt ist die Kleinunternehmerregelung nach § 19 UStG, das Angebot
weist also keine Umsatzsteuer aus und trägt den vorgeschriebenen Hinweis.
Pro Angebot kannst du auf 19 Prozent umschalten, falls du die Regelung einmal
verlässt. Dauerhaft umstellen lässt es sich oben in `worker.js` mit
`const KLEINUNTERNEHMER = false;`.

Fertig? Dann *Text kopieren*, *Direkt senden* oder *Im Mailprogramm öffnen*.
Den Status ziehst du von *Entwurf* über *Versendet* bis *Bezahlt*. Sobald ein
Angebot auf *Bezahlt* steht, taucht es in den Einnahmen und in der
Monatsübersicht auf, und die zugehörige Anfrage wandert automatisch mit.

Was auf jedem Angebot oben im Briefkopf steht, kommt aus dem Block `ABSENDER`
in `worker.js`. Adresse oder Telefonnummer ändern sich also an einer Stelle.

---

## Benachrichtigung aufs Handy (Telegram)

Ohne das hier musst du selbst nachsehen, ob etwas reingekommen ist. Mit dem
hier bekommst du eine Push, sobald jemand das Formular abschickt.

**1. Bot anlegen**

- In Telegram nach **@BotFather** suchen und den Chat öffnen
- `/newbot` schicken
- Einen Namen vergeben, dann einen Benutzernamen, der auf `bot` endet,
  zum Beispiel `lynqx_anfragen_bot`
- BotFather antwortet mit einem Token in der Form `123456789:AAF...`.
  Den brauchst du gleich, gib ihn niemandem.

**2. Deine Chat-Id herausfinden**

- Deinen neuen Bot in Telegram suchen und **Start** drücken. Ohne diesen
  Schritt darf der Bot dir nichts schicken.
- Diese Adresse im Browser öffnen, `DEIN_TOKEN` ersetzen:
  `https://api.telegram.org/botDEIN_TOKEN/getUpdates`
- In der Antwort steht `"chat":{"id":123456789`. Diese Zahl ist deine Chat-Id.
  Steht da nur `{"ok":true,"result":[]}`, hast du **Start** noch nicht gedrückt.

**3. Beides beim Worker hinterlegen**

- Worker → **Settings** → **Variables and Secrets** → **Add**
- Typ **Secret**, Name `TELEGRAM_TOKEN`, Wert der Token von BotFather
- Noch einmal **Add**, Typ **Secret**, Name `TELEGRAM_CHAT_ID`, Wert die Zahl
- Speichern und **Deploy**

Fertig. Ab der nächsten Anfrage kommt die Push mit Name, Budget und Nachricht.

Falls einmal keine kommt: die Anfrage ist trotzdem gespeichert. Der Worker
behandelt die Benachrichtigung als Beiwerk und lässt eine Anfrage nie deshalb
scheitern.

---

## Mails direkt aus dem Tool verschicken (optional)

Ohne diesen Schritt funktioniert das Antworten trotzdem, es öffnet dann eben
dein Mailprogramm. Der Vorteil davon: die Mail liegt danach in deinem Ordner
„Gesendet“. Der Nachteil: es sind zwei Klicks mehr.

Wenn du direkt aus dem Tool senden willst, brauchst du einen Mailversender.
[Resend](https://resend.com) hat einen dauerhaft kostenlosen Tarif mit 100
Mails am Tag.

- Bei Resend anmelden, unter **Domains** die Domain `lynq-x.de` hinzufügen
  und die angezeigten DNS-Einträge bei deinem Domainanbieter eintragen
- Unter **API Keys** einen Schlüssel erzeugen
- Beim Worker unter **Variables and Secrets**:
  - **Secret** `RESEND_KEY` mit dem Schlüssel
  - **Text** `MAIL_VON` mit dem Absender, zum Beispiel
    `Lynq-x <angebot@lynq-x.de>`
  - optional **Text** `MAIL_ANTWORT`, falls Antworten woanders hin sollen als
    an `kontakt-lynq-x@outlook.de`
- **Deploy**

Sobald beides gesetzt ist, erscheinen im Tool die Knöpfe *Direkt senden*. Die
Domain muss dabei wirklich bei Resend freigeschaltet sein: von einer fremden
Adresse wie `@outlook.de` darf niemand in deinem Namen versenden.

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
