import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
export const signUp = (e: string, p: string) =>
  supabase.auth.signUp({ email: e, password: p });
export const signIn = (e: string, p: string) =>
  supabase.auth.signInWithPassword({ email: e, password: p });
export const signOut = () => supabase.auth.signOut();
export const getUser = () => supabase.auth.getUser();
export const savePrayer = (uid: string, pid: string) =>
  supabase.from("saved_prayers").insert({ user_id: uid, prayer_id: pid });
export const unsavePrayer = (uid: string, pid: string) =>
  supabase
    .from("saved_prayers")
    .delete()
    .eq("user_id", uid)
    .eq("prayer_id", pid);
export const getSaved = (uid: string) =>
  supabase
    .from("saved_prayers")
    .select("prayer_id, prayers(*)")
    .eq("user_id", uid);
