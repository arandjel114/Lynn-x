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
window.LYNQX_API = "";
