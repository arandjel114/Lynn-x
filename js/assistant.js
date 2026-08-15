/* X, der Assistent von Lynq-x.

   Zwei Betriebsarten:

   1. Mit API_ENDPOINT: echte KI. Die Anfrage geht an den eigenen Cloudflare
      Worker (Ordner /worker), der sie an Claude weiterreicht. Der API-Schlüssel
      liegt dort und ist im Browser niemals sichtbar.

   2. Ohne API_ENDPOINT (oder wenn der Worker nicht erreichbar ist): die fest
      hinterlegte Wissensbasis weiter unten. Der Chat funktioniert also immer,
      auch wenn der Server aus ist.

   Gespeichert wird in beiden Fällen nichts: kein Cookie, kein Local Storage.
   Der Verlauf lebt nur im Arbeitsspeicher des Browsers. */
(() => {
  "use strict";

  /* Nach dem Deploy des Workers hier dessen URL eintragen, z. B.
     "https://lynq-x-assistant.dein-name.workers.dev". Siehe worker/README.md. */
  const API_ENDPOINT = "";

  const MAIL = "kontakt-lynq-x@outlook.de";
  const HOME = document.body.classList.contains("legal-page") ? "index.html" : "";

  const link = (hash, label) => `<a href="${HOME}${hash}">${label}</a>`;

  /* Wissensbasis. Jeder Eintrag: Auslöser (Wortstämme) + Antwort + optionale Folgefragen. */
  const KNOWLEDGE = [
    {
      id: "preis",
      /* Doppelt gewichtet: "Was kostet ein Bestellsystem?" ist eine Preisfrage,
         auch wenn das Fachwort darin länger ist als "kostet". */
      weight: 2,
      keys: ["preis", "kost", "teuer", "günstig", "budget", "euro", "€", "was zahl", "honorar", "angebot", "rate"],
      answer: `Feste Paketpreise gibt es bei uns bewusst nicht, weil jedes Projekt einen anderen Umfang hat. Eine schlanke Seite mit fünf Abschnitten liegt deutlich unter einem Shop mit Zahlungsanbindung.<br><br>So läuft es: kurzes Erstgespräch, danach ein schriftliches Festpreis-Angebot. Keine Überraschungen auf der Rechnung.`,
      chips: ["Wie lange dauert das?", "Wie läuft ein Projekt ab?"]
    },
    {
      id: "dauer",
      keys: ["dauer", "lang", "zeit", "wann fertig", "schnell", "wochen", "termin bis", "deadline", "eilig"],
      answer: `Die erste sichtbare Version steht meistens innerhalb von zwei Wochen. Wie schnell es danach live geht, hängt vor allem davon ab, wie zügig Texte, Bilder und Freigaben von dir kommen.<br><br>Den realistischen Zeitrahmen bekommst du schriftlich im Angebot, nicht als Schätzung im Nachhinein.`,
      chips: ["Was kostet das?", "Was brauchst du von mir?"]
    },
    {
      id: "ablauf",
      keys: ["ablauf", "prozess", "wie läuft", "schritte", "vorgehen", "start", "anfang", "beginnen", "wie fange"],
      answer: `In vier Schritten: <strong>Verstehen</strong> (was soll die Seite leisten), <strong>Entwerfen</strong> (Struktur und Design), <strong>Bauen</strong> (handprogrammiert, kein Baukasten), <strong>Begleiten</strong> (nach dem Livegang geht es weiter).<br><br>Den ganzen Ablauf im Detail findest du hier: ${link("#ablauf", "Ablauf ansehen")}.`,
      chips: ["Was brauchst du von mir?", "Projekt anfragen"]
    },
    {
      id: "leistungen",
      /* Bewusst ohne allgemeine Frage-Floskeln wie "könnt ihr". Die stehen in
         jeder zweiten Frage und würden speziellere Themen überstimmen. */
      keys: ["leistung", "was macht ihr", "was bietet ihr", "was bietet lynq", "angebot an", "services"],
      answer: `Vier Bereiche: Webdesign &amp; Entwicklung, Conversion-Strategie, SEO &amp; Sichtbarkeit sowie Branding.<br><br>Alles davon einzeln oder als Gesamtpaket, je nachdem, was bei dir schon steht. ${link("#leistungen", "Leistungen ansehen")}`,
      chips: ["Macht ihr auch SEO?", "Baut ihr Onlineshops?"]
    },
    {
      id: "seo",
      keys: ["seo", "google", "sichtbar", "ranking", "gefunden werden", "suchmaschine", "platz 1", "keywords"],
      answer: `Ja. Technisches Fundament (Ladezeit, Struktur, saubere Auszeichnung) ist bei jeder Seite dabei. Darüber hinaus arbeiten wir an Inhalten und lokaler Sichtbarkeit.<br><br>Was wir nicht versprechen: Platz 1 bis nächsten Monat. Wer das verspricht, verkauft dir Zufall.`,
      chips: ["Macht ihr auch Marketing?", "Was kostet das?"]
    },
    {
      id: "marketing",
      keys: ["marketing", "werbung", "ads", "google ads", "social", "instagram", "kampagne", "reichweite"],
      answer: `Ja, aber nur wenn die Seite dahinter trägt. Werbebudget auf eine Seite zu leiten, die nicht konvertiert, ist verbranntes Geld.<br><br>Deshalb schauen wir zuerst auf Struktur und Conversion, danach auf Kampagnen und Sichtbarkeit.`,
      chips: ["Macht ihr auch SEO?", "Projekt anfragen"]
    },
    {
      id: "shop",
      keys: ["shop", "onlineshop", "verkauf", "e-commerce", "ecommerce", "bezahl", "zahlung", "warenkorb", "produkte verkauf"],
      answer: `Ja, Onlineshops mit Zahlungsanbindung sind möglich. Das ist der aufwendigste Projekttyp. Dafür brauchen wir im Erstgespräch ein paar Details mehr: Produktanzahl, Versand, Zahlungsarten.`,
      chips: ["Was kostet das?", "Projekt anfragen"]
    },
    {
      id: "privat",
      keys: ["privat", "privatperson", "einzelperson", "kleines", "verein", "selbstständ", "freiberuf", "start-up", "startup", "gründ"],
      answer: `Ja, ausdrücklich. Bei Unternehmen, Vereinen, Selbstständigen und Privatpersonen ist der Ablauf derselbe. Der Umfang wird an dein Vorhaben angepasst, nicht an eine Firmengröße.`,
      chips: ["Was kostet das?", "Wie läuft ein Projekt ab?"]
    },
    {
      id: "pflege",
      keys: ["pflege", "selbst ändern", "bearbeiten", "aktualis", "update", "wartung", "betreuung", "ändern lassen", "inhalte ändern"],
      answer: `Beides geht. Du bekommst Zugriff und eine kurze Einweisung, wenn du selbst pflegen willst. Wenn dir das zu viel ist, übernehmen wir die laufende Pflege im Rahmen der Betreuung.<br><br>Du bist in keinem Fall an uns gebunden. Die Seite gehört dir.`,
      chips: ["Wem gehört die Website?", "Was kostet das?"]
    },
    {
      id: "eigentum",
      keys: ["gehört", "eigentum", "rechte", "mitnehmen", "wechseln", "kündig", "vertrag", "bindung", "abo"],
      answer: `Dir. Domain, Inhalte und die fertige Seite laufen auf deinen Namen. Kein Abo-Zwang, keine Knebelverträge, kein Baukasten, den du nur mieten kannst.`,
      chips: ["Wer hostet die Seite?", "Kann ich selbst pflegen?"]
    },
    {
      id: "hosting",
      keys: ["hosting", "hoster", "server", "domain", "webspace", "wo liegt", "strato", "ionos", "e-mail adresse"],
      answer: `Auf Wunsch kümmern wir uns um Domain und Hosting inklusive SSL und E-Mail-Adressen. Wenn du schon einen Anbieter hast, arbeiten wir mit dem weiter. Ein Umzug ist kein Muss.`,
      chips: ["Wem gehört die Website?", "Projekt anfragen"]
    },
    {
      id: "technik",
      keys: ["wordpress", "baukasten", "wix", "template", "vorlage", "welche technik", "programmiert", "cms", "framework"],
      answer: `Handprogrammiert in HTML, CSS und JavaScript. Kein Baukasten, keine gekaufte Vorlage. Das ist der Grund, warum die Seiten schnell laden und sich nicht wie tausend andere anfühlen.<br><br>Wenn du ein CMS zum Selbstpflegen brauchst, binden wir eines ein, das zu deinem Projekt passt.`,
      chips: ["Kann ich selbst pflegen?", "Ist die Seite mobil optimiert?"]
    },
    {
      id: "mobil",
      keys: ["mobil", "handy", "smartphone", "responsive", "tablet", "auf dem telefon"],
      answer: `Selbstverständlich. Mobil wird zuerst gedacht und nicht am Ende nachgerüstet. Bei den meisten Kunden kommt über die Hälfte der Besucher vom Handy.`,
      chips: ["Wie schnell lädt die Seite?", "Projekt anfragen"]
    },
    {
      id: "speed",
      keys: ["schnell lädt", "ladezeit", "performance", "geschwindigkeit", "pagespeed", "langsam"],
      answer: `Ladezeit ist Teil der Arbeit, kein Extra. Keine aufgeblähten Plugin-Stapel, optimierte Bilder, sauberer Code. Das zahlt gleichzeitig auf Google und auf deine Absprungrate ein.`,
      chips: ["Macht ihr auch SEO?", "Welche Technik nutzt ihr?"]
    },
    {
      id: "material",
      keys: ["brauchst du von mir", "was muss ich", "texte", "bilder", "fotos", "logo", "material", "vorbereiten", "liefern"],
      answer: `Am Anfang reicht: Was machst du, für wen, und was soll die Seite bewirken. Texte und Bilder können später kommen. Wenn du willst, schreiben wir sie mit dir zusammen.<br><br>Ein Logo ist schön, aber keine Voraussetzung. Branding gehört mit zu unseren Leistungen.`,
      chips: ["Wie läuft ein Projekt ab?", "Projekt anfragen"]
    },
    {
      id: "kontakt",
      keys: ["kontakt", "erreich", "anrufen", "telefon", "mail", "e-mail", "melden", "gespräch", "termin", "beraten", "anfrage", "projekt anfragen"],
      answer: `Am schnellsten per E-Mail an <a href="mailto:${MAIL}">${MAIL}</a> oder telefonisch unter <a href="tel:+4915174367509">0151 74367509</a>.<br><br>Oder du füllst das Formular aus: ${link("#kontakt", "zum Kontaktformular")}. Antwort kommt in der Regel innerhalb eines Werktags.`,
      chips: ["Wo sitzt ihr?", "Was kostet das?"]
    },
    {
      id: "standort",
      keys: ["wo sitz", "standort", "köln", "koeln", "vor ort", "remote", "adresse", "wo seid ihr", "deutschland"],
      answer: `Wir sitzen in Köln und arbeiten deutschlandweit remote. Für Projekte in und um Köln geht ein Treffen vor Ort natürlich auch.`,
      chips: ["Wie erreiche ich euch?", "Projekt anfragen"]
    },
    {
      id: "wer",
      keys: ["wer bist du", "wer seid ihr", "über euch", "team", "agentur", "lynq", "was ist lynq", "arandjel", "regi", "wie viele seid", "mitarbeiter"],
      answer: `Wir sind eine Webdesign- und Marketingagentur aus Köln, zu zweit und mit klarer Aufteilung: <strong>Arandjel Jovanovic</strong> macht Design und Umsetzung, <strong>Regi Amoako</strong> kümmert sich um Marketing und Strategie.<br><br>Bei uns laufen nicht dreißig Projekte parallel, deins bekommt entsprechend Aufmerksamkeit. ${link("#ueber-uns", "Mehr über uns")}`,
      chips: ["Habt ihr Referenzen?", "Wie läuft ein Projekt ab?"]
    },
    {
      id: "firma",
      /* Doppelt gewichtet: "Wem gehört Lynq-x?" ist eine Frage nach dem
         Unternehmen, nicht nach dem Eigentum an der fertigen Website. */
      weight: 2,
      keys: ["firma", "unternehmen heißt", "gewerbe", "rechnung", "vertragspartner", "steuernummer", "handelsregister", "wem gehört lynq", "impressum", "rechtsform", "gmbh", " ug", "einzelunternehmen", "eingetragen"],
      answer: `Die vollständigen rechtlichen Angaben stehen im <a href="impressum.html">Impressum</a>.<br><br>Für dein Projekt spielt das ohnehin keine Rolle. Wichtig ist, was im Angebot steht und wer sich um deine Seite kümmert.`,
      chips: ["Wer seid ihr?", "Was kostet das?"]
    },
    {
      id: "gastro",
      keys: ["gastro", "restaurant", "imbiss", "bestellsystem", "bestellungen", "speisekarte", "lieferdienst", "lieferando", "essen bestellen", "gastronomie", "provision", "café", "cafe", "pizzeria", "döner", "doener"],
      answer: `Ja. Für Gastro haben wir sogar etwas Eigenes: ein <strong>Bestellsystem direkt in deiner Website</strong>. Deine Gäste bestellen dann bei dir statt über eine Plattform.<br><br>Keine Provision pro Bestellung, keine zusätzlichen Geräte, keine laufenden Gebühren an einen Drittanbieter. ${link("#gastro", "Details zum Bestellsystem")}`,
      chips: ["Was kostet das?", "Projekt anfragen"]
    },
    {
      id: "beispiele",
      keys: ["referenz", "beispiel", "portfolio", "arbeitsprobe", "gebaut", "kunden", "projekte gemacht", "zeigen", "ansehen", "muster", "erfahrung", "seit wann", "wie lange gibt", "wie viele projekte", "schon mal gemacht"],
      answer: `Schau dir am besten unsere Entwürfe an: Zahnarztpraxis, Gastronomie, Werkstatt, Friseur, Kanzlei und Onlineshop. ${link("#beispiele", "Beispiele ansehen")}<br><br>Damit du es gleich weißt: Das sind Gestaltungsentwürfe von uns und keine Kundenprojekte. Sie zeigen, wie wir arbeiten und was möglich ist. Deine Seite entsteht sowieso komplett neu.`,
      chips: ["Wie läuft ein Projekt ab?", "Was kostet das?"]
    },
    {
      id: "datenschutz",
      keys: ["datenschutz", "dsgvo", "cookie", "tracking", "daten", "speicher", "impressum", "rechtlich"],
      answer: `Diese Seite setzt keine Cookies, bindet kein Tracking ein und lädt nichts von fremden Servern nach. Deshalb gibt es hier auch kein Cookie-Banner.<br><br>Was mit deinen Chat-Nachrichten passiert, steht in der <a href="datenschutz.html">Datenschutzerklärung</a> unter Ziffer 6. Gespeichert wird der Verlauf in keinem Fall. Auch das <a href="impressum.html">Impressum</a> findest du dort.`,
      chips: ["Wer seid ihr?", "Wie erreiche ich euch?"]
    },
    {
      id: "bot",
      keys: ["bist du ein bot", "bist du echt", "künstliche intelligenz", "ki", "roboter", "mensch"],
      answer: `Ich bin ein Assistent und kein Mensch. Erfinden tue ich nichts. Ich gebe nur Auskunft über Dinge, die auf dieser Seite stehen.<br><br>Sobald es um dein konkretes Projekt geht, ist ein echtes Gespräch besser: ${link("#kontakt", "Projekt anfragen")}.`,
      chips: ["Was kostet das?", "Wie erreiche ich euch?"]
    },
    {
      id: "gruss",
      keys: ["hallo", "hi ", "hey", "guten tag", "moin", "servus", "guten morgen", "guten abend"],
      answer: `Hallo! Frag einfach los. Preise, Ablauf, Technik oder was du sonst wissen willst.`,
      chips: ["Was kostet eine Website?", "Wie läuft ein Projekt ab?"]
    },
    {
      id: "danke",
      keys: ["danke", "dankeschön", "top", "super", "perfekt", "alles klar", "tschüss", "ciao"],
      answer: `Gern. Wenn du loslegen willst: ${link("#kontakt", "Projekt anfragen")}, oder schreib direkt an <a href="mailto:${MAIL}">${MAIL}</a>.`,
      chips: []
    }
  ];

  const START_CHIPS = ["Was kostet eine Website?", "Wie läuft ein Projekt ab?", "Wie lange dauert das?", "Macht ihr auch SEO?"];

  const normalize = (s) =>
    s.toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^\wäöüß\s€-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const normKey = (k) =>
    k.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");

  /* Am Wortanfang matchen, nicht irgendwo im Wort: sonst steckt "ki" in "Tokio". */
  const matcherCache = new Map();
  function matcher(key) {
    let re = matcherCache.get(key);
    if (!re) {
      const k = normKey(key).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      re = new RegExp("(?:^|\\s)" + k, "i");
      matcherCache.set(key, re);
    }
    return re;
  }

  function findAnswer(input) {
    const text = " " + normalize(input) + " ";
    let best = null;
    let bestScore = 0;
    for (const entry of KNOWLEDGE) {
      let score = 0;
      for (const key of entry.keys) {
        const k = normKey(key).trim();
        if (matcher(key).test(text)) score += (k.length >= 6 ? 3 : 2) * (entry.weight || 1);
      }
      if (score > bestScore) { bestScore = score; best = entry; }
    }
    return bestScore >= 2 ? best : null;
  }

  const FALLBACK = {
    answer: `Dazu finde ich hier nichts Belastbares, und raten hilft dir nicht weiter.<br><br>Schreib die Frage am besten direkt an <a href="mailto:${MAIL}">${MAIL}</a>, dann bekommst du eine richtige Antwort.`,
    chips: ["Was kostet eine Website?", "Wie läuft ein Projekt ab?", "Wie erreiche ich euch?"]
  };

  /* ---------- Aufbau ---------- */

  const root = document.createElement("div");
  root.className = "assistant";
  root.innerHTML = `
    <button class="assistant-launcher" type="button" id="asstLauncher" aria-expanded="false" aria-controls="asstPanel">
      <span class="assistant-launcher-orb" aria-hidden="true"></span>
      <span class="assistant-launcher-label">Frag X</span>
    </button>
    <div class="assistant-panel" id="asstPanel" role="dialog" aria-modal="false" aria-label="Chat mit X" hidden>
      <div class="assistant-head">
        <span class="assistant-avatar" aria-hidden="true">X</span>
        <span class="assistant-ident">
          <strong>X</strong>
          <em>Assistent von Lynq-x</em>
        </span>
        <button class="assistant-close" type="button" id="asstClose" aria-label="Chat schließen">&times;</button>
      </div>
      <div class="assistant-log" id="asstLog" role="log" aria-live="polite"></div>
      <div class="assistant-chips" id="asstChips"></div>
      <form class="assistant-form" id="asstForm" autocomplete="off">
        <label class="visually-hidden" for="asstInput">Deine Frage</label>
        <input type="text" id="asstInput" placeholder="Frag mich etwas…" maxlength="300">
        <button type="submit" aria-label="Frage senden"><span aria-hidden="true">&rarr;</span></button>
      </form>
      <p class="assistant-foot">${
        API_ENDPOINT
          ? 'KI-Assistent. Antworten können Fehler enthalten. <a href="datenschutz.html">Datenschutz</a>'
          : "Läuft lokal in deinem Browser. Nichts wird gespeichert."
      }</p>
    </div>`;
  document.body.appendChild(root);

  const launcher = root.querySelector("#asstLauncher");
  const panel = root.querySelector("#asstPanel");
  const closeBtn = root.querySelector("#asstClose");
  const log = root.querySelector("#asstLog");
  const chipsWrap = root.querySelector("#asstChips");
  const form = root.querySelector("#asstForm");
  const input = root.querySelector("#asstInput");

  let started = false;

  function addMessage(who, html) {
    const row = document.createElement("div");
    row.className = "assistant-msg assistant-msg-" + who;
    const bubble = document.createElement("div");
    bubble.className = "assistant-bubble";
    bubble.innerHTML = html;
    row.appendChild(bubble);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return row;
  }

  function setChips(list) {
    chipsWrap.innerHTML = "";
    (list || []).forEach((label) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "assistant-chip";
      chip.textContent = label;
      chip.addEventListener("click", () => ask(label));
      chipsWrap.appendChild(chip);
    });
  }

  function typing() {
    const row = addMessage("bot", `<span class="assistant-dots"><i></i><i></i><i></i></span>`);
    row.classList.add("is-typing");
    return row;
  }

  const escapeHtml = (s) =>
    s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

  /* Der Bot liefert reinen Text. Aus E-Mail-Adressen und Telefonnummern
     machen wir hier klickbare Links. Sonst wird nichts interpretiert. */
  function renderText(text) {
    return escapeHtml(text)
      .replace(/([\w.+-]+@[\w-]+\.[\w.]+)/g, '<a href="mailto:$1">$1</a>')
      .replace(/\b0151\s?74367509\b/g, '<a href="tel:+4915174367509">$&</a>')
      .replace(/\n/g, "<br>");
  }

  /* Gesprächsverlauf für die API. Nur im Arbeitsspeicher, nie gespeichert. */
  const history = [];
  let busy = false;

  function setBusy(state) {
    busy = state;
    input.disabled = state;
    form.querySelector("button").disabled = state;
  }

  /* Antwort aus der lokalen Wissensbasis: Rückfallebene und Betrieb ohne Server. */
  function answerLocally(question) {
    const pending = typing();
    const entry = findAnswer(question) || FALLBACK;
    const delay = 380 + Math.min(700, entry.answer.length * 1.6);
    window.setTimeout(() => {
      pending.remove();
      addMessage("bot", entry.answer);
      setChips(entry.chips && entry.chips.length ? entry.chips : START_CHIPS.slice(0, 3));
      setBusy(false);
    }, delay);
  }

  /* Antwort vom eigenen Worker, Stück für Stück gestreamt (NDJSON). */
  async function answerFromApi(question) {
    const pending = typing();
    let bubble = null;
    let text = "";
    let serverError = "";

    const show = (chunk) => {
      text += chunk;
      if (!bubble) {
        pending.remove();
        bubble = addMessage("bot", "").querySelector(".assistant-bubble");
      }
      bubble.innerHTML = renderText(text);
      log.scrollTop = log.scrollHeight;
    };

    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.concat([{ role: "user", content: question }]) }),
      });

      if (!response.ok || !response.body) {
        const detail = await response.json().catch(() => null);
        throw new Error((detail && detail.message) || "Server nicht erreichbar");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const raw of lines) {
          if (!raw.trim()) continue;
          let event;
          try {
            event = JSON.parse(raw);
          } catch {
            continue;
          }
          if (event.type === "delta") show(event.text);
          else if (event.type === "error") serverError = event.message;
        }
      }

      /* Fehler erst anhängen, wenn schon eine Antwort begonnen hat. Kam gar
         nichts an, ist die lokale Wissensbasis die bessere Rückfallebene. */
      if (!text.trim()) throw new Error(serverError || "Leere Antwort");
      if (serverError) show("\n\n" + serverError);

      history.push({ role: "user", content: question });
      history.push({ role: "assistant", content: text });
      /* Verlauf begrenzen, damit lange Gespräche nicht ausufern. */
      while (history.length > 20) history.shift();

      setChips(START_CHIPS.slice(0, 3));
    } catch (error) {
      if (bubble) {
        bubble.innerHTML = renderText(
          text + (text ? "\n\n" : "") + "Der Rest ist unterwegs verloren gegangen. Frag gern noch einmal.",
        );
        setChips(START_CHIPS.slice(0, 3));
      } else {
        /* Noch nichts angekommen: lokal antworten, statt den Besucher stehen zu lassen. */
        pending.remove();
        answerLocally(question);
        return;
      }
    }
    setBusy(false);
  }

  function ask(text) {
    const clean = text.trim();
    if (!clean || busy) return;
    addMessage("user", escapeHtml(clean));
    setChips([]);
    setBusy(true);
    if (API_ENDPOINT) answerFromApi(clean);
    else answerLocally(clean);
  }

  function start() {
    if (started) return;
    started = true;
    addMessage("bot", `Hi, ich bin <strong>X</strong>, der Assistent von Lynq-x.<br><br>Ich beantworte Fragen zu Preisen, Ablauf, Technik und Betreuung. Was willst du wissen?`);
    setChips(START_CHIPS);
  }

  function open() {
    panel.hidden = false;
    // Reflow erzwingen, damit der Übergang greift.
    void panel.offsetWidth;
    root.classList.add("is-open");
    launcher.setAttribute("aria-expanded", "true");
    start();
    window.setTimeout(() => input.focus({ preventScroll: true }), 220);
  }

  function close() {
    root.classList.remove("is-open");
    launcher.setAttribute("aria-expanded", "false");
    window.setTimeout(() => { panel.hidden = true; }, 260);
    launcher.focus({ preventScroll: true });
  }

  launcher.addEventListener("click", () => (root.classList.contains("is-open") ? close() : open()));
  closeBtn.addEventListener("click", close);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && root.classList.contains("is-open")) close();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value;
    input.value = "";
    ask(value);
  });
})();
