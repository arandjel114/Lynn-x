/**
 * Verlinkt die Profile in den sozialen Netzwerken.
 *
 * Die Symbole werden hier gezeichnet und nicht von Instagram oder TikTok
 * geladen. Das ist Absicht: keine fremden Server, keine Cookies, nichts,
 * was die Datenschutzerklärung umschreiben würde. Ein Besucher verlässt
 * die Seite erst, wenn er wirklich klickt.
 *
 * Adressen stehen in js/config.js. Was dort leer ist, erscheint nicht.
 */
(() => {
  "use strict";

  const profile = window.LYNQX_SOCIALS || {};

  /* Die Pfade zeichnen die Wortmarken nach. Sie liegen im Quelltext, damit
     die Seite ohne einen einzigen fremden Aufruf auskommt. */
  const NETZE = [
    {
      schluessel: "instagram",
      name: "Instagram",
      pfad:
        '<path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.31-1.46.72-2.13 1.38C1.35 2.68.94 3.35.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.79.72 1.46 1.38 2.13.67.67 1.34 1.08 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.3 1.46-.71 2.13-1.38.67-.67 1.08-1.34 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.3-.79-.71-1.46-1.38-2.13C21.32 1.35 20.65.94 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0z"/>' +
        '<path d="M12 5.84A6.16 6.16 0 1 0 12 18.16 6.16 6.16 0 0 0 12 5.84zm0 10.16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/>' +
        '<circle cx="18.41" cy="5.59" r="1.44"/>',
    },
    {
      schluessel: "tiktok",
      name: "TikTok",
      pfad:
        '<path d="M16.5 0h-3.9v15.7a3 3 0 1 1-3-3c.16 0 .3.01.45.03V8.7a7.2 7.2 0 0 0-.45-.02 6.99 6.99 0 1 0 6.99 6.99V7.6a8.9 8.9 0 0 0 5.16 1.65V5.35A5.36 5.36 0 0 1 16.5 0z"/>',
    },
  ];

  const symbol = (netz, adresse) =>
    `<a class="social" href="${adresse}" target="_blank" rel="noopener noreferrer me" aria-label="Lynq-x auf ${netz.name}" title="${netz.name}">` +
    `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${netz.pfad}</svg>` +
    `</a>`;

  const html = NETZE.filter((n) => (profile[n.schluessel] || "").trim())
    .map((n) => symbol(n, profile[n.schluessel].trim()))
    .join("");

  if (!html) return;

  for (const id of ["socials", "socialsKontakt"]) {
    const ziel = document.getElementById(id);
    if (!ziel) continue;
    ziel.innerHTML = html;
    ziel.hidden = false;
  }
})();
