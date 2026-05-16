import { FastifyInstance } from "fastify";
import { supabaseAdmin } from "../lib/supabase";

export async function dashboardRoutes(fastify: FastifyInstance) {
  // GET /api/dashboard/costs — monthly cost breakdown for the public dashboard
  fastify.get("/costs", async (req, rep) => {
    const { data: monthly } = await supabaseAdmin
      .from("api_cost_summary")
      .select("*");
    const { data: recent } = await supabaseAdmin
      .from("api_cost_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    const totalAllTime = (monthly || []).reduce(
      (s: number, r: any) => s + (r.total_cost || 0),
      0,
    );
    const thisMonth = (monthly || [])
      .filter(
        (r: any) => new Date(r.month).getMonth() === new Date().getMonth(),
      )
      .reduce((s: number, r: any) => s + (r.total_cost || 0), 0);

    return {
      monthly_breakdown: monthly || [],
      recent_requests: recent || [],
      totals: {
        all_time_usd: totalAllTime.toFixed(4),
        this_month_usd: thisMonth.toFixed(4),
      },
    };
  });

  // GET /api/dashboard/stats — general app statistics
  fastify.get("/stats", async () => {
    const [prayers, subs, history] = await Promise.all([
      supabaseAdmin
        .from("prayers")
        .select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("community_submissions")
        .select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("listen_history")
        .select("id", { count: "exact", head: true }),
    ]);
    return {
      total_prayers: prayers.count,
      total_submissions: subs.count,
      total_listens: history.count,
    };
  });
}
