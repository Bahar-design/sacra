import { FastifyInstance } from "fastify";
import OpenAI from "openai";
import { supabaseAdmin } from "../lib/supabase";
import { logEmbeddingCost } from "../lib/costLogger";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function searchRoutes(fastify: FastifyInstance) {
  fastify.post("/", async (req, rep) => {
    const { query, religion_id, language, limit: limitParam = 10 } = req.body as any;
    if (!query?.trim())
      return rep.status(400).send({ error: "Query required" });
    const limit = Math.max(1, Math.min(parseInt(String(limitParam)) || 10, 20));

    const embRes = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: query.replace(/\n/g, " "),
    });
    logEmbeddingCost(embRes.usage.total_tokens).catch(console.error);

    const { data, error } = await supabaseAdmin.rpc("hybrid_search", {
      query_text: query,
      query_embedding: JSON.stringify(embRes.data[0].embedding),
      match_count: Math.min(limit, 20),
      religion_filter: religion_id || null,
      language_filter: language || null,
    });
    if (error) throw error;
    return { results: data, query };
  });
}
