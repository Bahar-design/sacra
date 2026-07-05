import { FastifyInstance } from "fastify";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Strict allowlist — only languages the mobile app actually offers.
// Prevents prompt injection via target_language and limits API surface.
const ALLOWED_LANGUAGES = new Set([
  "English", "Spanish", "French", "German", "Italian", "Portuguese",
  "Russian", "Arabic", "Hebrew", "Hindi", "Urdu", "Persian", "Turkish",
  "Japanese", "Chinese", "Korean", "Bengali", "Indonesian", "Swahili", "Greek",
]);

const MAX_TEXTS  = 200;  // max strings per batch
const MAX_CHARS  = 8000; // max total characters across all texts

export async function translateRoutes(fastify: FastifyInstance) {
  // POST /api/translate
  // Body: { texts: string[], target_language: string }
  // Returns: { translations: string[] } — same order as input.
  // Batch-translates with GPT-4o-mini, preserving sacred/reverent tone.
  // Falls back to returning the originals on any error.
  fastify.post("/", async (req, rep) => {
    const body = req.body as { texts?: unknown; target_language?: unknown };
    const { texts, target_language } = body;

    if (!Array.isArray(texts) || texts.length === 0) {
      return rep.status(400).send({ error: "texts must be a non-empty array" });
    }
    if (texts.length > MAX_TEXTS) {
      return rep.status(400).send({ error: `texts exceeds maximum of ${MAX_TEXTS} items` });
    }
    // Ensure all elements are strings
    const safeTexts = texts.map((t) => (typeof t === "string" ? t : String(t)));
    const totalChars = safeTexts.reduce((n, t) => n + t.length, 0);
    if (totalChars > MAX_CHARS) {
      return rep.status(400).send({ error: "texts exceeds maximum character limit" });
    }
    if (typeof target_language !== "string" || !ALLOWED_LANGUAGES.has(target_language)) {
      return rep.status(400).send({ error: "unsupported target_language" });
    }
    if (target_language === "English") {
      return { translations: safeTexts };
    }

    try {
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              `You are a sacred text translator. Translate each string in the JSON array to ${target_language}. ` +
              "Preserve the spiritual, reverent, and poetic tone of every text. " +
              'Return ONLY valid JSON in this exact shape: {"translations":["...", "..."]} ' +
              "with the same number of strings as the input array and no other keys or commentary.",
          },
          { role: "user", content: JSON.stringify(safeTexts) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const raw = resp.choices[0].message.content ?? "{}";
      const parsed = JSON.parse(raw);

      if (
        !Array.isArray(parsed.translations) ||
        parsed.translations.length !== safeTexts.length
      ) {
        return { translations: safeTexts };
      }
      return { translations: parsed.translations as string[] };
    } catch {
      return { translations: safeTexts };
    }
  });
}
