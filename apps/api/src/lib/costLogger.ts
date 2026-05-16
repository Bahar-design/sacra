import { supabaseAdmin } from "./supabase";

// Whisper: ~$0.006/min = $0.0001/sec
export async function logWhisperCost(audioSeconds: number) {
  const cost =
    audioSeconds * parseFloat(process.env.WHISPER_COST_PER_SECOND || "0.0001");
  await supabaseAdmin.from("api_cost_log").insert({
    service: "whisper",
    tokens: Math.ceil(audioSeconds),
    cost_usd: cost,
  });
}
// ada-002 embeddings: $0.0001 per 1K tokens
export async function logEmbeddingCost(tokenCount: number) {
  const cost =
    (tokenCount / 1000) *
    parseFloat(process.env.EMBEDDING_COST_PER_1K || "0.0001");
  await supabaseAdmin.from("api_cost_log").insert({
    service: "embeddings",
    tokens: tokenCount,
    cost_usd: cost,
  });
}
