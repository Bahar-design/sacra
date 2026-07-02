import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";

// This is required for OAuth to work — it completes the auth
// session when the browser redirects back to the app
WebBrowser.maybeCompleteAuthSession();

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

//Email Auth

export const signUp = (email: string, password: string) =>
  supabase.auth.signUp({ email, password });

export const signIn = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

export const signOut = () => supabase.auth.signOut();

export const getUser = () => supabase.auth.getUser();

export const getSession = () => supabase.auth.getSession();

//Prayer Collections

export const savePrayer = (userId: string, prayerId: string) =>
  supabase
    .from("saved_prayers")
    .upsert({ user_id: userId, prayer_id: prayerId }, { onConflict: "user_id,prayer_id" });

export const unsavePrayer = (userId: string, prayerId: string) =>
  supabase
    .from("saved_prayers")
    .delete()
    .eq("user_id", userId)
    .eq("prayer_id", prayerId);

export const getSaved = (userId: string) =>
  supabase
    .from("saved_prayers")
    .select("prayer_id, prayers(*, religions(name, icon_emoji))")
    .eq("user_id", userId);

//Listen History

export const logListenHistory = (
  userId: string,
  prayerId: string,
  transcription: string,
  similarity: number,
) =>
  supabase.from("listen_history").insert({
    user_id: userId,
    prayer_id: prayerId,
    transcription,
    similarity,
  });
