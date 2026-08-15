/**
 * Interner Bereich: Anfragen beantworten, Angebote schreiben, Einnahmen sehen.
 *
 * Wichtig zum Verständnis: Auf dieser Seite liegen keine Daten. Sie ist eine
 * leere Hülle. Anfragen, Angebote und Beträge liegen im Cloudflare Worker und
 * werden erst geladen, nachdem der Worker das Passwort geprüft hat. Wer die
 * Seite ohne Anmeldung öffnet oder den Quelltext ansieht, findet nichts.
 *
 * Die Anmeldung liefert einen Sitzungsschlüssel, der 12 Stunden gilt und im
 * Session Storage liegt. Der ist mit dem Schließen des Tabs weg.
 *
 * Beträge werden hier nur angezeigt. Verbindlich gerechnet wird im Worker,
 * damit im Angebot nicht landet, was zufällig im Browser stand.
 */
(() => {
  "use strict";

  const API = (window.LYNQX_API || "").replace(/\/+$/, "");
  const el = (id) => document.getElementById(id);

  const yearEl = el("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const loginView = el("loginView");
  const boardView = el("boardView");
  const loginForm = el("loginForm");
  const loginNote = el("loginNote");
  const logoutBtn = el("logoutBtn");
  const statsEl = el("stats");
  const listEl = el("list");
  const listAngeboteEl = el("listAngebote");
  const filterEl = el("filter");
  const filterAngeboteEl = el("filterAngebote");
  const monthsEl = el("months");
  const refreshBtn = el("refreshBtn");
  const neuBtn = el("neuBtn");
  const listRechnungenEl = el("listRechnungen");
  const filterRechnungenEl = el("filterRechnungen");
  const neuRechnungBtn = el("neuRechnungBtn");
  const steuerWarnung = el("steuerWarnung");

  const STATUS = {
    neu: "Neu",
    in_arbeit: "In Arbeit",
    angebot: "Angebot raus",
    angenommen: "Beauftragt",
    bezahlt: "Bezahlt",
    abgelehnt: "Abgelehnt",
  };

  const A_STATUS = {
    entwurf: "Entwurf",
    versendet: "Versendet",
    angenommen: "Angenommen",
    abgelehnt: "Abgelehnt",
    bezahlt: "Bezahlt",
  };

  const R_STATUS = {
    entwurf: "Entwurf",
    offen: "Gestellt",
    bezahlt: "Bezahlt",
    storniert: "Storniert",
  };

  let token = sessionStorage.getItem("lynqx_token") || "";
  let anfragen = [];
  let angebote = [];
  let absender = {};
  let einstellungen = {};
  let filterAnfragen = "alle";
  let filterAngebote = "alle";
  let offeneAnfrage = null;
  let rechnungen = [];
  let filterRechnungen = "alle";
  let offenesAngebot = null;
  let offeneRechnung = null;
  let entwurf = null; // ein noch nicht gespeichertes neues Angebot
  let rechnungEntwurf = null; // dito für Rechnungen

  const euro = (n) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n || 0);
  const euroKurz = (n) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
  const datum = (iso) =>
    iso ? new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso)) : "";
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

  function inTagen(tage) {
    const d = new Date();
    d.setDate(d.getDate() + tage);
    return d.toISOString().slice(0, 10);
  }

  async function api(pfad, optionen = {}) {
    const antwort = await fetch(API + pfad, {
      ...optionen,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(optionen.headers || {}),
      },
    });
    const daten = await antwort.json().catch(() => ({}));
    if (antwort.status === 401 && token) {
      abmelden("Die Sitzung ist abgelaufen. Bitte melde dich neu an.");
      throw new Error("abgelaufen");
    }
    if (!antwort.ok) throw new Error(daten.fehler || "Da ist etwas schiefgelaufen.");
    return daten;
  }

  const wert = (wurzel, attr, id) => wurzel.querySelector(`[data-${attr}="${CSS.escape(id)}"]`)?.value ?? "";

  function hinweis(wurzel, id, nachricht) {
    const ziel = wurzel.querySelector(`[data-hinweis="${CSS.escape(id)}"]`);
    if (!ziel) return;
    ziel.textContent = nachricht;
    window.setTimeout(() => { ziel.textContent = ""; }, 3000);
  }

  /* ---------- Anmeldung ---------- */

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!API) {
      loginNote.textContent = "Der Worker ist noch nicht verbunden. Trag seine Adresse in js/config.js ein.";
      return;
    }
    loginNote.textContent = "Moment…";
    try {
      const daten = await api("/admin/login", {
        method: "POST",
        body: JSON.stringify({ passwort: el("passwort").value }),
      });
      token = daten.token;
      sessionStorage.setItem("lynqx_token", token);
      el("passwort").value = "";
      loginNote.textContent = "";
      zeigeBoard();
      await laden();
    } catch (fehler) {
      loginNote.textContent = fehler.message;
    }
  });

  function zeigeBoard() {
    loginView.hidden = true;
    boardView.hidden = false;
    logoutBtn.hidden = false;
  }

  function abmelden(text) {
    token = "";
    sessionStorage.removeItem("lynqx_token");
    boardView.hidden = true;
    logoutBtn.hidden = true;
    loginView.hidden = false;
    loginNote.textContent = text || "";
  }

  logoutBtn.addEventListener("click", () => abmelden());

  /* ---------- Reiter ---------- */

  document.querySelector(".admin-tabs").addEventListener("click", (event) => {
    const knopf = event.target.closest("[data-tab]");
    if (!knopf) return;
    document.querySelectorAll(".admin-tab").forEach((t) => {
      const aktiv = t === knopf;
      t.classList.toggle("is-active", aktiv);
      t.setAttribute("aria-selected", String(aktiv));
    });
    el("panelAnfragen").hidden = knopf.dataset.tab !== "anfragen";
    el("panelAngebote").hidden = knopf.dataset.tab !== "angebote";
    el("panelRechnungen").hidden = knopf.dataset.tab !== "rechnungen";
  });

  const zeigeReiter = (name) => document.querySelector(`[data-tab="${name}"]`).click();

  /* ---------- Laden ---------- */

  async function laden() {
    listEl.innerHTML = '<p class="admin-leer">Wird geladen…</p>';
    try {
      const daten = await api("/admin/daten");
      anfragen = daten.anfragen || [];
      angebote = daten.angebote || [];
      rechnungen = daten.rechnungen || [];
      absender = daten.absender || {};
      einstellungen = daten.einstellungen || {};
      zeigeSteuerWarnung();
      zeichneStats(daten.zahlen);
      zeichneFilter();
      zeichneListe();
      zeichneAngebotFilter();
      zeichneAngebotListe();
      zeichneRechnungFilter();
      zeichneRechnungListe();
      zeichneMonate(daten.zahlen.proMonat);
      el("tabAnfragenZahl").textContent = anfragen.length;
      el("tabAngeboteZahl").textContent = angebote.length;
      el("tabRechnungenZahl").textContent = rechnungen.length;
    } catch (fehler) {
      if (fehler.message !== "abgelaufen") {
        listEl.innerHTML = `<p class="admin-leer">${esc(fehler.message)}</p>`;
      }
    }
  }

  refreshBtn.addEventListener("click", laden);

  function zeichneStats(z) {
    const kachel = ([titel, zahl, betrag, klasse]) => `
      <div class="admin-stat${klasse ? " " + klasse : ""}">
        <span class="admin-stat-label">${titel}</span>
        <strong class="admin-stat-wert">${zahl !== "" ? zahl : betrag}</strong>
        ${zahl !== "" && betrag ? `<span class="admin-stat-neben">${betrag}</span>` : ""}
      </div>`;

    /* Zwei Blöcke: was noch unterwegs ist, und was schon Geld ist. */
    const pipeline = [
      ["Neue Anfragen", z.neu, ""],
      ["In Arbeit", z.inArbeit, ""],
      ["Angebote offen", z.angeboteOffen, euroKurz(z.angeboteOffenSumme)],
      ["Beauftragt", z.beauftragt, euroKurz(z.beauftragtSumme)],
    ];
    const umsatz = [
      ["Rechnungen offen", z.rechnungOffen, euroKurz(z.rechnungOffenSumme)],
      ["Überfällig", z.ueberfaellig, euroKurz(z.ueberfaelligSumme), z.ueberfaellig ? "is-warnung" : ""],
      ["Bezahlt", "", euroKurz(z.bezahltSumme)],
    ];

    statsEl.innerHTML =
      `<div class="admin-statblock">
         <p class="admin-statblock-titel">Pipeline</p>
         <div class="admin-statreihe">${pipeline.map(kachel).join("")}</div>
       </div>
       <div class="admin-statblock">
         <p class="admin-statblock-titel">Umsatz</p>
         <div class="admin-statreihe">${umsatz.map(kachel).join("")}</div>
       </div>`;
  }

  function zeigeSteuerWarnung() {
    const fehlt = !einstellungen.steuernummer && !einstellungen.ustId;
    steuerWarnung.hidden = !fehlt;
    if (fehlt) {
      steuerWarnung.textContent =
        "Auf Rechnungen fehlt noch deine Steuernummer. Ohne sie ist eine Rechnung nach § 14 UStG unvollständig. " +
        "Trag sie in worker.js bei STEUERNUMMER ein, dann steht sie auf jeder Rechnung.";
    }
  }

  function zeichneMonate(proMonat) {
    const monate = Object.entries(proMonat || {}).sort((a, b) => b[0].localeCompare(a[0]));
    if (!monate.length) {
      monthsEl.innerHTML = '<p class="admin-leer">Noch keine bezahlten Angebote.</p>';
      return;
    }
    const hoechster = Math.max(...monate.map(([, w]) => w));
    monthsEl.innerHTML = monate
      .map(([monat, w]) => {
        const [j, m] = monat.split("-");
        const name = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(new Date(+j, +m - 1, 1));
        return `
          <div class="admin-monat">
            <span class="admin-monat-name">${name}</span>
            <span class="admin-monat-balken"><i style="transform:scaleX(${(w / hoechster).toFixed(3)})"></i></span>
            <strong class="admin-monat-wert">${euro(w)}</strong>
          </div>`;
      })
      .join("");
  }

  /* ============================================================
     Anfragen
     ============================================================ */

  function zeichneFilter() {
    const zaehler = (s) => (s === "alle" ? anfragen.length : anfragen.filter((a) => a.status === s).length);
    filterEl.innerHTML = [["alle", "Alle"], ...Object.entries(STATUS)]
      .map(
        ([w, t]) =>
          `<button type="button" class="admin-chip${w === filterAnfragen ? " is-active" : ""}" data-filter="${w}">${t} <span>${zaehler(w)}</span></button>`,
      )
      .join("");
  }

  filterEl.addEventListener("click", (event) => {
    const knopf = event.target.closest("[data-filter]");
    if (!knopf) return;
    filterAnfragen = knopf.dataset.filter;
    zeichneFilter();
    zeichneListe();
  });

  function zeichneListe() {
    const sichtbar = filterAnfragen === "alle" ? anfragen : anfragen.filter((a) => a.status === filterAnfragen);
    listEl.innerHTML = sichtbar.length
      ? sichtbar.map(anfrageHtml).join("")
      : '<p class="admin-leer">Hier ist gerade nichts.</p>';
  }

  function anfrageHtml(a) {
    const offen = a.id === offeneAnfrage;
    const eigene = angebote.filter((x) => x.anfrageId === a.id);
    return `
      <article class="admin-item${offen ? " is-open" : ""}">
        <button type="button" class="admin-item-head" data-toggle="${esc(a.id)}" aria-expanded="${offen}">
          <span class="admin-item-datum">${datum(a.eingang)}</span>
          <span class="admin-item-name">${esc(a.name)}</span>
          <span class="admin-item-projekt">${esc(a.projekt || "ohne Angabe")}</span>
          <span class="admin-badge admin-badge-${esc(a.status)}">${STATUS[a.status] || a.status}</span>
          <span class="admin-item-betrag">${eigene.length ? euroKurz(eigene[0].gesamt) : ""}</span>
        </button>
        ${offen ? anfrageDetailHtml(a, eigene) : ""}
      </article>`;
  }

  function anfrageDetailHtml(a, eigene) {
    const feld = (titel, w) => (w ? `<div class="admin-feld"><span>${titel}</span><strong>${esc(w)}</strong></div>` : "");
    return `
      <div class="admin-item-body">
        <div class="admin-felder">
          ${feld("E-Mail", a.email)}
          ${feld("Branche", a.branche)}
          ${feld("Ziel", a.ziel)}
          ${feld("Vorhanden", a.bestand)}
          ${feld("Zeitrahmen", a.zeit)}
          ${feld("Budget", a.budget)}
        </div>
        ${a.nachricht ? `<p class="admin-nachricht">${esc(a.nachricht)}</p>` : ""}

        <div class="admin-aktionen">
          <label class="admin-select">
            <span>Status</span>
            <select data-status="${esc(a.id)}">
              ${Object.entries(STATUS)
                .map(([w, t]) => `<option value="${w}"${a.status === w ? " selected" : ""}>${t}</option>`)
                .join("")}
            </select>
          </label>
          <button type="button" class="admin-speichern" data-angebot-aus="${esc(a.id)}">Angebot daraus schreiben</button>
          <button type="button" class="admin-loeschen" data-loeschen="${esc(a.id)}">Löschen</button>
        </div>

        ${
          eigene.length
            ? `<p class="admin-verweis">Angebote dazu:
                ${eigene
                  .map(
                    (x) =>
                      `<button type="button" class="admin-link" data-zeige-angebot="${esc(x.id)}">Nr. ${esc(x.nummer)} · ${euro(x.gesamt)} · ${A_STATUS[x.status]}</button>`,
                  )
                  .join(" ")}</p>`
            : ""
        }

        <div class="admin-antwort">
          <h3 class="admin-h3">Antworten</h3>
          <label class="form-row">
            <span>Betreff</span>
            <input type="text" data-betreff="${esc(a.id)}" value="Deine Anfrage bei Lynq-x">
          </label>
          <label class="form-row">
            <span>Nachricht</span>
            <textarea rows="8" data-antwort="${esc(a.id)}">${esc(antwortVorlage(a))}</textarea>
          </label>
          <div class="admin-angebot-nav">
            ${einstellungen.mailversand ? `<button type="button" class="admin-speichern" data-senden="${esc(a.id)}">Direkt senden</button>` : ""}
            <button type="button" class="admin-kopieren" data-mailprogramm="${esc(a.id)}">Im Mailprogramm öffnen</button>
            <span class="admin-hinweis" data-hinweis="${esc(a.id)}"></span>
          </div>
          ${einstellungen.mailversand ? "" : '<p class="admin-fussnote">Direktversand ist noch nicht eingerichtet, deshalb geht es über dein Mailprogramm.</p>'}
        </div>

        <label class="form-row">
          <span>Interne Notiz</span>
          <textarea rows="2" data-notiz="${esc(a.id)}" placeholder="Nur für dich">${esc(a.notiz || "")}</textarea>
        </label>
        <div class="admin-angebot-nav">
          <button type="button" class="admin-kopieren" data-notiz-speichern="${esc(a.id)}">Notiz speichern</button>
        </div>
      </div>`;
  }

  function antwortVorlage(a) {
    const vorname = (a.name || "").split(" ")[0] || a.name || "";
    return (
      `Hallo ${vorname},\n\n` +
      `danke für deine Anfrage${a.projekt ? ` zum Thema ${a.projekt.toLowerCase()}` : ""}. ` +
      `Ich habe mir das angesehen und melde mich gern mit einem Vorschlag.\n\n\n\n` +
      `Viele Grüße\n${absender.inhaber || ""}\n${absender.firma || ""}\n${absender.telefon || ""}`
    );
  }

  listEl.addEventListener("click", async (event) => {
    const kopf = event.target.closest("[data-toggle]");
    if (kopf) {
      offeneAnfrage = offeneAnfrage === kopf.dataset.toggle ? null : kopf.dataset.toggle;
      zeichneListe();
      return;
    }

    const zeige = event.target.closest("[data-zeige-angebot]");
    if (zeige) {
      offenesAngebot = zeige.dataset.zeigeAngebot;
      filterAngebote = "alle";
      zeichneAngebotFilter();
      zeichneAngebotListe();
      zeigeReiter("angebote");
      return;
    }

    const aus = event.target.closest("[data-angebot-aus]");
    if (aus) return angebotAusAnfrage(aus.dataset.angebotAus);

    const senden = event.target.closest("[data-senden]");
    if (senden) return sendeAntwort(senden.dataset.senden);

    const mailprog = event.target.closest("[data-mailprogramm]");
    if (mailprog) {
      const a = anfragen.find((x) => x.id === mailprog.dataset.mailprogramm);
      if (!a) return;
      window.location.href =
        `mailto:${encodeURIComponent(a.email)}` +
        `?subject=${encodeURIComponent(wert(listEl, "betreff", a.id))}` +
        `&body=${encodeURIComponent(wert(listEl, "antwort", a.id))}`;
      return;
    }

    const notizBtn = event.target.closest("[data-notiz-speichern]");
    if (notizBtn) {
      const id = notizBtn.dataset.notizSpeichern;
      try {
        await api("/admin/anfrage", { method: "POST", body: JSON.stringify({ id, notiz: wert(listEl, "notiz", id) }) });
        hinweis(listEl, id, "Notiz gespeichert");
      } catch (fehler) {
        hinweis(listEl, id, fehler.message);
      }
      return;
    }

    const loeschen = event.target.closest("[data-loeschen]");
    if (loeschen) {
      if (!window.confirm("Diese Anfrage wirklich löschen? Das lässt sich nicht rückgängig machen.")) return;
      await api("/admin/anfrage", { method: "POST", body: JSON.stringify({ id: loeschen.dataset.loeschen, loeschen: true }) });
      offeneAnfrage = null;
      await laden();
    }
  });

  listEl.addEventListener("change", async (event) => {
    const auswahl = event.target.closest("[data-status]");
    if (!auswahl) return;
    await api("/admin/anfrage", {
      method: "POST",
      body: JSON.stringify({ id: auswahl.dataset.status, status: auswahl.value }),
    });
    await laden();
  });

  async function sendeAntwort(id) {
    const a = anfragen.find((x) => x.id === id);
    if (!a) return;
    hinweis(listEl, id, "Wird gesendet…");
    try {
      await api("/admin/mail", {
        method: "POST",
        body: JSON.stringify({ an: a.email, betreff: wert(listEl, "betreff", id), text: wert(listEl, "antwort", id) }),
      });
      hinweis(listEl, id, "Gesendet");
    } catch (fehler) {
      hinweis(listEl, id, fehler.message);
    }
  }

  /* ============================================================
     Angebote
     ============================================================ */

  function leeresAngebot(quelle) {
    return {
      id: "",
      nummer: "neu",
      status: "entwurf",
      anfrageId: quelle?.id || "",
      erstelltAm: new Date().toISOString(),
      kunde: {
        name: quelle?.name || "",
        firma: "",
        strasse: "",
        plz: "",
        ort: "",
        email: quelle?.email || "",
      },
      titel: quelle?.projekt || "",
      einleitung: "danke für dein Interesse. Hier mein Vorschlag für dein Projekt.",
      positionen: [{ text: "", menge: 1, einheit: "Stk.", preis: 0 }],
      rabattProzent: 0,
      rabattText: "",
      kleinunternehmer: einstellungen.kleinunternehmer !== false,
      ustSatz: einstellungen.ustSatz || 19,
      gueltigBis: inTagen(einstellungen.gueltigTage || 30),
      lieferzeit: "",
      zahlung: einstellungen.zahlungStandard || "",
      hinweis: "",
      notiz: "",
      netto: 0,
      rabattBetrag: 0,
      nettoNachRabatt: 0,
      ust: 0,
      gesamt: 0,
    };
  }

  neuBtn.addEventListener("click", () => {
    entwurf = leeresAngebot(null);
    offenesAngebot = "entwurf";
    zeichneAngebotListe();
    zeigeReiter("angebote");
  });

  function angebotAusAnfrage(anfrageId) {
    const a = anfragen.find((x) => x.id === anfrageId);
    if (!a) return;
    entwurf = leeresAngebot(a);
    offenesAngebot = "entwurf";
    zeichneAngebotListe();
    zeigeReiter("angebote");
  }

  function zeichneAngebotFilter() {
    const zaehler = (s) => (s === "alle" ? angebote.length : angebote.filter((a) => a.status === s).length);
    filterAngeboteEl.innerHTML = [["alle", "Alle"], ...Object.entries(A_STATUS)]
      .map(
        ([w, t]) =>
          `<button type="button" class="admin-chip${w === filterAngebote ? " is-active" : ""}" data-afilter="${w}">${t} <span>${zaehler(w)}</span></button>`,
      )
      .join("");
  }

  filterAngeboteEl.addEventListener("click", (event) => {
    const knopf = event.target.closest("[data-afilter]");
    if (!knopf) return;
    filterAngebote = knopf.dataset.afilter;
    zeichneAngebotFilter();
    zeichneAngebotListe();
  });

  function zeichneAngebotListe() {
    const sichtbar = filterAngebote === "alle" ? angebote : angebote.filter((a) => a.status === filterAngebote);
    const teile = [];
    if (entwurf) teile.push(angebotHtml(entwurf, true));
    teile.push(...sichtbar.map((a) => angebotHtml(a, false)));
    listAngeboteEl.innerHTML = teile.length
      ? teile.join("")
      : '<p class="admin-leer">Noch kein Angebot. Über „Neues Angebot“ legst du eins an, auch ganz ohne Anfrage.</p>';
  }

  function angebotHtml(a, istEntwurf) {
    const k = istEntwurf ? "entwurf" : a.id;
    const offen = k === offenesAngebot;
    return `
      <article class="admin-item${offen ? " is-open" : ""}">
        <button type="button" class="admin-item-head" data-atoggle="${esc(k)}" aria-expanded="${offen}">
          <span class="admin-item-datum">${istEntwurf ? "neu" : "Nr. " + esc(a.nummer)}</span>
          <span class="admin-item-name">${esc(a.kunde.firma || a.kunde.name || "ohne Namen")}</span>
          <span class="admin-item-projekt">${esc(a.titel || "ohne Titel")}</span>
          <span class="admin-badge admin-badge-${esc(a.status)}">${A_STATUS[a.status] || a.status}</span>
          <span class="admin-item-betrag">${euroKurz(a.gesamt)}</span>
        </button>
        ${offen ? angebotDetailHtml(a, k, istEntwurf) : ""}
      </article>`;
  }

  function angebotDetailHtml(a, k, istEntwurf) {
    const pos = a.positionen.length ? a.positionen : [{ text: "", menge: 1, einheit: "Stk.", preis: 0 }];
    return `
      <div class="admin-item-body" data-editor="${esc(k)}">

        <h3 class="admin-h3">Kunde</h3>
        <div class="admin-angebot-felder">
          <label class="form-row"><span>Name</span><input type="text" data-k-name="${esc(k)}" value="${esc(a.kunde.name)}"></label>
          <label class="form-row"><span>Firma</span><input type="text" data-k-firma="${esc(k)}" value="${esc(a.kunde.firma)}"></label>
        </div>
        <div class="admin-angebot-felder">
          <label class="form-row"><span>Straße und Nummer</span><input type="text" data-k-strasse="${esc(k)}" value="${esc(a.kunde.strasse)}"></label>
          <label class="form-row"><span>E-Mail</span><input type="email" data-k-email="${esc(k)}" value="${esc(a.kunde.email)}"></label>
        </div>
        <div class="admin-angebot-felder">
          <label class="form-row"><span>PLZ</span><input type="text" data-k-plz="${esc(k)}" value="${esc(a.kunde.plz)}"></label>
          <label class="form-row"><span>Ort</span><input type="text" data-k-ort="${esc(k)}" value="${esc(a.kunde.ort)}"></label>
        </div>

        <h3 class="admin-h3">Leistungen</h3>
        <label class="form-row"><span>Titel</span><input type="text" data-titel="${esc(k)}" value="${esc(a.titel)}" placeholder="z. B. Website und Bestellsystem"></label>
        <label class="form-row"><span>Einleitung</span><textarea rows="3" data-einleitung="${esc(k)}">${esc(a.einleitung)}</textarea></label>

        <div class="admin-pos-kopf" aria-hidden="true">
          <span>Leistung</span><span>Menge</span><span>Einheit</span><span>Preis</span><span>Summe</span><span></span>
        </div>
        <div class="admin-positionen">
          ${pos.map((p) => positionHtml(k, p)).join("")}
        </div>
        <button type="button" class="admin-kopieren admin-pos-plus" data-pos-plus="${esc(k)}">Position hinzufügen</button>

        <div class="admin-angebot-felder">
          <label class="form-row"><span>Rabatt in Prozent</span><input type="number" min="0" max="100" step="1" data-rabatt="${esc(k)}" value="${a.rabattProzent || ""}" placeholder="0"></label>
          <label class="form-row"><span>Grund für den Rabatt</span><input type="text" data-rabatttext="${esc(k)}" value="${esc(a.rabattText)}" placeholder="z. B. Empfehlung"></label>
        </div>

        <div class="admin-summe" data-summe="${esc(k)}">${summeHtml(a)}</div>

        <div class="admin-angebot-felder">
          <label class="form-row"><span>Gültig bis</span><input type="date" data-gueltig="${esc(k)}" value="${esc(a.gueltigBis)}"></label>
          <label class="form-row"><span>Zeitrahmen</span><input type="text" data-lieferzeit="${esc(k)}" value="${esc(a.lieferzeit)}" placeholder="z. B. 4 Wochen ab Freigabe"></label>
        </div>
        <label class="form-row"><span>Zahlung</span><textarea rows="2" data-zahlung="${esc(k)}">${esc(a.zahlung)}</textarea></label>
        <label class="form-row"><span>Schlusswort</span><textarea rows="2" data-schluss="${esc(k)}" placeholder="Optional">${esc(a.hinweis)}</textarea></label>
        <label class="form-row"><span>Interne Notiz</span><textarea rows="2" data-anotiz="${esc(k)}" placeholder="Nur für dich">${esc(a.notiz)}</textarea></label>

        <div class="admin-aktionen">
          <label class="admin-select">
            <span>Status</span>
            <select data-astatus="${esc(k)}">
              ${Object.entries(A_STATUS)
                .map(([w, t]) => `<option value="${w}"${a.status === w ? " selected" : ""}>${t}</option>`)
                .join("")}
            </select>
          </label>
          <label class="admin-select">
            <span>Umsatzsteuer</span>
            <select data-ust="${esc(k)}">
              <option value="klein"${a.kleinunternehmer ? " selected" : ""}>Keine, § 19 UStG</option>
              <option value="voll"${!a.kleinunternehmer ? " selected" : ""}>19 % ausweisen</option>
            </select>
          </label>
        </div>

        <div class="admin-angebot-nav">
          <button type="button" class="admin-speichern" data-aspeichern="${esc(k)}">Speichern</button>
          <button type="button" class="admin-kopieren" data-akopieren="${esc(k)}">Text kopieren</button>
          ${einstellungen.mailversand ? `<button type="button" class="admin-kopieren" data-amailen="${esc(k)}">Direkt senden</button>` : ""}
          <button type="button" class="admin-kopieren" data-amailprog="${esc(k)}">Im Mailprogramm öffnen</button>
          ${istEntwurf ? "" : `<button type="button" class="admin-speichern" data-rechnung-aus="${esc(k)}">Rechnung daraus schreiben</button>`}
          <button type="button" class="admin-loeschen" data-aloeschen="${esc(k)}">${istEntwurf ? "Verwerfen" : "Löschen"}</button>
          <span class="admin-hinweis" data-hinweis="${esc(k)}"></span>
        </div>
      </div>`;
  }

  function positionHtml(k, p) {
    return `
      <div class="admin-pos">
        <input type="text" data-p-text="${esc(k)}" value="${esc(p.text)}" placeholder="Was ist enthalten?">
        <input type="number" min="0" step="0.5" data-p-menge="${esc(k)}" value="${p.menge}" aria-label="Menge">
        <input type="text" data-p-einheit="${esc(k)}" value="${esc(p.einheit || "Stk.")}" aria-label="Einheit">
        <input type="number" min="0" step="10" data-p-preis="${esc(k)}" value="${p.preis || ""}" placeholder="0" aria-label="Einzelpreis">
        <span class="admin-pos-summe">${euro((Number(p.menge) || 0) * (Number(p.preis) || 0))}</span>
        <button type="button" class="admin-pos-weg" data-pos-weg="${esc(k)}" aria-label="Position entfernen">×</button>
      </div>`;
  }

  function summeHtml(a) {
    const zeilen = [["Netto", euro(a.netto)]];
    if (a.rabattProzent > 0) {
      zeilen.push([`Rabatt ${a.rabattProzent} %${a.rabattText ? ` (${a.rabattText})` : ""}`, "− " + euro(a.rabattBetrag)]);
      zeilen.push(["Zwischensumme", euro(a.nettoNachRabatt)]);
    }
    if (!a.kleinunternehmer) zeilen.push([`Umsatzsteuer ${a.ustSatz} %`, euro(a.ust)]);
    return (
      zeilen.map(([t, w]) => `<div class="admin-summe-zeile"><span>${esc(t)}</span><span>${w}</span></div>`).join("") +
      `<div class="admin-summe-zeile is-gesamt"><span>Gesamt</span><span>${euro(a.gesamt)}</span></div>` +
      (a.kleinunternehmer && einstellungen.ustHinweis ? `<p class="admin-fussnote">${esc(einstellungen.ustHinweis)}</p>` : "")
    );
  }

  /** Liest den kompletten Editor aus. Einzige Stelle, die das Formular kennt. */
  function leseEditor(k) {
    const wurzel = listAngeboteEl.querySelector(`[data-editor="${CSS.escape(k)}"]`);
    const w = (attr) => wurzel.querySelector(`[data-${attr}]`)?.value ?? "";
    const alle = (attr) => [...wurzel.querySelectorAll(`[data-${attr}]`)].map((e) => e.value);
    const texte = alle("p-text");
    const mengen = alle("p-menge");
    const einheiten = alle("p-einheit");
    const preise = alle("p-preis");

    return {
      kunde: {
        name: w("k-name"),
        firma: w("k-firma"),
        strasse: w("k-strasse"),
        plz: w("k-plz"),
        ort: w("k-ort"),
        email: w("k-email"),
      },
      titel: w("titel"),
      einleitung: w("einleitung"),
      positionen: texte.map((t, i) => ({
        text: t,
        menge: Number(mengen[i]) || 0,
        einheit: einheiten[i] || "Stk.",
        preis: Number(preise[i]) || 0,
      })),
      rabattProzent: Number(w("rabatt")) || 0,
      rabattText: w("rabatttext"),
      kleinunternehmer: w("ust") !== "voll",
      gueltigBis: w("gueltig"),
      lieferzeit: w("lieferzeit"),
      zahlung: w("zahlung"),
      hinweis: w("schluss"),
      notiz: w("anotiz"),
      status: w("astatus"),
    };
  }

  /** Rechnet im Browser nur für die Anzeige mit. Verbindlich ist der Worker. */
  function rechneAnzeige(d) {
    const rund = (n) => Math.round(n * 100) / 100;
    const satz = einstellungen.ustSatz || 19;
    const netto = d.positionen.reduce((s, p) => s + p.menge * p.preis, 0);
    const rabattBetrag = rund((netto * d.rabattProzent) / 100);
    const nettoNachRabatt = rund(netto - rabattBetrag);
    const ust = d.kleinunternehmer ? 0 : rund((nettoNachRabatt * satz) / 100);
    return { ...d, ustSatz: satz, netto: rund(netto), rabattBetrag, nettoNachRabatt, ust, gesamt: rund(nettoNachRabatt + ust) };
  }

  const stand = (k) => {
    const roh = k === "entwurf" ? entwurf : angebote.find((x) => x.id === k);
    return { ...roh, ...rechneAnzeige(leseEditor(k)) };
  };

  /* Tippen aktualisiert nur die Summen. Würde die ganze Liste neu gezeichnet,
     spränge der Cursor bei jedem Zeichen aus dem Feld. */
  listAngeboteEl.addEventListener("input", (event) => {
    const editor = event.target.closest("[data-editor]");
    if (!editor) return;
    const k = editor.dataset.editor;
    const jetzt = rechneAnzeige(leseEditor(k));
    editor.querySelector(`[data-summe]`).innerHTML = summeHtml(jetzt);
    const zeile = event.target.closest(".admin-pos");
    if (zeile) {
      const i = [...editor.querySelectorAll(".admin-pos")].indexOf(zeile);
      const p = jetzt.positionen[i];
      if (p) zeile.querySelector(".admin-pos-summe").textContent = euro(p.menge * p.preis);
    }
  });

  listAngeboteEl.addEventListener("change", (event) => {
    if (!event.target.closest("[data-ust]")) return;
    const editor = event.target.closest("[data-editor]");
    editor.querySelector(`[data-summe]`).innerHTML = summeHtml(rechneAnzeige(leseEditor(editor.dataset.editor)));
  });

  listAngeboteEl.addEventListener("click", async (event) => {
    const kopf = event.target.closest("[data-atoggle]");
    if (kopf) {
      offenesAngebot = offenesAngebot === kopf.dataset.atoggle ? null : kopf.dataset.atoggle;
      zeichneAngebotListe();
      return;
    }

    const plus = event.target.closest("[data-pos-plus]");
    if (plus) {
      const k = plus.dataset.posPlus;
      const jetzt = leseEditor(k);
      jetzt.positionen.push({ text: "", menge: 1, einheit: "Stk.", preis: 0 });
      uebernimm(k, jetzt);
      return;
    }

    const weg = event.target.closest("[data-pos-weg]");
    if (weg) {
      const k = weg.dataset.posWeg;
      const editor = weg.closest("[data-editor]");
      const i = [...editor.querySelectorAll(".admin-pos")].indexOf(weg.closest(".admin-pos"));
      const jetzt = leseEditor(k);
      jetzt.positionen.splice(i, 1);
      if (!jetzt.positionen.length) jetzt.positionen.push({ text: "", menge: 1, einheit: "Stk.", preis: 0 });
      uebernimm(k, jetzt);
      return;
    }

    const speichern = event.target.closest("[data-aspeichern]");
    if (speichern) return speichereAngebot(speichern.dataset.aspeichern);

    const kopieren = event.target.closest("[data-akopieren]");
    if (kopieren) {
      const k = kopieren.dataset.akopieren;
      const text = angebotText(stand(k));
      try {
        await navigator.clipboard.writeText(text);
        hinweis(listAngeboteEl, k, "Text kopiert");
      } catch {
        window.prompt("Angebotstext (mit Strg+C kopieren):", text);
      }
      return;
    }

    const rausRechnung = event.target.closest("[data-rechnung-aus]");
    if (rausRechnung) return rechnungAusAngebot(rausRechnung.dataset.rechnungAus);

    const mailen = event.target.closest("[data-amailen]");
    if (mailen) return sendeAngebot(mailen.dataset.amailen);

    const mailprog = event.target.closest("[data-amailprog]");
    if (mailprog) {
      const voll = stand(mailprog.dataset.amailprog);
      window.location.href =
        `mailto:${encodeURIComponent(voll.kunde.email || "")}` +
        `?subject=${encodeURIComponent(angebotBetreff(voll))}` +
        `&body=${encodeURIComponent(angebotText(voll))}`;
      return;
    }

    const loeschen = event.target.closest("[data-aloeschen]");
    if (loeschen) {
      const k = loeschen.dataset.aloeschen;
      if (k === "entwurf") {
        entwurf = null;
        offenesAngebot = null;
        zeichneAngebotListe();
        return;
      }
      if (!window.confirm("Dieses Angebot wirklich löschen?")) return;
      await api("/admin/angebot", { method: "POST", body: JSON.stringify({ id: k, loeschen: true }) });
      offenesAngebot = null;
      await laden();
    }
  });

  /** Zeichnet den Editor neu, ohne den gerade getippten Stand zu verlieren. */
  function uebernimm(k, jetzt) {
    const voll = rechneAnzeige(jetzt);
    if (k === "entwurf") {
      entwurf = { ...entwurf, ...voll };
    } else {
      const i = angebote.findIndex((x) => x.id === k);
      if (i >= 0) angebote[i] = { ...angebote[i], ...voll };
    }
    zeichneAngebotListe();
  }

  async function speichereAngebot(k) {
    const jetzt = leseEditor(k);
    if (!jetzt.kunde.name && !jetzt.kunde.firma) {
      hinweis(listAngeboteEl, k, "Name oder Firma fehlt.");
      return;
    }
    hinweis(listAngeboteEl, k, "Wird gespeichert…");
    try {
      const antwort = await api("/admin/angebot", {
        method: "POST",
        body: JSON.stringify({
          ...jetzt,
          id: k === "entwurf" ? "" : k,
          anfrageId: k === "entwurf" ? entwurf?.anfrageId || "" : undefined,
        }),
      });
      entwurf = null;
      offenesAngebot = antwort.angebot.id;
      await laden();
      hinweis(listAngeboteEl, antwort.angebot.id, "Gespeichert als Nr. " + antwort.angebot.nummer);
    } catch (fehler) {
      hinweis(listAngeboteEl, k, fehler.message);
    }
  }

  async function sendeAngebot(k) {
    const voll = stand(k);
    if (!voll.kunde.email) {
      hinweis(listAngeboteEl, k, "Ohne E-Mail-Adresse geht das nicht.");
      return;
    }
    hinweis(listAngeboteEl, k, "Wird gesendet…");
    try {
      await api("/admin/mail", {
        method: "POST",
        body: JSON.stringify({ an: voll.kunde.email, betreff: angebotBetreff(voll), text: angebotText(voll) }),
      });
      hinweis(listAngeboteEl, k, "Gesendet");
    } catch (fehler) {
      hinweis(listAngeboteEl, k, fehler.message);
    }
  }

  const angebotBetreff = (a) =>
    `Angebot ${a.nummer && a.nummer !== "neu" ? a.nummer + " " : ""}von Lynq-x${a.titel ? ": " + a.titel : ""}`;

  /** Der fertige Angebotstext, so wie er beim Kunden ankommen soll. */
  function angebotText(a) {
    const kunde = a.kunde || {};
    const zeilen = [];

    zeilen.push(absender.firma || "Lynq-x");
    if (absender.zusatz) zeilen.push(absender.zusatz);
    zeilen.push(absender.inhaber || "", absender.strasse || "", absender.ort || "");
    zeilen.push(`${absender.telefon || ""}  ·  ${absender.email || ""}`, "");

    if (kunde.firma || kunde.name) {
      zeilen.push(kunde.firma || "", kunde.name || "", kunde.strasse || "", `${kunde.plz || ""} ${kunde.ort || ""}`.trim(), "");
    }

    zeilen.push(`Angebot${a.nummer && a.nummer !== "neu" ? " Nr. " + a.nummer : ""}`);
    zeilen.push(`Datum: ${datum(a.erstelltAm || new Date().toISOString())}`);
    if (a.gueltigBis) zeilen.push(`Gültig bis: ${datum(a.gueltigBis)}`);
    zeilen.push("");

    if (a.titel) zeilen.push(a.titel, "");
    if (kunde.name) zeilen.push(`Hallo ${kunde.name.split(" ")[0]},`, "");
    if (a.einleitung) zeilen.push(a.einleitung, "");

    zeilen.push("Leistungen");
    for (const p of a.positionen.filter((p) => p.text || p.preis)) {
      zeilen.push(`  ${p.text}`);
      zeilen.push(`    ${p.menge} ${p.einheit} × ${euro(p.preis)}   =   ${euro(p.menge * p.preis)}`);
    }
    zeilen.push("");

    zeilen.push(`Netto:  ${euro(a.netto)}`);
    if (a.rabattProzent > 0) {
      zeilen.push(`Rabatt ${a.rabattProzent} %${a.rabattText ? ` (${a.rabattText})` : ""}:  − ${euro(a.rabattBetrag)}`);
    }
    if (!a.kleinunternehmer) zeilen.push(`Umsatzsteuer ${a.ustSatz} %:  ${euro(a.ust)}`);
    zeilen.push(`Gesamt:  ${euro(a.gesamt)}`);
    if (a.kleinunternehmer && einstellungen.ustHinweis) zeilen.push("", einstellungen.ustHinweis);
    zeilen.push("");

    if (a.lieferzeit) zeilen.push(`Zeitrahmen: ${a.lieferzeit}`);
    if (a.zahlung) zeilen.push(`Zahlung: ${a.zahlung}`);
    if (a.lieferzeit || a.zahlung) zeilen.push("");

    zeilen.push(a.hinweis || "Melde dich einfach, wenn du Fragen hast oder starten möchtest.", "");
    zeilen.push("Viele Grüße", absender.inhaber || "", absender.firma || "", absender.telefon || "", absender.web || "");

    return zeilen.filter((z, i, arr) => !(z === "" && arr[i - 1] === "")).join("\n");
  }


  /* ============================================================
     Rechnungen

     Anders als beim Angebot ist eine gestellte Rechnung nicht mehr
     aenderbar. Das ist Absicht: eine fortlaufende Nummer, die sich
     nachtraeglich anders liest, waere gegenueber dem Finanzamt nicht
     nachvollziehbar. Korrigieren heisst stornieren und neu schreiben.
     ============================================================ */

  function leereRechnung(quelle) {
    const heute = new Date().toISOString().slice(0, 10);
    return {
      id: "",
      nummer: "neu",
      status: "entwurf",
      angebotId: quelle?.id || "",
      anfrageId: quelle?.anfrageId || "",
      erstelltAm: new Date().toISOString(),
      datum: heute,
      leistungszeitraum: "",
      zahlungsziel: inTagen(einstellungen.zahlungszielTage || 14),
      kunde: quelle
        ? { ...quelle.kunde }
        : { name: "", firma: "", strasse: "", plz: "", ort: "", email: "" },
      titel: quelle?.titel || "",
      einleitung: "vielen Dank für den Auftrag. Wie besprochen stelle ich folgende Leistungen in Rechnung.",
      positionen: quelle?.positionen?.length
        ? quelle.positionen.map((p) => ({ ...p }))
        : [{ text: "", menge: 1, einheit: "Stk.", preis: 0 }],
      rabattProzent: quelle?.rabattProzent || 0,
      rabattText: quelle?.rabattText || "",
      kleinunternehmer: quelle ? quelle.kleinunternehmer : einstellungen.kleinunternehmer !== false,
      ustSatz: einstellungen.ustSatz || 19,
      zahlung: einstellungen.zahlungRechnung || "",
      hinweis: "",
      notiz: "",
      netto: 0,
      rabattBetrag: 0,
      nettoNachRabatt: 0,
      ust: 0,
      gesamt: 0,
    };
  }

  neuRechnungBtn.addEventListener("click", () => {
    rechnungEntwurf = leereRechnung(null);
    offeneRechnung = "entwurf";
    zeichneRechnungListe();
    zeigeReiter("rechnungen");
  });

  function rechnungAusAngebot(angebotId) {
    const a = angebote.find((x) => x.id === angebotId);
    if (!a) return;
    rechnungEntwurf = leereRechnung(a);
    offeneRechnung = "entwurf";
    zeichneRechnungListe();
    zeigeReiter("rechnungen");
  }

  function zeichneRechnungFilter() {
    const zaehler = (s) => (s === "alle" ? rechnungen.length : rechnungen.filter((r) => r.status === s).length);
    filterRechnungenEl.innerHTML = [["alle", "Alle"], ...Object.entries(R_STATUS)]
      .map(
        ([w, t]) =>
          `<button type="button" class="admin-chip${w === filterRechnungen ? " is-active" : ""}" data-rfilter="${w}">${t} <span>${zaehler(w)}</span></button>`,
      )
      .join("");
  }

  filterRechnungenEl.addEventListener("click", (event) => {
    const knopf = event.target.closest("[data-rfilter]");
    if (!knopf) return;
    filterRechnungen = knopf.dataset.rfilter;
    zeichneRechnungFilter();
    zeichneRechnungListe();
  });

  function zeichneRechnungListe() {
    const sichtbar = filterRechnungen === "alle" ? rechnungen : rechnungen.filter((r) => r.status === filterRechnungen);
    const teile = [];
    if (rechnungEntwurf) teile.push(rechnungHtml(rechnungEntwurf, true));
    teile.push(...sichtbar.map((r) => rechnungHtml(r, false)));
    listRechnungenEl.innerHTML = teile.length
      ? teile.join("")
      : '<p class="admin-leer">Noch keine Rechnung. Über „Neue Rechnung“ legst du eine an, oder du machst aus einem Angebot eine.</p>';
  }

  const heuteIso = () => new Date().toISOString().slice(0, 10);

  function rechnungHtml(r, istEntwurf) {
    const k = istEntwurf ? "entwurf" : r.id;
    const offen = k === offeneRechnung;
    const spaet = r.status === "offen" && r.zahlungsziel && r.zahlungsziel < heuteIso();
    return `
      <article class="admin-item${offen ? " is-open" : ""}">
        <button type="button" class="admin-item-head" data-rtoggle="${esc(k)}" aria-expanded="${offen}">
          <span class="admin-item-datum">${istEntwurf ? "neu" : esc(r.nummer)}</span>
          <span class="admin-item-name">${esc(r.kunde.firma || r.kunde.name || "ohne Namen")}</span>
          <span class="admin-item-projekt">${esc(r.titel || "ohne Titel")}${spaet ? " · überfällig" : ""}</span>
          <span class="admin-badge admin-badge-${esc(r.status)}${spaet ? " is-warnung" : ""}">${R_STATUS[r.status] || r.status}</span>
          <span class="admin-item-betrag">${euroKurz(r.gesamt)}</span>
        </button>
        ${offen ? rechnungDetailHtml(r, k, istEntwurf) : ""}
      </article>`;
  }

  function rechnungDetailHtml(r, k, istEntwurf) {
    const gestellt = !istEntwurf && r.status !== "entwurf";
    const pos = r.positionen.length ? r.positionen : [{ text: "", menge: 1, einheit: "Stk.", preis: 0 }];

    /* Ist die Rechnung raus, wird nichts mehr zum Bearbeiten angeboten.
       Dann zeigt die Ansicht nur noch den fertigen Text und den Status. */
    if (gestellt) {
      return `
        <div class="admin-item-body" data-reditor="${esc(k)}">
          <p class="admin-fussnote">Diese Rechnung ist gestellt und lässt sich nicht mehr ändern. Zum Korrigieren stornieren und eine neue schreiben.</p>
          <pre class="admin-vorschau">${esc(rechnungText(r))}</pre>
          <div class="admin-aktionen">
            <label class="admin-select">
              <span>Status</span>
              <select data-rstatus="${esc(k)}">
                ${Object.entries(R_STATUS)
                  .map(([w, t]) => `<option value="${w}"${r.status === w ? " selected" : ""}>${t}</option>`)
                  .join("")}
              </select>
            </label>
          </div>
          <div class="admin-angebot-nav">
            <button type="button" class="admin-kopieren" data-rkopieren="${esc(k)}">Text kopieren</button>
            ${einstellungen.mailversand ? `<button type="button" class="admin-kopieren" data-rmailen="${esc(k)}">Direkt senden</button>` : ""}
            <button type="button" class="admin-kopieren" data-rmailprog="${esc(k)}">Im Mailprogramm öffnen</button>
            <button type="button" class="admin-loeschen" data-rloeschen="${esc(k)}">Löschen</button>
            <span class="admin-hinweis" data-hinweis="${esc(k)}"></span>
          </div>
        </div>`;
    }

    return `
      <div class="admin-item-body" data-reditor="${esc(k)}">

        <h3 class="admin-h3">Kunde</h3>
        <div class="admin-angebot-felder">
          <label class="form-row"><span>Name</span><input type="text" data-rk-name="${esc(k)}" value="${esc(r.kunde.name)}"></label>
          <label class="form-row"><span>Firma</span><input type="text" data-rk-firma="${esc(k)}" value="${esc(r.kunde.firma)}"></label>
        </div>
        <div class="admin-angebot-felder">
          <label class="form-row"><span>Straße und Nummer</span><input type="text" data-rk-strasse="${esc(k)}" value="${esc(r.kunde.strasse)}"></label>
          <label class="form-row"><span>E-Mail</span><input type="email" data-rk-email="${esc(k)}" value="${esc(r.kunde.email)}"></label>
        </div>
        <div class="admin-angebot-felder">
          <label class="form-row"><span>PLZ</span><input type="text" data-rk-plz="${esc(k)}" value="${esc(r.kunde.plz)}"></label>
          <label class="form-row"><span>Ort</span><input type="text" data-rk-ort="${esc(k)}" value="${esc(r.kunde.ort)}"></label>
        </div>

        <h3 class="admin-h3">Rechnung</h3>
        <div class="admin-angebot-felder">
          <label class="form-row"><span>Rechnungsdatum</span><input type="date" data-rdatum="${esc(k)}" value="${esc(r.datum)}"></label>
          <label class="form-row"><span>Zahlungsziel</span><input type="date" data-rziel="${esc(k)}" value="${esc(r.zahlungsziel)}"></label>
        </div>
        <label class="form-row">
          <span>Zeitpunkt der Leistung</span>
          <input type="text" data-rzeitraum="${esc(k)}" value="${esc(r.leistungszeitraum)}" placeholder="z. B. August 2026 oder 12.08.2026">
        </label>
        <label class="form-row"><span>Betreff</span><input type="text" data-rtitel="${esc(k)}" value="${esc(r.titel)}" placeholder="z. B. Website und Bestellsystem"></label>
        <label class="form-row"><span>Einleitung</span><textarea rows="2" data-reinleitung="${esc(k)}">${esc(r.einleitung)}</textarea></label>

        <div class="admin-pos-kopf" aria-hidden="true">
          <span>Leistung</span><span>Menge</span><span>Einheit</span><span>Preis</span><span>Summe</span><span></span>
        </div>
        <div class="admin-positionen">
          ${pos.map((p) => rechnungPositionHtml(k, p)).join("")}
        </div>
        <button type="button" class="admin-kopieren admin-pos-plus" data-rpos-plus="${esc(k)}">Position hinzufügen</button>

        <div class="admin-angebot-felder">
          <label class="form-row"><span>Rabatt in Prozent</span><input type="number" min="0" max="100" step="1" data-rrabatt="${esc(k)}" value="${r.rabattProzent || ""}" placeholder="0"></label>
          <label class="form-row"><span>Grund für den Rabatt</span><input type="text" data-rrabatttext="${esc(k)}" value="${esc(r.rabattText)}"></label>
        </div>

        <div class="admin-summe" data-rsumme="${esc(k)}">${summeHtml(r)}</div>

        <label class="form-row"><span>Zahlungsbedingung</span><textarea rows="2" data-rzahlung="${esc(k)}">${esc(r.zahlung)}</textarea></label>
        <label class="form-row"><span>Schlusswort</span><textarea rows="2" data-rschluss="${esc(k)}" placeholder="Optional">${esc(r.hinweis)}</textarea></label>
        <label class="form-row"><span>Interne Notiz</span><textarea rows="2" data-rnotiz="${esc(k)}" placeholder="Nur für dich">${esc(r.notiz)}</textarea></label>

        <div class="admin-aktionen">
          <label class="admin-select">
            <span>Umsatzsteuer</span>
            <select data-rust="${esc(k)}">
              <option value="klein"${r.kleinunternehmer ? " selected" : ""}>Keine, § 19 UStG</option>
              <option value="voll"${!r.kleinunternehmer ? " selected" : ""}>19 % ausweisen</option>
            </select>
          </label>
        </div>

        <div class="admin-angebot-nav">
          <button type="button" class="admin-speichern" data-rspeichern="${esc(k)}">Entwurf speichern</button>
          <button type="button" class="admin-speichern" data-rstellen="${esc(k)}">Rechnung stellen</button>
          <button type="button" class="admin-kopieren" data-rkopieren="${esc(k)}">Text kopieren</button>
          <button type="button" class="admin-loeschen" data-rloeschen="${esc(k)}">${istEntwurf ? "Verwerfen" : "Löschen"}</button>
          <span class="admin-hinweis" data-hinweis="${esc(k)}"></span>
        </div>
        <p class="admin-fussnote">„Rechnung stellen“ vergibt die endgültige Nummer und friert den Inhalt ein. Danach ist nur noch der Status änderbar.</p>
      </div>`;
  }

  function rechnungPositionHtml(k, p) {
    return `
      <div class="admin-pos">
        <input type="text" data-rp-text="${esc(k)}" value="${esc(p.text)}" placeholder="Was wurde geleistet?">
        <input type="number" min="0" step="0.5" data-rp-menge="${esc(k)}" value="${p.menge}" aria-label="Menge">
        <input type="text" data-rp-einheit="${esc(k)}" value="${esc(p.einheit || "Stk.")}" aria-label="Einheit">
        <input type="number" min="0" step="10" data-rp-preis="${esc(k)}" value="${p.preis || ""}" placeholder="0" aria-label="Einzelpreis">
        <span class="admin-pos-summe">${euro((Number(p.menge) || 0) * (Number(p.preis) || 0))}</span>
        <button type="button" class="admin-pos-weg" data-rpos-weg="${esc(k)}" aria-label="Position entfernen">×</button>
      </div>`;
  }

  function leseRechnungEditor(k) {
    const wurzel = listRechnungenEl.querySelector(`[data-reditor="${CSS.escape(k)}"]`);
    const w = (attr) => wurzel.querySelector(`[data-${attr}]`)?.value ?? "";
    const alle = (attr) => [...wurzel.querySelectorAll(`[data-${attr}]`)].map((e) => e.value);
    const texte = alle("rp-text");
    const mengen = alle("rp-menge");
    const einheiten = alle("rp-einheit");
    const preise = alle("rp-preis");

    return {
      kunde: {
        name: w("rk-name"),
        firma: w("rk-firma"),
        strasse: w("rk-strasse"),
        plz: w("rk-plz"),
        ort: w("rk-ort"),
        email: w("rk-email"),
      },
      datum: w("rdatum"),
      zahlungsziel: w("rziel"),
      leistungszeitraum: w("rzeitraum"),
      titel: w("rtitel"),
      einleitung: w("reinleitung"),
      positionen: texte.map((t, i) => ({
        text: t,
        menge: Number(mengen[i]) || 0,
        einheit: einheiten[i] || "Stk.",
        preis: Number(preise[i]) || 0,
      })),
      rabattProzent: Number(w("rrabatt")) || 0,
      rabattText: w("rrabatttext"),
      kleinunternehmer: w("rust") !== "voll",
      zahlung: w("rzahlung"),
      hinweis: w("rschluss"),
      notiz: w("rnotiz"),
    };
  }

  const rstand = (k) => {
    const roh = k === "entwurf" ? rechnungEntwurf : rechnungen.find((x) => x.id === k);
    if (roh && roh.status !== "entwurf") return roh;
    return { ...roh, ...rechneAnzeige(leseRechnungEditor(k)) };
  };

  listRechnungenEl.addEventListener("input", (event) => {
    const editor = event.target.closest("[data-reditor]");
    if (!editor || !editor.querySelector("[data-rsumme]")) return;
    const jetzt = rechneAnzeige(leseRechnungEditor(editor.dataset.reditor));
    editor.querySelector("[data-rsumme]").innerHTML = summeHtml(jetzt);
    const zeile = event.target.closest(".admin-pos");
    if (zeile) {
      const i = [...editor.querySelectorAll(".admin-pos")].indexOf(zeile);
      const p = jetzt.positionen[i];
      if (p) zeile.querySelector(".admin-pos-summe").textContent = euro(p.menge * p.preis);
    }
  });

  listRechnungenEl.addEventListener("change", async (event) => {
    if (event.target.closest("[data-rust]")) {
      const editor = event.target.closest("[data-reditor]");
      editor.querySelector("[data-rsumme]").innerHTML = summeHtml(rechneAnzeige(leseRechnungEditor(editor.dataset.reditor)));
      return;
    }
    const auswahl = event.target.closest("[data-rstatus]");
    if (!auswahl) return;
    try {
      await api("/admin/rechnung", {
        method: "POST",
        body: JSON.stringify({ id: auswahl.dataset.rstatus, status: auswahl.value }),
      });
      await laden();
    } catch (fehler) {
      hinweis(listRechnungenEl, auswahl.dataset.rstatus, fehler.message);
    }
  });

  listRechnungenEl.addEventListener("click", async (event) => {
    const kopf = event.target.closest("[data-rtoggle]");
    if (kopf) {
      offeneRechnung = offeneRechnung === kopf.dataset.rtoggle ? null : kopf.dataset.rtoggle;
      zeichneRechnungListe();
      return;
    }

    const plus = event.target.closest("[data-rpos-plus]");
    if (plus) {
      const k = plus.dataset.rposPlus;
      const jetzt = leseRechnungEditor(k);
      jetzt.positionen.push({ text: "", menge: 1, einheit: "Stk.", preis: 0 });
      uebernimmRechnung(k, jetzt);
      return;
    }

    const weg = event.target.closest("[data-rpos-weg]");
    if (weg) {
      const k = weg.dataset.rposWeg;
      const editor = weg.closest("[data-reditor]");
      const i = [...editor.querySelectorAll(".admin-pos")].indexOf(weg.closest(".admin-pos"));
      const jetzt = leseRechnungEditor(k);
      jetzt.positionen.splice(i, 1);
      if (!jetzt.positionen.length) jetzt.positionen.push({ text: "", menge: 1, einheit: "Stk.", preis: 0 });
      uebernimmRechnung(k, jetzt);
      return;
    }

    const speichern = event.target.closest("[data-rspeichern]");
    if (speichern) return speichereRechnung(speichern.dataset.rspeichern, "entwurf");

    const stellen = event.target.closest("[data-rstellen]");
    if (stellen) {
      if (!window.confirm("Rechnung jetzt stellen? Danach lässt sie sich nicht mehr ändern, nur noch stornieren.")) return;
      return speichereRechnung(stellen.dataset.rstellen, "offen");
    }

    const kopieren = event.target.closest("[data-rkopieren]");
    if (kopieren) {
      const k = kopieren.dataset.rkopieren;
      const text = rechnungText(rstand(k));
      try {
        await navigator.clipboard.writeText(text);
        hinweis(listRechnungenEl, k, "Text kopiert");
      } catch {
        window.prompt("Rechnungstext (mit Strg+C kopieren):", text);
      }
      return;
    }

    const mailen = event.target.closest("[data-rmailen]");
    if (mailen) {
      const k = mailen.dataset.rmailen;
      const r = rstand(k);
      if (!r.kunde.email) return hinweis(listRechnungenEl, k, "Ohne E-Mail-Adresse geht das nicht.");
      hinweis(listRechnungenEl, k, "Wird gesendet…");
      try {
        await api("/admin/mail", {
          method: "POST",
          body: JSON.stringify({ an: r.kunde.email, betreff: rechnungBetreff(r), text: rechnungText(r) }),
        });
        hinweis(listRechnungenEl, k, "Gesendet");
      } catch (fehler) {
        hinweis(listRechnungenEl, k, fehler.message);
      }
      return;
    }

    const mailprog = event.target.closest("[data-rmailprog]");
    if (mailprog) {
      const r = rstand(mailprog.dataset.rmailprog);
      window.location.href =
        `mailto:${encodeURIComponent(r.kunde.email || "")}` +
        `?subject=${encodeURIComponent(rechnungBetreff(r))}` +
        `&body=${encodeURIComponent(rechnungText(r))}`;
      return;
    }

    const loeschen = event.target.closest("[data-rloeschen]");
    if (loeschen) {
      const k = loeschen.dataset.rloeschen;
      if (k === "entwurf") {
        rechnungEntwurf = null;
        offeneRechnung = null;
        zeichneRechnungListe();
        return;
      }
      if (!window.confirm("Diese Rechnung wirklich löschen?")) return;
      await api("/admin/rechnung", { method: "POST", body: JSON.stringify({ id: k, loeschen: true }) });
      offeneRechnung = null;
      await laden();
    }
  });

  function uebernimmRechnung(k, jetzt) {
    const voll = rechneAnzeige(jetzt);
    if (k === "entwurf") {
      rechnungEntwurf = { ...rechnungEntwurf, ...voll };
    } else {
      const i = rechnungen.findIndex((x) => x.id === k);
      if (i >= 0) rechnungen[i] = { ...rechnungen[i], ...voll };
    }
    zeichneRechnungListe();
  }

  async function speichereRechnung(k, status) {
    const jetzt = leseRechnungEditor(k);
    if (!jetzt.kunde.name && !jetzt.kunde.firma) {
      return hinweis(listRechnungenEl, k, "Name oder Firma fehlt.");
    }
    if (status === "offen" && !jetzt.leistungszeitraum) {
      return hinweis(listRechnungenEl, k, "Der Zeitpunkt der Leistung fehlt, der ist Pflicht.");
    }
    hinweis(listRechnungenEl, k, "Wird gespeichert…");
    try {
      const antwort = await api("/admin/rechnung", {
        method: "POST",
        body: JSON.stringify({
          ...jetzt,
          status,
          id: k === "entwurf" ? "" : k,
          angebotId: k === "entwurf" ? rechnungEntwurf?.angebotId || "" : undefined,
          anfrageId: k === "entwurf" ? rechnungEntwurf?.anfrageId || "" : undefined,
        }),
      });
      rechnungEntwurf = null;
      offeneRechnung = antwort.rechnung.id;
      await laden();
      hinweis(listRechnungenEl, antwort.rechnung.id, `Gespeichert als ${antwort.rechnung.nummer}`);
    } catch (fehler) {
      hinweis(listRechnungenEl, k, fehler.message);
    }
  }

  const rechnungBetreff = (r) =>
    `Rechnung ${r.nummer && r.nummer !== "neu" ? r.nummer + " " : ""}von Lynq-x${r.titel ? ": " + r.titel : ""}`;

  /** Der fertige Rechnungstext mit allen Pflichtangaben nach § 14 UStG. */
  function rechnungText(r) {
    const kunde = r.kunde || {};
    const zeilen = [];
    const e = einstellungen;

    zeilen.push(absender.firma || "Lynq-x");
    if (absender.zusatz) zeilen.push(absender.zusatz);
    zeilen.push(absender.inhaber || "", absender.strasse || "", absender.ort || "");
    zeilen.push(`${absender.telefon || ""}  ·  ${absender.email || ""}`);
    if (e.steuernummer) zeilen.push(`Steuernummer: ${e.steuernummer}`);
    if (e.ustId) zeilen.push(`USt-IdNr.: ${e.ustId}`);
    zeilen.push("");

    if (kunde.firma || kunde.name) {
      zeilen.push(kunde.firma || "", kunde.name || "", kunde.strasse || "", `${kunde.plz || ""} ${kunde.ort || ""}`.trim(), "");
    }

    zeilen.push(`Rechnung${r.nummer && r.nummer !== "neu" ? " " + r.nummer : ""}`);
    zeilen.push(`Rechnungsdatum: ${datum(r.datum)}`);
    if (r.leistungszeitraum) zeilen.push(`Zeitpunkt der Leistung: ${r.leistungszeitraum}`);
    zeilen.push("");

    if (r.titel) zeilen.push(r.titel, "");
    if (kunde.name) zeilen.push(`Hallo ${kunde.name.split(" ")[0]},`, "");
    if (r.einleitung) zeilen.push(r.einleitung, "");

    zeilen.push("Leistungen");
    for (const p of r.positionen.filter((p) => p.text || p.preis)) {
      zeilen.push(`  ${p.text}`);
      zeilen.push(`    ${p.menge} ${p.einheit} × ${euro(p.preis)}   =   ${euro(p.menge * p.preis)}`);
    }
    zeilen.push("");

    zeilen.push(`Netto:  ${euro(r.netto)}`);
    if (r.rabattProzent > 0) {
      zeilen.push(`Rabatt ${r.rabattProzent} %${r.rabattText ? ` (${r.rabattText})` : ""}:  − ${euro(r.rabattBetrag)}`);
    }
    if (!r.kleinunternehmer) zeilen.push(`Umsatzsteuer ${r.ustSatz} %:  ${euro(r.ust)}`);
    zeilen.push(`Rechnungsbetrag:  ${euro(r.gesamt)}`);
    if (r.kleinunternehmer && e.ustHinweis) zeilen.push("", e.ustHinweis);
    zeilen.push("");

    if (r.zahlungsziel) zeilen.push(`Zahlbar bis: ${datum(r.zahlungsziel)}`);
    if (r.zahlung) zeilen.push(r.zahlung);
    zeilen.push("");

    const bank = e.bank || {};
    if (bank.iban) {
      zeilen.push("Bankverbindung");
      if (bank.inhaber) zeilen.push(`  ${bank.inhaber}`);
      zeilen.push(`  IBAN: ${bank.iban}`);
      if (bank.bic) zeilen.push(`  BIC: ${bank.bic}`);
      if (bank.institut) zeilen.push(`  ${bank.institut}`);
      zeilen.push(`  Verwendungszweck: ${r.nummer}`);
      zeilen.push("");
    }

    if (r.hinweis) zeilen.push(r.hinweis, "");
    zeilen.push("Viele Grüße", absender.inhaber || "", absender.firma || "", absender.web || "");

    return zeilen.filter((z, i, arr) => !(z === "" && arr[i - 1] === "")).join("\n");
  }

  /* ---------- Start ---------- */

  if (!API) {
    loginNote.textContent = "Der Worker ist noch nicht verbunden. Trag seine Adresse in js/config.js ein.";
  } else if (token) {
    zeigeBoard();
    laden();
  }
})();
