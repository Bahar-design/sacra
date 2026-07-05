import { FastifyInstance } from "fastify";
import OpenAI, { toFile } from "openai";
import { supabaseAdmin } from "../lib/supabase";
import { logWhisperCost, logEmbeddingCost } from "../lib/costLogger";
import { Readable } from "stream";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Shared pipeline: transcribe audio then search for matching prayers
async function transcribeAndSearch(audioBuffer: Buffer, mimeType: string) {
  // Whisper supports 90+ languages automatically — Arabic, Hebrew, Sanskrit, Latin, etc.
  const transcription = (await openai.audio.transcriptions.create({
    file: await toFile(Readable.from(audioBuffer), "audio.m4a", {
      type: mimeType,
    }),
    model: "whisper-1",
    response_format: "verbose_json", // verbose gives us audio duration for cost logging
  })) as any;

  const text = transcription.text?.trim();
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

    // Optional language hint from previous chunk detection
    const langHint = ((req.query as any).language as string | undefined) || undefined;

    try {
      const transcription = (await openai.audio.transcriptions.create({
        file: await toFile(Readable.from(buf), "chunk.m4a", { type: data.mimetype }),
        model: "whisper-1",
        response_format: "verbose_json",
        // Grounds Whisper in sacred-text vocabulary, reducing hallucination on short clips
        prompt: "Sacred prayer, scripture, hymn, devotion, psalm, meditation.",
        ...(langHint ? { language: langHint } : {}),
      })) as any;
      logWhisperCost(transcription.duration || 0).catch(console.error);
      return {
        text: transcription.text?.trim() || "",
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
