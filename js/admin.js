/**
 * Interner Bereich: Anfragen ansehen, Angebote schreiben, Einnahmen sehen.
 *
 * Wichtig zum Verständnis: Auf dieser Seite liegen keine Daten. Sie ist eine
 * leere Hülle. Anfragen, Angebote und Beträge liegen im Cloudflare Worker und
 * werden erst geladen, nachdem der Worker das Passwort geprüft hat. Wer die
 * Seite ohne Anmeldung öffnet oder den Quelltext ansieht, findet nichts.
 *
 * Die Anmeldung liefert einen Sitzungsschlüssel, der 12 Stunden gilt und im
 * Session Storage liegt. Der ist mit dem Schließen des Tabs weg.
 */
(() => {
  "use strict";

  const API = (window.LYNQX_API || "").replace(/\/+$/, "");
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const loginView = document.getElementById("loginView");
  const boardView = document.getElementById("boardView");
  const loginForm = document.getElementById("loginForm");
  const loginNote = document.getElementById("loginNote");
  const logoutBtn = document.getElementById("logoutBtn");
  const statsEl = document.getElementById("stats");
  const listEl = document.getElementById("list");
  const filterEl = document.getElementById("filter");
  const monthsEl = document.getElementById("months");
  const refreshBtn = document.getElementById("refreshBtn");

  const STATUS = {
    neu: "Neu",
    in_arbeit: "In Arbeit",
    angebot: "Angebot raus",
    angenommen: "Beauftragt",
    bezahlt: "Bezahlt",
    abgelehnt: "Abgelehnt",
  };

  let token = sessionStorage.getItem("lynqx_token") || "";
  let alle = [];
  let aktiverFilter = "alle";
  let offeneId = null;

  const euro = (n) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
  const datum = (iso) =>
    iso ? new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso)) : "";
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

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
        body: JSON.stringify({ passwort: document.getElementById("passwort").value }),
      });
      token = daten.token;
      sessionStorage.setItem("lynqx_token", token);
      document.getElementById("passwort").value = "";
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

  function abmelden(hinweis) {
    token = "";
    sessionStorage.removeItem("lynqx_token");
    boardView.hidden = true;
    logoutBtn.hidden = true;
    loginView.hidden = false;
    loginNote.textContent = hinweis || "";
  }

  logoutBtn.addEventListener("click", () => abmelden());

  /* ---------- Laden und Darstellen ---------- */

  async function laden() {
    listEl.innerHTML = '<p class="admin-leer">Wird geladen…</p>';
    try {
      const daten = await api("/admin/daten");
      alle = daten.anfragen;
      zeichneStats(daten.zahlen);
      zeichneFilter();
      zeichneListe();
      zeichneMonate(daten.zahlen.proMonat);
    } catch (fehler) {
      if (fehler.message !== "abgelaufen") {
        listEl.innerHTML = `<p class="admin-leer">${esc(fehler.message)}</p>`;
      }
    }
  }

  refreshBtn.addEventListener("click", laden);

  function zeichneStats(z) {
    const kacheln = [
      ["Neue Anfragen", z.neu, ""],
      ["In Arbeit", z.inArbeit, ""],
      ["Angebote offen", z.angeboteOffen, euro(z.angeboteOffenSumme)],
      ["Beauftragt", "", euro(z.beauftragtSumme)],
      ["Bezahlt", "", euro(z.bezahltSumme)],
      ["Anfragen gesamt", z.gesamt, ""],
    ];
    statsEl.innerHTML = kacheln
      .map(
        ([titel, zahl, betrag]) => `
        <div class="admin-stat">
          <span class="admin-stat-label">${titel}</span>
          <strong class="admin-stat-wert">${zahl !== "" ? zahl : betrag}</strong>
          ${zahl !== "" && betrag ? `<span class="admin-stat-neben">${betrag}</span>` : ""}
        </div>`,
      )
      .join("");
  }

  function zeichneFilter() {
    const zaehler = (s) => (s === "alle" ? alle.length : alle.filter((a) => a.status === s).length);
    const eintraege = [["alle", "Alle"], ...Object.entries(STATUS)];
    filterEl.innerHTML = eintraege
      .map(
        ([wert, titel]) =>
          `<button type="button" class="admin-chip${wert === aktiverFilter ? " is-active" : ""}" data-filter="${wert}">${titel} <span>${zaehler(wert)}</span></button>`,
      )
      .join("");
  }

  filterEl.addEventListener("click", (event) => {
    const knopf = event.target.closest("[data-filter]");
    if (!knopf) return;
    aktiverFilter = knopf.dataset.filter;
    zeichneFilter();
    zeichneListe();
  });

  function zeichneListe() {
    const sichtbar = aktiverFilter === "alle" ? alle : alle.filter((a) => a.status === aktiverFilter);
    if (!sichtbar.length) {
      listEl.innerHTML = '<p class="admin-leer">Hier ist gerade nichts.</p>';
      return;
    }
    listEl.innerHTML = sichtbar.map(zeileHtml).join("");
  }

  function zeileHtml(a) {
    const offen = a.id === offeneId;
    const betrag = a.angebot?.betrag ? euro(a.angebot.betrag) : "";
    return `
      <article class="admin-item${offen ? " is-open" : ""}" data-id="${esc(a.id)}">
        <button type="button" class="admin-item-head" data-toggle="${esc(a.id)}" aria-expanded="${offen}">
          <span class="admin-item-datum">${datum(a.eingang)}</span>
          <span class="admin-item-name">${esc(a.name)}</span>
          <span class="admin-item-projekt">${esc(a.projekt || "ohne Angabe")}</span>
          <span class="admin-badge admin-badge-${esc(a.status)}">${STATUS[a.status] || a.status}</span>
          <span class="admin-item-betrag">${betrag}</span>
        </button>
        ${offen ? detailHtml(a) : ""}
      </article>`;
  }

  function detailHtml(a) {
    const feld = (titel, wert) =>
      wert ? `<div class="admin-feld"><span>${titel}</span><strong>${esc(wert)}</strong></div>` : "";
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
          <a class="admin-mail" href="mailto:${esc(a.email)}?subject=${encodeURIComponent("Dein Projekt bei Lynq-x")}">Antworten</a>
          <button type="button" class="admin-loeschen" data-loeschen="${esc(a.id)}">Löschen</button>
        </div>

        <div class="admin-angebot">
          <h3 class="admin-h3">Angebot</h3>
          <div class="admin-angebot-felder">
            <label class="form-row">
              <span>Betrag in Euro</span>
              <input type="number" min="0" step="50" data-betrag="${esc(a.id)}" value="${a.angebot?.betrag ?? ""}" placeholder="z. B. 2400">
            </label>
            <label class="form-row">
              <span>Gültig bis</span>
              <input type="date" data-gueltig="${esc(a.id)}" value="${esc(a.angebot?.gueltigBis || "")}">
            </label>
          </div>
          <label class="form-row">
            <span>Leistungen</span>
            <textarea rows="4" data-leistung="${esc(a.id)}" placeholder="Was ist enthalten?">${esc(a.angebot?.leistung || "")}</textarea>
          </label>
          <label class="form-row">
            <span>Interne Notiz</span>
            <textarea rows="2" data-notiz="${esc(a.id)}" placeholder="Nur für dich">${esc(a.notiz || "")}</textarea>
          </label>
          <div class="admin-angebot-nav">
            <button type="button" class="admin-speichern" data-speichern="${esc(a.id)}">Speichern</button>
            <button type="button" class="admin-kopieren" data-kopieren="${esc(a.id)}">Angebotstext kopieren</button>
            <span class="admin-hinweis" data-hinweis="${esc(a.id)}"></span>
          </div>
        </div>
      </div>`;
  }

  function zeichneMonate(proMonat) {
    const monate = Object.entries(proMonat || {}).sort((a, b) => b[0].localeCompare(a[0]));
    if (!monate.length) {
      monthsEl.innerHTML = '<p class="admin-leer">Noch keine bezahlten Aufträge.</p>';
      return;
    }
    const hoechster = Math.max(...monate.map(([, w]) => w));
    monthsEl.innerHTML = monate
      .map(([monat, wert]) => {
        const [j, m] = monat.split("-");
        const name = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(new Date(+j, +m - 1, 1));
        return `
          <div class="admin-monat">
            <span class="admin-monat-name">${name}</span>
            <span class="admin-monat-balken"><i style="transform:scaleX(${(wert / hoechster).toFixed(3)})"></i></span>
            <strong class="admin-monat-wert">${euro(wert)}</strong>
          </div>`;
      })
      .join("");
  }

  /* ---------- Bedienung in der Liste ---------- */

  listEl.addEventListener("click", async (event) => {
    const kopf = event.target.closest("[data-toggle]");
    if (kopf) {
      offeneId = offeneId === kopf.dataset.toggle ? null : kopf.dataset.toggle;
      zeichneListe();
      return;
    }

    const speichern = event.target.closest("[data-speichern]");
    if (speichern) return speichereAngebot(speichern.dataset.speichern);

    const kopieren = event.target.closest("[data-kopieren]");
    if (kopieren) return kopiereAngebot(kopieren.dataset.kopieren);

    const loeschen = event.target.closest("[data-loeschen]");
    if (loeschen) {
      if (!window.confirm("Diese Anfrage wirklich löschen? Das lässt sich nicht rückgängig machen.")) return;
      await api("/admin/anfrage", { method: "POST", body: JSON.stringify({ id: loeschen.dataset.loeschen, loeschen: true }) });
      offeneId = null;
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

  function hinweis(id, text) {
    const el = listEl.querySelector(`[data-hinweis="${CSS.escape(id)}"]`);
    if (!el) return;
    el.textContent = text;
    window.setTimeout(() => { el.textContent = ""; }, 2500);
  }

  async function speichereAngebot(id) {
    const wert = (attr) => listEl.querySelector(`[data-${attr}="${CSS.escape(id)}"]`)?.value ?? "";
    try {
      await api("/admin/anfrage", {
        method: "POST",
        body: JSON.stringify({
          id,
          notiz: wert("notiz"),
          angebot: {
            betrag: wert("betrag"),
            gueltigBis: wert("gueltig"),
            leistung: wert("leistung"),
          },
        }),
      });
      hinweis(id, "Gespeichert");
      const eintrag = alle.find((a) => a.id === id);
      if (eintrag) {
        eintrag.angebot = { ...(eintrag.angebot || {}), betrag: Number(wert("betrag")) || 0 };
      }
    } catch (fehler) {
      hinweis(id, fehler.message);
    }
  }

  /* Fertiger Angebotstext zum Einfügen in die Mail. */
  async function kopiereAngebot(id) {
    const a = alle.find((x) => x.id === id);
    if (!a) return;
    const wert = (attr) => listEl.querySelector(`[data-${attr}="${CSS.escape(id)}"]`)?.value ?? "";
    const betrag = Number(wert("betrag")) || 0;
    const text =
      `Hallo ${a.name},\n\n` +
      `danke für deine Anfrage. Hier unser Angebot:\n\n` +
      `${wert("leistung") || "Leistungen nach Absprache"}\n\n` +
      `Festpreis: ${euro(betrag)}\n` +
      (wert("gueltig") ? `Gültig bis: ${datum(wert("gueltig"))}\n` : "") +
      `\nMelde dich einfach, wenn du Fragen hast oder starten möchtest.\n\n` +
      `Viele Grüße\nArandjel Jovanovic\nLynq-x\n0151 74367509`;
    try {
      await navigator.clipboard.writeText(text);
      hinweis(id, "Text kopiert");
    } catch {
      window.prompt("Angebotstext (mit Strg+C kopieren):", text);
    }
  }

  /* ---------- Start ---------- */

  if (!API) {
    loginNote.textContent = "Der Worker ist noch nicht verbunden. Trag seine Adresse in js/config.js ein.";
  } else if (token) {
    zeigeBoard();
    laden();
  }
})();
