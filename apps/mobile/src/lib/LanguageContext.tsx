import {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
} from "react";
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
  { code: "Persian",    short: "FA" },
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

type LanguageContextValue = {
  appLanguage: string;
  setAppLanguage: (lang: string) => void;
  // Translates title + body of each prayer. Returns a new array with
  // translated fields. Uses cache — only uncached texts hit the API.
  translatePrayers: (prayers: any[]) => Promise<any[]>;
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
    async (prayers: any[]): Promise<any[]> => {
      if (!prayers.length || appLanguage === "English") return prayers;

      const langCache = _cache.get(appLanguage) ?? new Map<string, string>();
      _cache.set(appLanguage, langCache);

      // Collect unique texts not yet in cache
      const uncached = new Set<string>();
      for (const p of prayers) {
        if (p.title && !langCache.has(p.title)) uncached.add(p.title);
        if (p.body   && !langCache.has(p.body))  uncached.add(p.body);
      }

      if (uncached.size > 0) {
        setIsTranslating(true);
        try {
          const texts = Array.from(uncached);
          const res = await PrayerAPI.translate(texts, appLanguage);
          res.translations.forEach((t: string, i: number) =>
            langCache.set(texts[i], t),
          );
        } catch {
          // Return originals if translation fails
        } finally {
          setIsTranslating(false);
        }
      }

      return prayers.map((p) => ({
        ...p,
        title: langCache.get(p.title) ?? p.title,
        body:  langCache.get(p.body)  ?? p.body,
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
