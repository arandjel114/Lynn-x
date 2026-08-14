# Lynn — der KI-Assistent von lynq-x.de

Dieser Ordner enthält den kleinen Server, der zwischen der Website und der
Claude-API sitzt. Er existiert aus genau einem Grund: **der API-Schlüssel darf
niemals im Browser landen.** Läge er im JavaScript der Website, könnte ihn jeder
Besucher auslesen und auf deine Rechnung Anfragen stellen.

Der Ablauf ist deshalb: Browser → dein Worker → Anthropic → zurück.

Solange der Worker nicht eingerichtet ist, läuft der Assistent auf der Website
weiter — dann eben mit den fest hinterlegten Antworten statt mit echter KI.
Es geht also nichts kaputt, wenn du dir mit den Schritten Zeit lässt.

---

## Was du brauchst

1. **Einen Cloudflare-Account** — kostenlos, [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up).
   Bei deinem Anfragevolumen bleibst du im Gratis-Kontingent (100.000 Anfragen
   pro Tag).
2. **Einen Anthropic-API-Schlüssel** — [console.anthropic.com](https://console.anthropic.com)
   → Settings → API Keys → *Create Key*. Der Schlüssel wird nur einmal
   angezeigt, also gleich sichern. Guthaben aufladen nicht vergessen (Billing);
   20 € reichen für sehr viele Gespräche.
3. **Node.js** auf deinem Rechner — [nodejs.org](https://nodejs.org), Version 20
   oder neuer.

---

## Einrichten (einmalig, ca. 10 Minuten)

Terminal öffnen und in diesen Ordner wechseln:

```bash
cd worker
npm install
```

Bei Cloudflare anmelden — das öffnet den Browser:

```bash
npx wrangler login
```

Den API-Schlüssel hinterlegen. Er wird verschlüsselt bei Cloudflare gespeichert
und taucht danach in keiner Datei mehr auf:

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

Nach dem Befehl den Schlüssel einfügen und Enter drücken.

Veröffentlichen:

```bash
npm run deploy
```

Am Ende gibt Wrangler eine URL aus, etwa:

```
https://lynq-x-assistant.DEIN-NAME.workers.dev
```

**Diese URL brauchst du im nächsten Schritt.**

---

## Die Website mit dem Worker verbinden

In `js/assistant.js` (im Hauptordner, nicht hier) steht ganz oben:

```js
const API_ENDPOINT = "";
```

Dort die URL von eben eintragen:

```js
const API_ENDPOINT = "https://lynq-x-assistant.DEIN-NAME.workers.dev";
```

Speichern, committen, pushen. Ab dann läuft der Assistent mit echter KI.

---

## Missbrauch begrenzen (empfohlen)

Ohne Begrenzung könnte jemand den Chat in einer Schleife ansprechen und Kosten
verursachen. Zwei Zeilen Aufwand:

```bash
npx wrangler kv namespace create RATE_LIMIT
```

Der Befehl gibt eine `id` aus. Die in `wrangler.toml` eintragen und die drei
auskommentierten Zeilen am Ende der Datei aktivieren (das `#` davor entfernen).
Dann noch einmal `npm run deploy`.

Danach sind pro Besucher 25 Fragen in 10 Minuten möglich — mehr als jeder echte
Interessent braucht.

Zusätzlich sinnvoll: im Anthropic-Dashboard unter *Billing* ein monatliches
Ausgabenlimit setzen. Das ist die harte Obergrenze, egal was passiert.

---

## Etwas ändern

**Was Lynn weiß** (Leistungen, Ablauf, Kontaktdaten, Tonfall) steht komplett in
`src/prompt.ts`. Text anpassen, `npm run deploy` — fertig. Sonst muss nichts
angefasst werden.

**Fehler suchen:** `npm run tail` zeigt live mit, was der Worker tut.

---

## Kosten

Der Worker selbst ist im Gratis-Kontingent von Cloudflare. Bezahlt wird nur, was
das Sprachmodell verbraucht.

Eingestellt ist `claude-opus-5` — das leistungsfähigste Modell, damit die
Antworten wirklich gut sind. Der wiederkehrende Teil (das Wissen über Lynq-x)
wird zwischengespeichert und kostet ab der zweiten Anfrage nur noch einen
Bruchteil.

Wenn du später auf Kosten optimieren willst, ändere in `src/index.ts` die Zeile
`model: "claude-opus-5"` auf `model: "claude-sonnet-5"` (günstiger, für einen
FAQ-Chat immer noch mehr als ausreichend) und deploye neu. Das ist deine
Entscheidung — ich habe bewusst nicht heruntergestuft.

---

## Datenschutz

Sobald der Worker aktiv ist, verlassen Chat-Nachrichten den Browser. Die
Datenschutzerklärung ist darauf bereits vorbereitet: Ziffer 6 in
`datenschutz.html` beschreibt genau diese Verarbeitung inklusive Anthropic als
Auftragsverarbeiter.

Zwei Dinge solltest du zusätzlich erledigen:

1. Im Anthropic-Dashboard einen **Auftragsverarbeitungsvertrag (DPA)**
   abschließen — Settings → Privacy / Data Processing.
2. Die Rechtstexte einmal von einem Anwalt prüfen lassen. Ich bin keiner.
