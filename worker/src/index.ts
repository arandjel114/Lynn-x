/**
 * Lynn — der KI-Assistent von lynq-x.de.
 *
 * Dieser Cloudflare Worker sitzt zwischen der Website und der Claude-API.
 * Er existiert aus einem Grund: der API-Schlüssel darf niemals im Browser
 * landen. Der Browser spricht nur mit diesem Worker, der Worker spricht mit
 * Anthropic.
 *
 * Antworten werden gestreamt und als NDJSON zurückgegeben — eine JSON-Zeile
 * pro Ereignis:
 *   {"type":"delta","text":"…"}   Textstück
 *   {"type":"error","message":"…"} Fehler (kann auch mitten im Stream kommen)
 *   {"type":"done"}                fertig
 */
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./prompt";

export interface Env {
  ANTHROPIC_API_KEY: string;
  /** Komma-getrennte Liste erlaubter Origins, z. B. "https://lynq-x.de,https://www.lynq-x.de" */
  ALLOWED_ORIGINS?: string;
  /** Optionales KV-Binding für die Rate-Begrenzung. Fehlt es, wird nicht begrenzt. */
  RATE_LIMIT?: KVNamespace;
}

/* Grenzen. Bewusst eng — das hier ist ein FAQ-Chat, keine offene Spielwiese. */
const MAX_MESSAGES = 24; // Nachrichten im mitgeschickten Verlauf
const MAX_CHARS = 1500; // pro Nachricht
const MAX_TOKENS = 700; // Antwortlänge
const RATE_LIMIT_MAX = 25; // Anfragen …
const RATE_LIMIT_WINDOW = 600; // … pro 10 Minuten und IP

const DEFAULT_ORIGINS = ["https://lynq-x.de", "https://www.lynq-x.de"];

function allowedOrigins(env: Env): string[] {
  if (!env.ALLOWED_ORIGINS) return DEFAULT_ORIGINS;
  return env.ALLOWED_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const list = allowedOrigins(env);
  const allow = origin && list.includes(origin) ? origin : list[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonError(status: number, message: string, headers: Record<string, string>): Response {
  return new Response(JSON.stringify({ type: "error", message }), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}

/** Einfache Zählung pro IP. Ohne KV-Binding ein No-op. */
async function rateLimited(request: Request, env: Env): Promise<boolean> {
  if (!env.RATE_LIMIT) return false;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `rl:${ip}`;
  const current = Number((await env.RATE_LIMIT.get(key)) || "0");
  if (current >= RATE_LIMIT_MAX) return true;
  await env.RATE_LIMIT.put(key, String(current + 1), { expirationTtl: RATE_LIMIT_WINDOW });
  return false;
}

type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Prüft den Verlauf aus dem Browser. Alles, was hier durchkommt, ist
 * garantiert die Form, die die API erwartet — nichts wird durchgereicht.
 */
function parseMessages(body: unknown): ChatMessage[] | null {
  if (typeof body !== "object" || body === null) return null;
  const raw = (body as { messages?: unknown }).messages;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) return null;

  const messages: ChatMessage[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) return null;
    const { role, content } = entry as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string") return null;
    const text = content.trim().slice(0, MAX_CHARS);
    if (!text) return null;
    messages.push({ role, content: text });
  }
  // Die API verlangt, dass der Verlauf mit einer Nutzernachricht endet.
  if (messages[messages.length - 1].role !== "user") return null;
  return messages;
}

function line(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(payload) + "\n");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return jsonError(405, "Nur POST.", cors);
    }
    if (origin && !allowedOrigins(env).includes(origin)) {
      return jsonError(403, "Origin nicht erlaubt.", cors);
    }
    if (!env.ANTHROPIC_API_KEY) {
      return jsonError(500, "Der Assistent ist nicht konfiguriert.", cors);
    }
    if (await rateLimited(request, env)) {
      return jsonError(
        429,
        "Du hast gerade sehr viele Fragen gestellt. Bitte versuch es in ein paar Minuten noch einmal — oder schreib direkt an kontakt-lynq-x@outlook.de.",
        cors,
      );
    }

    let messages: ChatMessage[] | null;
    try {
      messages = parseMessages(await request.json());
    } catch {
      return jsonError(400, "Ungültige Anfrage.", cors);
    }
    if (!messages) {
      return jsonError(400, "Ungültiger Gesprächsverlauf.", cors);
    }

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    const stream = client.beta.messages.stream({
      model: "claude-opus-5",
      max_tokens: MAX_TOKENS,
      // Der System-Prompt ist auf jeder Anfrage identisch und wird deshalb
      // zwischengespeichert — das drückt die Kosten für Folgeanfragen deutlich.
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages,
      // Niedriger Aufwand: ein FAQ-Chat soll schnell antworten, nicht grübeln.
      output_config: { effort: "low" },
      // Falls die Sicherheitsfilter eine Anfrage ablehnen, beantwortet sie ein
      // Ausweichmodell, statt dass der Besucher gar keine Antwort bekommt.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // `fallbacks: "default"` ist neuer als die SDK-Typen dieses Stands.
    } as unknown as Parameters<typeof client.beta.messages.stream>[0]);

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta" &&
              event.delta.text
            ) {
              controller.enqueue(line({ type: "delta", text: event.delta.text }));
            }
          }
          const final = await stream.finalMessage();
          if (final.stop_reason === "refusal") {
            controller.enqueue(
              line({
                type: "error",
                message:
                  "Zu dieser Frage kann ich nichts sagen. Schreib gern direkt an kontakt-lynq-x@outlook.de.",
              }),
            );
          }
          controller.enqueue(line({ type: "done" }));
        } catch (error) {
          console.error("Assistent-Fehler:", error);
          controller.enqueue(
            line({
              type: "error",
              message:
                "Da ist gerade etwas schiefgelaufen. Versuch es bitte noch einmal — oder schreib an kontakt-lynq-x@outlook.de.",
            }),
          );
        } finally {
          controller.close();
        }
      },
      cancel() {
        stream.abort();
      },
    });

    return new Response(body, {
      headers: {
        ...cors,
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  },
};
