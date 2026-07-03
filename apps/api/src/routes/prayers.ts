import { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../lib/supabase";

export async function prayerRoutes(fastify: FastifyInstance) {
  // GET /api/prayers — paginated list with optional filters
  fastify.get("/", async (req, rep) => {
    const {
      religion_id,
      language,
      occasion,
      mood,
      page = "1",
      limit = "20",
    } = req.query as any;
    const lim = Math.min(parseInt(limit), 50);
    const offset = (parseInt(page) - 1) * lim;

    let q = supabaseAdmin
      .from("prayers")
      .select(
        "id,title,body,religion_id,tradition,language,occasion,mood,source,view_count,religions(name,icon_emoji)",
        { count: "exact" },
      )
      .eq("approved", true)
      .range(offset, offset + lim - 1)
      .order("view_count", { ascending: false });

    if (religion_id) q = q.eq("religion_id", religion_id);
    if (language) q = q.eq("language", language);
    if (occasion) q = q.contains("occasion", [occasion]);
    if (mood) q = q.contains("mood", [mood]);

    const { data, error, count } = await q;
    if (error) return rep.status(500).send({ error: error.message });
    return { data, total: count, page: parseInt(page), limit: lim };
  });

  // GET /api/prayers/religions/all
  fastify.get("/religions/all", async (req, rep) => {
    const { data, error } = await supabaseAdmin
      .from("religions")
      .select("*")
      .order("name");
    if (error) return rep.status(500).send({ error: error.message });
    return { data };
  });

  // GET /api/prayers/:id — single prayer with all detail
  fastify.get("/:id", async (req, rep) => {
    const { id } = req.params as any;
    const { data, error } = await supabaseAdmin
      .from("prayers")
      .select("*, religions(name, icon_emoji)")
      .eq("id", id)
      .single();
    if (error || !data) return rep.status(404).send({ error: "Not found" });
    // Increment view count without blocking the response
    supabaseAdmin.rpc("increment_view_count", { prayer_id: id }).then(() => {});
    return { data };
  });

  // GET /api/prayers/:id/similar — cross-faith similarity
  fastify.get("/:id/similar", async (req, rep) => {
    const { id } = req.params as any;
    const { data: prayer } = await supabaseAdmin
      .from("prayers")
      .select("id,religion_id,embedding")
      .eq("id", id)
      .single();
    if (!prayer?.embedding)
      return rep.status(422).send({ error: "No embedding" });
    const { data: similar } = await supabaseAdmin.rpc(
      "find_cross_faith_similar",
      {
        source_prayer_id: id,
        source_embedding: prayer.embedding,
        exclude_religion_id: prayer.religion_id,
        max_religions: 11,
      },
    );
    return { similar: similar || [] };
  });
}
