/**
 * Zentrale Adresse des Cloudflare Workers.
 *
 * Hier steht die URL, die dir beim Deployen ausgegeben wurde, zum Beispiel
 * "https://lynq-x-assistant.dein-name.workers.dev" (ohne Schrägstrich am Ende).
 *
 * Solange das Feld leer ist, läuft die Website weiter:
 *   - der Chat antwortet aus seiner eigenen Wissensbasis
 *   - das Kontaktformular öffnet wie bisher das E-Mail-Programm
 *   - der Anfragen-Bereich unter /admin.html sagt, dass er nicht verbunden ist
 *
 * Anleitung: worker/README.md
 */
window.LYNQX_API = "https://flat-sun-939clynq-x-assistant.arandjeljovanovic3.workers.dev";

/**
 * Profile in den sozialen Netzwerken.
 *
 * Leer lassen heißt: das Symbol erscheint nicht. So steht nie ein Link da,
 * der ins Leere führt. Vollständige Adresse eintragen, ohne Anhängsel wie
 * "?utm_source=qr", das ist nur die Herkunftsmarkierung des QR-Codes.
 */
window.LYNQX_SOCIALS = {
  instagram: "https://www.instagram.com/lynqx.marketing",
  tiktok: "https://www.tiktok.com/@lynqxmarketing",
};
