import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../theme";
import { PrayerAPI } from "../lib/api";
import { savePrayer, unsavePrayer, getUser } from "../lib/supabase";
import {
  saveToDevice,
  removeFromDevice,
  isPrayerSaved,
} from "../lib/offlineStorage";
import { trackSaved, trackCrossFaithViewed } from "../lib/analytics";

export default function PrayerDetailScreen({ route, navigation }: any) {
  const { prayer } = route.params;
  const [similar, setSimilar] = useState<any[]>([]);
  const [loadSim, setLoadSim] = useState(true);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setSaved(isPrayerSaved(prayer.id)); // instant local check first
    getUser().then(({ data }) => setUserId(data.user?.id || null));
    PrayerAPI.getSimilar(prayer.id)
      .then((res) => {
        const sim = res.data.similar || [];
        setSimilar(sim);
        if (sim.length > 0)
          trackCrossFaithViewed(
            prayer.religions?.name || "",
            sim[0].religion_id,
          );
      })
      .catch(() => setSimilar([]))
      .finally(() => setLoadSim(false));
  }, [prayer.id]);

  const handleSave = async () => {
    if (saved) {
      removeFromDevice(prayer.id);
      if (userId) await unsavePrayer(userId, prayer.id);
      setSaved(false);
    } else {
      saveToDevice(prayer);
      if (userId) await savePrayer(userId, prayer.id);
      setSaved(true);
      trackSaved(prayer.id, prayer.religions?.name || "");
    }
  };

  const handleShare = () =>
    Share.share({
      message: `${prayer.title}\n\n${prayer.body}\n\n— ${prayer.source || "SACRA"}`,
      title: prayer.title,
    });

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
          <Text style={s.backTxt}>← Return</Text>
        </TouchableOpacity>

        <View style={s.badge}>
          <Text style={s.religion}>
            {prayer.religions?.icon_emoji} {prayer.religions?.name || ""}
          </Text>
          {prayer.tradition ? (
            <Text style={s.tradition}>{prayer.tradition}</Text>
          ) : null}
        </View>

        <Text style={s.title}>{prayer.title}</Text>

        <View style={s.divider}>
          <View style={s.dLine} />
          <Text style={s.dDia}>◆</Text>
          <View style={s.dLine} />
        </View>

        <Text style={s.body}>{prayer.body}</Text>
        {prayer.source ? <Text style={s.source}>— {prayer.source}</Text> : null}

        <View style={s.actions}>
          <TouchableOpacity
            style={[s.act, saved && s.actOn]}
            onPress={handleSave}
          >
            <Text style={[s.actTxt, saved && s.actTxtOn]}>
              {saved ? "◆ Saved" : "◇ Save"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.act} onPress={handleShare}>
            <Text style={s.actTxt}>↗ Share</Text>
          </TouchableOpacity>
        </View>

        <View style={s.section}>
          <Text style={s.secLbl}>PRAYERS LIKE THIS FROM OTHER TRADITIONS</Text>
          <Text style={s.secSub}>
            Sacred texts share themes of devotion, surrender, and grace across
            all faiths
          </Text>
          {loadSim ? (
            <ActivityIndicator
              color={theme.colors.gold}
              style={{ marginTop: 20 }}
            />
          ) : similar.length === 0 ? (
            <Text style={s.none}>
              No cross-faith matches found for this prayer.
            </Text>
          ) : (
            similar.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={s.simCard}
                onPress={() => navigation.push("PrayerDetail", { prayer: p })}
              >
                <Text style={s.simRel}>{p.religion_id}</Text>
                <Text style={s.simTitle}>{p.title}</Text>
                <Text style={s.simBody} numberOfLines={2}>
                  {p.body}
                </Text>
                <Text style={s.simPct}>
                  {(p.similarity * 100).toFixed(0)}% thematic similarity
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.ink },
  back: { padding: 20, paddingBottom: 0 },
  backTxt: { fontSize: 12, color: theme.colors.gold, letterSpacing: 1 },
  badge: {
    marginHorizontal: 20,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  religion: {
    fontSize: 11,
    color: theme.colors.gold,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  tradition: { fontSize: 10, color: theme.colors.dust, fontStyle: "italic" },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: theme.colors.parchment,
    margin: 20,
    marginBottom: 16,
    lineHeight: 36,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  dLine: { flex: 1, height: 1, backgroundColor: theme.colors.goldBorder },
  dDia: { fontSize: 10, color: theme.colors.gold },
  body: {
    fontSize: 16,
    color: theme.colors.parchmentDim,
    lineHeight: 28,
    margin: 20,
    marginTop: 0,
    fontStyle: "italic",
  },
  source: {
    fontSize: 12,
    color: theme.colors.dust,
    margin: 20,
    marginTop: 0,
    letterSpacing: 1,
  },
  actions: { flexDirection: "row", gap: 12, margin: 20, marginTop: 8 },
  act: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.goldBorder,
    padding: 12,
    alignItems: "center",
  },
  actOn: {
    backgroundColor: theme.colors.goldDim,
    borderColor: theme.colors.gold,
  },
  actTxt: {
    fontSize: 12,
    color: theme.colors.parchmentDim,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  actTxtOn: { color: theme.colors.gold },
  section: { margin: 20, marginTop: 4 },
  secLbl: {
    fontSize: 9,
    letterSpacing: 3,
    color: theme.colors.gold,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  secSub: {
    fontSize: 13,
    color: theme.colors.dust,
    fontStyle: "italic",
    marginBottom: 20,
    lineHeight: 19,
  },
  none: { fontSize: 13, color: theme.colors.dust, fontStyle: "italic" },
  simCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.goldBorder,
    padding: 14,
    marginBottom: 10,
  },
  simRel: {
    fontSize: 9,
    color: theme.colors.gold,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  simTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.parchment,
    marginBottom: 4,
  },
  simBody: {
    fontSize: 12,
    color: theme.colors.parchmentDim,
    fontStyle: "italic",
    lineHeight: 18,
    marginBottom: 6,
  },
  simPct: { fontSize: 10, color: theme.colors.ember },
});
