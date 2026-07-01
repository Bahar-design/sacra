import { FastifyInstance } from "fastify";
import OpenAI from "openai";
import { supabase, supabaseAdmin } from "../lib/supabase";
import { logEmbeddingCost } from "../lib/costLogger";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_TITLE  = 200;
const MAX_BODY   = 5000;
const MAX_SOURCE = 300;

// Protects admin-only endpoints with a shared secret set in Railway env vars.
function requireAdmin(req: any, rep: any): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return true; // dev: unconfigured = open (set in prod)
  if (req.headers["x-admin-secret"] !== secret) {
    rep.status(403).send({ error: "Forbidden" });
    return false;
  }
  return true;
}

// Returns the verified Supabase user ID from the Authorization header, or null for guests.
async function getRequestUserId(req: any): Promise<string | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const { data: { user } } = await supabase.auth.getUser(auth.slice(7));
  return user?.id ?? null;
}

export async function communityRoutes(fastify: FastifyInstance) {
  // POST /api/community/submit — user submits a prayer for review
  fastify.post("/submit", async (req, rep) => {
    const { title, body, religion_id, source } = req.body as any;
    // user_id is derived from the verified auth token — never trusted from the body
    const user_id = await getRequestUserId(req);

    if (!title?.trim() || !body?.trim())
      return rep.status(400).send({ error: "Title and body are required" });
    if (body.trim().length < 20)
      return rep.status(400).send({ error: "Prayer text too short" });
    if (title.trim().length > MAX_TITLE)
      return rep.status(400).send({ error: `Title too long (max ${MAX_TITLE} characters)` });
    if (body.trim().length > MAX_BODY)
      return rep.status(400).send({ error: `Prayer text too long (max ${MAX_BODY} characters)` });
    if (source && source.trim().length > MAX_SOURCE)
      return rep.status(400).send({ error: `Source too long (max ${MAX_SOURCE} characters)` });

    // Auto-validate using GPT — checks if it looks like a real prayer
    try {
      const validation = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `You are a religious text validator. Evaluate whether the following is a genuine, respectful prayer or sacred text from any world religion or spiritual tradition.

Title: ${title}
Text: ${body}
Source: ${source || "not provided"}

Respond with ONLY a JSON object in this exact format:
{"valid": true, "reason": "brief reason"}
OR
{"valid": false, "reason": "brief reason why rejected"}

Reject if: it is offensive, fake, nonsensical, contains hate speech, or is clearly not a prayer/sacred text.
Accept if: it appears to be a genuine prayer, mantra, blessing, or sacred verse from any tradition.`,
          },
        ],
        max_tokens: 100,
      });

      const responseText = validation.choices[0].message.content?.trim() || "";
      let result: { valid: boolean; reason: string };
      try {
        result = JSON.parse(responseText);
      } catch {
        // Unparseable response (e.g. prompt injection) — treat as untrusted,
        // fall through to the outer catch which queues as pending.
        throw new Error("Validation response could not be parsed");
      }

      if (!result.valid) {
        return rep.status(422).send({
          error: `Submission rejected: ${result.reason}`,
        });
      }

      // If valid, auto-approve and embed immediately
      const embRes = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: `${title}. ${body}`.replace(/\n/g, " "),
      });
      logEmbeddingCost(embRes.usage.total_tokens).catch(console.error);

      const { error: insertErr } = await supabaseAdmin.from("prayers").insert({
        title: title.trim(),
        body: body.trim(),
        religion_id: religion_id || null,
        source: source?.trim() || null,
        submitted_by: user_id || null,
        approved: true,
        embedding: JSON.stringify(embRes.data[0].embedding),
      });

      if (insertErr) throw insertErr;

      // Also log in community_submissions for record-keeping
      await supabaseAdmin.from("community_submissions").insert({
        title,
        body,
        religion_id,
        source,
        user_id,
        status: "approved",
      });

      return {
        success: true,
        message:
          "Your prayer has been validated and added to SACRA immediately. Thank you!",
      };
    } catch (err: any) {
      // If AI validation fails for any reason, fall back to pending queue
      await supabaseAdmin.from("community_submissions").insert({
        title,
        body,
        religion_id,
        source,
        user_id,
        status: "pending",
      });
      return {
        success: true,
        message: "Your prayer has been submitted for review. Thank you!",
      };
    }
  });

  // GET /api/community/queue — admin moderation queue
  fastify.get("/queue", async (req, rep) => {
    if (!requireAdmin(req, rep)) return;
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
    if (!requireAdmin(req, rep)) return;
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
    if (!requireAdmin(req, rep)) return;
    const { id } = req.params as any;
    await supabaseAdmin
      .from("community_submissions")
      .update({ status: "rejected" })
      .eq("id", id);
    return { success: true };
  });
}
