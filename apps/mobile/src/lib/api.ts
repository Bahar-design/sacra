import axios from "axios";

const BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001";
export const WS_BASE =
  process.env.EXPO_PUBLIC_API_WS_URL || "ws://localhost:3001";

// Module-level cache so we only fetch religions once per session
let _religionsCache: Record<string, string> | null = null;

export async function getReligionsMap(): Promise<Record<string, string>> {
  if (_religionsCache) return _religionsCache;
  const res = await PrayerAPI.getReligions();
  const map: Record<string, string> = {};
  (res.data.data || []).forEach((r: any) => {
    map[r.id] = r.name;
  });
  _religionsCache = map;
  return map;
}

export const api = axios.create({
  baseURL: BASE,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

export const PrayerAPI = {
  search: (params: {
    query?: string;
    mood?: string;
    occasion?: string;
    religion_id?: string;
    language?: string;
    limit?: number;
  }) => api.post("/api/search", params),

  list: (params?: {
    religion_id?: string;
    language?: string;
    occasion?: string;
    mood?: string;
    page?: number;
    limit?: number;
  }) => api.get("/api/prayers", { params }),

  getById: (id: string) => api.get(`/api/prayers/${id}`),
  getSimilar: (id: string) => api.get(`/api/prayers/${id}/similar`),
  getReligions: () => api.get("/api/prayers/religions/all"),
  getCosts: () => api.get("/api/dashboard/costs"),
  getStats: () => api.get("/api/dashboard/stats"),

  // Batch-translate texts to target_language via GPT-4o-mini.
  // Returns originals if target_language is "English" or the call fails.
  translate: async (texts: string[], target_language: string): Promise<{ translations: string[] }> => {
    const res = await api.post("/api/translate", { texts, target_language }, { timeout: 30000 });
    return res.data as { translations: string[] };
  },

  submitCommunity: (data: {
    title: string;
    body: string;
    religion?: string;
    source?: string;
  }) => api.post("/api/community/submit", data),

  listen: async (audioUri: string) => {
    const formData = new FormData();
    formData.append("audio", {
      uri: audioUri,
      type: "audio/m4a",
      name: "recording.m4a",
    } as any);
    return api.post("/api/listen", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000,
    });
  },

  // Transcribe a short audio chunk — Whisper only, no embedding/search.
  // Pass language (e.g. "arabic") after first chunk detection to stabilise subsequent chunks.
  // Returns the transcript text and the language Whisper detected.
  listenChunk: async (
    audioUri: string,
    language?: string,
  ): Promise<{ text: string; detectedLanguage: string | null }> => {
    const formData = new FormData();
    formData.append("audio", {
      uri: audioUri,
      type: "audio/m4a",
      name: "chunk.m4a",
    } as any);
    const url = language
      ? `/api/listen/transcribe?language=${encodeURIComponent(language)}`
      : "/api/listen/transcribe";
    const res = await api.post(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 30000,
    });
    return {
      text: res.data.text as string,
      detectedLanguage: (res.data.detectedLanguage as string | null) ?? null,
    };
  },
};
