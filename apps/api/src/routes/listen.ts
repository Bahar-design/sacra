import { FastifyInstance } from "fastify";
import OpenAI, { toFile } from "openai";
import { supabaseAdmin } from "../lib/supabase";
import { logWhisperCost, logEmbeddingCost } from "../lib/costLogger";
import { Readable } from "stream";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Whisper's verbose_json returns full language names ("persian", "arabic"),
// but the `language` request parameter only accepts ISO-639-1 codes ("fa", "ar").
// Passing a full name back as a hint fails the whole request with a 400.
const LANGUAGE_NAME_TO_ISO: Record<string, string> = {
  english: "en", spanish: "es", arabic: "ar", persian: "fa", farsi: "fa",
  french: "fr", german: "de", italian: "it", portuguese: "pt", hindi: "hi",
  urdu: "ur", hebrew: "he", turkish: "tr", russian: "ru", chinese: "zh",
  japanese: "ja", korean: "ko", sanskrit: "sa", punjabi: "pa", bengali: "bn",
  tamil: "ta", telugu: "te", indonesian: "id", malay: "ms", greek: "el",
  latin: "la", amharic: "am", swahili: "sw", dutch: "nl", polish: "pl",
  vietnamese: "vi", thai: "th", gujarati: "gu", marathi: "mr", nepali: "ne",
  sinhala: "si", burmese: "my", khmer: "km", tagalog: "tl", yoruba: "yo",
  hausa: "ha", somali: "so", pashto: "ps", kurdish: "ku", azerbaijani: "az",
  ukrainian: "uk", romanian: "ro", hungarian: "hu", czech: "cs", swedish: "sv",
  norwegian: "no", danish: "da", finnish: "fi", tibetan: "bo", mongolian: "mn",
};

// Accepts a full language name or an ISO code; returns a valid ISO-639-1 code
// or undefined (better to let Whisper auto-detect than to 400 the request).
function toIsoLanguage(lang?: string): string | undefined {
  if (!lang) return undefined;
  const lower = lang.trim().toLowerCase();
  if (LANGUAGE_NAME_TO_ISO[lower]) return LANGUAGE_NAME_TO_ISO[lower];
  if (/^[a-z]{2}$/.test(lower)) return lower;
  return undefined;
}

// Whisper hallucinates words during music, silence, and sustained sung notes.
// verbose_json exposes per-segment no_speech_prob — rebuild the text from
// segments it was actually confident contain speech.
function textFromSegments(transcription: any): string {
  const segments = transcription.segments;
  if (!Array.isArray(segments) || segments.length === 0)
    return transcription.text?.trim() || "";
  const kept = segments
    .filter((s: any) => (s.no_speech_prob ?? 0) < 0.6)
    .map((s: any) => (s.text || "").trim())
    .filter(Boolean);
  return kept.join(" ").trim();
}

// Shared pipeline: transcribe audio then search for matching prayers
async function transcribeAndSearch(audioBuffer: Buffer, mimeType: string) {
  // Whisper supports 90+ languages automatically — Arabic, Hebrew, Sanskrit, Latin, etc.
  const transcription = (await openai.audio.transcriptions.create({
    file: await toFile(Readable.from(audioBuffer), "audio.m4a", {
      type: mimeType,
    }),
    model: "whisper-1",
    response_format: "verbose_json", // verbose gives us audio duration for cost logging
    temperature: 0, // deterministic decoding — reduces hallucination on music/noise
  })) as any;

  const text = textFromSegments(transcription);
  logWhisperCost(transcription.duration || 0).catch(console.error);
  if (!text)
    throw new Error(
      "Could not transcribe audio. Try in a quieter environment.",
    );

  const embRes = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  });
  logEmbeddingCost(embRes.usage.total_tokens).catch(console.error);

  const { data: matches, error } = await supabaseAdmin.rpc("hybrid_search", {
    query_text: text,
    query_embedding: JSON.stringify(embRes.data[0].embedding),
    match_count: 5,
    religion_filter: null,
    language_filter: null,
  });
  if (error) throw error;
  return {
    transcription: text,
    matches: matches || [],
    top_match: matches?.[0] || null,
  };
}

export async function listenRoutes(fastify: FastifyInstance) {
  // ─── POST /api/listen/transcribe ────────────────────────────────────
  // Transcribe-only endpoint for real-time chunked recording.
  // Mobile sends audio every ~7s while recording continues.
  // Optional query param: ?language=arabic  (ISO 639-1 or name)
  //   Pass on subsequent chunks once the first chunk identifies the language.
  // Returns { text, detectedLanguage }.
  fastify.post("/transcribe", async (req, rep) => {
    const data = await req.file();
    if (!data) return rep.status(400).send({ error: "No audio file provided" });
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    if (buf.length === 0) return rep.status(400).send({ error: "Empty audio file" });

    // Optional language hint from previous chunk detection.
    // The client sends Whisper's full language name ("arabic") — convert to
    // the ISO-639-1 code the API requires, or drop it rather than 400.
    const langHint = toIsoLanguage(
      ((req.query as any).language as string | undefined) || undefined,
    );

    try {
      const transcription = (await openai.audio.transcriptions.create({
        // Use the uploaded filename — OpenAI validates format by extension
        file: await toFile(Readable.from(buf), data.filename || "chunk.m4a", { type: data.mimetype }),
        model: "whisper-1",
        response_format: "verbose_json",
        // No prompt: an English prompt biases language detection toward English
        // on exactly the chunks where detection matters most.
        temperature: 0, // deterministic decoding — reduces hallucination on sung/noisy audio
        ...(langHint ? { language: langHint } : {}),
      })) as any;
      logWhisperCost(transcription.duration || 0).catch(console.error);
      return {
        text: textFromSegments(transcription),
        detectedLanguage: (transcription.language as string | undefined) ?? null,
      };
    } catch (err: any) {
      return rep.status(422).send({ error: err.message });
    }
  });

  // ─── HTTP POST /api/listen ───────────────────────────────────────────
  // Standard file upload. User records audio, taps stop, file sent at once.
  fastify.post("/", async (req, rep) => {
    const data = await req.file();
    if (!data) return rep.status(400).send({ error: "No audio file provided" });
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    try {
      return await transcribeAndSearch(buf, data.mimetype);
    } catch (err: any) {
      return rep.status(422).send({ error: err.message });
    }
  });

  // ─── WebSocket GET /api/listen/stream ───────────────────────────────
  // Streaming mode. Client sends raw audio bytes continuously.
  // Server periodically sends partial transcription text back.
  // When client sends {type:'stop'}, server sends final result.
  fastify.get("/stream", { websocket: true }, (connection: any) => {
    const chunks: Buffer[] = [];

    connection.on("message", async (rawMsg: Buffer) => {
      try {
        // Try to parse as JSON control message first
        let msg: any;
        try {
          msg = JSON.parse(rawMsg.toString());
        } catch {
          // Not JSON — it's a raw audio chunk. Collect it.
          chunks.push(rawMsg);

          // Every ~32KB (about 2 seconds of audio), send a partial transcription
          // so words appear on screen while the user is still speaking
          if (Buffer.concat(chunks).length > 32000) {
            try {
              const partial = await openai.audio.transcriptions.create({
                file: await toFile(
                  Readable.from(Buffer.concat(chunks)),
                  "partial.m4a",
                  { type: "audio/m4a" },
                ),
                model: "whisper-1",
              });
              connection.send(
                JSON.stringify({ type: "partial", text: partial.text }),
              );
            } catch {
              /* partial failed — keep collecting, will succeed on final */
            }
          }
          return;
        }

        if (msg.type === "stop") {
          // Recording stopped — run full transcription + search on all collected audio
          if (chunks.length === 0) {
            connection.send(
              JSON.stringify({ type: "error", message: "No audio received" }),
            );
            return;
          }
          connection.send(JSON.stringify({ type: "processing" }));
          try {
            const result = await transcribeAndSearch(
              Buffer.concat(chunks),
              "audio/m4a",
            );
            connection.send(JSON.stringify({ type: "result", ...result }));
          } catch (err: any) {
            connection.send(
              JSON.stringify({ type: "error", message: err.message }),
            );
          }
        }
      } catch {
        connection.send(
          JSON.stringify({ type: "error", message: "Server error" }),
        );
      }
    });

    connection.on("close", () => {
      chunks.length = 0;
    });
  });
}
