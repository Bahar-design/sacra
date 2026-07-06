import {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PrayerAPI } from "./api";

// All languages GPT-4o-mini translates near-perfectly.
// English = default (no translation).
export const APP_LANGUAGES = [
  { code: "English",    short: "EN" },
  { code: "Spanish",    short: "ES" },
  { code: "French",     short: "FR" },
  { code: "German",     short: "DE" },
  { code: "Italian",    short: "IT" },
  { code: "Portuguese", short: "PT" },
  { code: "Russian",    short: "RU" },
  { code: "Arabic",     short: "AR" },
  { code: "Hebrew",     short: "HE" },
  { code: "Hindi",      short: "HI" },
  { code: "Urdu",       short: "UR" },
  { code: "Farsi",      short: "FA" },
  { code: "Turkish",    short: "TR" },
  { code: "Japanese",   short: "JA" },
  { code: "Chinese",    short: "ZH" },
  { code: "Korean",     short: "KO" },
  { code: "Bengali",    short: "BN" },
  { code: "Indonesian", short: "ID" },
  { code: "Swahili",    short: "SW" },
  { code: "Greek",      short: "EL" },
] as const;

// Module-level cache persists across navigation; survives re-renders.
// Map<language, Map<originalText, translatedText>>
const _cache = new Map<string, Map<string, string>>();

// ── Persistent cache (AsyncStorage) ──────────────────────────────────────────
// Titles are cached between sessions so language switches are instant on re-open.
const CACHE_KEY = "sacra_tx_v2";

// Load saved translations into memory on app start (non-blocking)
(async () => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const saved: Record<string, Record<string, string>> = JSON.parse(raw);
    for (const [lang, entries] of Object.entries(saved)) {
      const existing = _cache.get(lang) ?? new Map<string, string>();
      for (const [k, v] of Object.entries(entries)) existing.set(k, v);
      _cache.set(lang, existing);
    }
  } catch {}
})();

// Write current in-memory cache back to AsyncStorage (fire-and-forget)
function persistCache() {
  const obj: Record<string, Record<string, string>> = {};
  for (const [lang, map] of _cache.entries()) {
    obj[lang] = Object.fromEntries(map);
  }
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify(obj)).catch(() => {});
}

type TranslateOpts = {
  // When true, only translates the `title` field — skips `body`.
  // Use this for list views; translate body fully only in detail screens.
  titleOnly?: boolean;
};

type LanguageContextValue = {
  appLanguage: string;
  setAppLanguage: (lang: string) => void;
  // Translates title (+ optionally body) of each prayer.
  // Returns a new array with translated fields; uses cache to avoid re-fetching.
  translatePrayers: (prayers: any[], opts?: TranslateOpts) => Promise<any[]>;
  isTranslating: boolean;
};

const LanguageContext = createContext<LanguageContextValue>({
  appLanguage: "English",
  setAppLanguage: () => {},
  translatePrayers: async (p) => p,
  isTranslating: false,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [appLanguage, setAppLanguage] = useState("English");
  const [isTranslating, setIsTranslating] = useState(false);

  const translatePrayers = useCallback(
    async (prayers: any[], opts?: TranslateOpts): Promise<any[]> => {
      if (!prayers.length || appLanguage === "English") return prayers;

      const titleOnly = opts?.titleOnly ?? false;
      const langCache = _cache.get(appLanguage) ?? new Map<string, string>();
      _cache.set(appLanguage, langCache);

      // Collect unique texts not yet in cache
      const uncached = new Set<string>();
      for (const p of prayers) {
        if (p.title && !langCache.has(p.title)) uncached.add(p.title);
        if (!titleOnly && p.body && !langCache.has(p.body)) uncached.add(p.body);
      }

      if (uncached.size > 0) {
        setIsTranslating(true);
        try {
          const texts = Array.from(uncached);
          // Parallel chunks of 25 — all chunks run simultaneously
          const CHUNK = 25;
          const chunks: string[][] = [];
          for (let i = 0; i < texts.length; i += CHUNK) {
            chunks.push(texts.slice(i, i + CHUNK));
          }
          const results = await Promise.all(
            chunks.map((chunk) => PrayerAPI.translate(chunk, appLanguage)),
          );
          results.forEach((res, ci) =>
            res.translations.forEach((t: string, i: number) =>
              langCache.set(chunks[ci][i], t),
            ),
          );
          // Persist newly cached titles for instant future sessions
          persistCache();
        } catch {
          // Return originals on error; user can retry by switching language
        } finally {
          setIsTranslating(false);
        }
      }

      return prayers.map((p) => ({
        ...p,
        title: langCache.get(p.title) ?? p.title,
        ...(titleOnly ? {} : { body: langCache.get(p.body) ?? p.body }),
      }));
    },
    [appLanguage],
  );

  return (
    <LanguageContext.Provider
      value={{ appLanguage, setAppLanguage, translatePrayers, isTranslating }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
