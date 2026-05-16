import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase";

const t = initTRPC.create();

export const appRouter = t.router({
  religions: t.procedure.query(async () => {
    const { data } = await supabaseAdmin
      .from("religions")
      .select("*")
      .order("name");
    return data ?? [];
  }),

  prayer: t.procedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const { data } = await supabaseAdmin
        .from("prayers")
        .select("*, religions(name,icon_emoji)")
        .eq("id", input.id)
        .single();
      return data;
    }),

  submitPrayer: t.procedure
    .input(
      z.object({
        title: z.string().min(3).max(200),
        body: z.string().min(20).max(5000),
        religion_id: z.string().uuid().optional(),
        source: z.string().optional(),
        user_id: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { data, error } = await supabaseAdmin
        .from("community_submissions")
        .insert({ ...input, status: "pending" })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }),
});

export type AppRouter = typeof appRouter;
