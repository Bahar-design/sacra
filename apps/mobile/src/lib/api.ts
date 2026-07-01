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
};
