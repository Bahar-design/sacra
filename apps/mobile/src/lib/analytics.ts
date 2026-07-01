import PostHog from "posthog-react-native";

export const posthog = new PostHog(process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "", {
  host: "https://app.posthog.com",
});

export const trackListen = (p: {
  matched: boolean;
  similarity?: number;
  religion?: string;
}) => posthog.capture("prayer_listened", p);

export const trackSearch = (p: {
  query: string;
  mood?: string;
  occasion?: string;
  resultCount: number;
}) =>
  posthog.capture("prayer_searched", {
    query: p.query,
    ...(p.mood !== undefined && { mood: p.mood }),
    ...(p.occasion !== undefined && { occasion: p.occasion }),
    result_count: p.resultCount,
  });

export const trackSaved = (p: { prayer_id: string; religion?: string }) =>
  posthog.capture("prayer_saved", p);

export const trackCrossFaithViewed = (p: { prayer_id: string }) =>
  posthog.capture("cross_faith_viewed", p);

export const trackCommunitySubmitted = (p: {
  title: string;
  religion?: string;
}) => posthog.capture("community_prayer_submitted", p);
