import PostHog from "posthog-react-native";

export const posthog = new PostHog(process.env.EXPO_PUBLIC_POSTHOG_KEY!, {
  host: "https://app.posthog.com",
});

// Each function tracks a meaningful product event
// These become your demo talking points in interviews
export const trackListen = (p: {
  matched: boolean;
  similarity?: number;
  religion?: string;
}) => posthog.capture("prayer_listened", p);
export const trackSearch = (query: string, resultCount: number) =>
  posthog.capture("prayer_searched", { query, result_count: resultCount });
export const trackSaved = (prayerId: string, religion: string) =>
  posthog.capture("prayer_saved", { prayer_id: prayerId, religion });
export const trackCrossFaithViewed = (
  fromReligion: string,
  toReligion: string,
) =>
  posthog.capture("cross_faith_viewed", { from: fromReligion, to: toReligion });
export const trackCommunitySubmitted = () =>
  posthog.capture("community_prayer_submitted");
