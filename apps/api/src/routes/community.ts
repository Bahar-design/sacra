import { FastifyInstance } from "fastify";
import OpenAI from "openai";
import { supabaseAdmin } from "../lib/supabase";
import { logEmbeddingCost } from "../lib/costLogger";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function communityRoutes(fastify: FastifyInstance) {
  // POST /api/community/submit — user submits a prayer for review
  fastify.post("/submit", async (req, rep) => {
    const { title, body, religion_id, source, user_id } = req.body as any;
    if (!title?.trim() || !body?.trim())
      return rep.status(400).send({ error: "Title and body are required" });
    if (body.trim().length < 20)
      return rep
        .status(400)
        .send({ error: "Prayer body too short (minimum 20 characters)" });

    const { data, error } = await supabaseAdmin
      .from("community_submissions")
      .insert({ title, body, religion_id, source, user_id, status: "pending" })
      .select()
      .single();
    if (error) return rep.status(500).send({ error: error.message });
    return {
      data,
      message: "Submission received. Thank you for contributing to SACRA.",
    };
  });

  // GET /api/community/queue — admin moderation queue
  fastify.get("/queue", async (req, rep) => {
    const { status = "pending", page = "1" } = req.query as any;
    const lim = 20;
    const offset = (parseInt(page) - 1) * lim;
    const { data, error, count } = await supabaseAdmin
      .from("community_submissions")
      .select("*, religions(name)", { count: "exact" })
      .eq("status", status)
      .order("created_at", { ascending: true })
      .range(offset, offset + lim - 1);
    if (error) return rep.status(500).send({ error: error.message });
    return { data, total: count };
  });

  // POST /api/community/:id/approve
  // Generates embedding and inserts into main prayers table automatically
  fastify.post("/:id/approve", async (req, rep) => {
    const { id } = req.params as any;
    const { data: sub, error: fe } = await supabaseAdmin
      .from("community_submissions")
      .select("*")
      .eq("id", id)
      .single();
    if (fe || !sub)
      return rep.status(404).send({ error: "Submission not found" });

    try {
      // 1. Generate embedding for the approved prayer text
      const embRes = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: `${sub.title}. ${sub.body}`.replace(/\n/g, " "),
      });
      logEmbeddingCost(embRes.usage.total_tokens).catch(console.error);

      // 2. Insert into main prayers table with embedding
      const { error: ie } = await supabaseAdmin.from("prayers").insert({
        title: sub.title,
        body: sub.body,
        religion_id: sub.religion_id,
        source: sub.source,
        submitted_by: sub.user_id,
        approved: true,
        embedding: JSON.stringify(embRes.data[0].embedding),
      });
      if (ie) throw ie;

      // 3. Mark submission as approved
      await supabaseAdmin
        .from("community_submissions")
        .update({ status: "approved" })
        .eq("id", id);

      return {
        success: true,
        message: "Prayer approved, embedded, and added to SACRA.",
      };
    } catch (err: any) {
      return rep.status(500).send({ error: err.message });
    }
  });

  // POST /api/community/:id/reject
  fastify.post("/:id/reject", async (req, rep) => {
    const { id } = req.params as any;
    await supabaseAdmin
      .from("community_submissions")
      .update({ status: "rejected" })
      .eq("id", id);
    return { success: true };
  });
}
