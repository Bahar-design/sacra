// apps/mobile/src/screens/HomeScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../theme";
import { PrayerAPI } from "../lib/api";

const RELIGION_ICONS: Record<string, string> = {
  Christianity: "✝",
  Islam: "☪",
  Judaism: "✡",
  Hinduism: "🕉",
  Buddhism: "☸",
  Sikhism: "☬",
  Bahai: "✷",
  Zoroastrianism: "𓄂𓆃",
  Jainism: "🪬",
  Taoism: "☯",
  Shinto: "⛩",
  "Indigenous / Animist": "𖦏",
};

export default function HomeScreen({ navigation }: any) {
  const [prayers, setPrayers] = useState<any[]>([]);
  const [religions, setReligions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRel, setActiveRel] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    Promise.all([PrayerAPI.getReligions(), PrayerAPI.list({ limit: 50 })])
      .then(([relRes, prayRes]) => {
        setReligions(relRes.data.data || []);
        const data = prayRes.data.data || [];
        setPrayers(data);
        setHasMore(data.length === 50);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await PrayerAPI.list({
        religion_id: activeRel || undefined,
        limit: 50,
        page: nextPage,
      });
      const data = res.data.data || [];
      setPrayers((prev) => [...prev, ...data]);
      setPage(nextPage);
      setHasMore(data.length === 50);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  };

  const filterByReligion = async (religionId: string, name: string) => {
    const next = activeRel === religionId ? "" : religionId;
    setActiveRel(next);
    setLoading(true);
    try {
      const res = await PrayerAPI.list({
        religion_id: next || undefined,
        limit: 20,
      });
      setPrayers(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.eyebrow}>SACRA</Text>
        <Text style={s.heading}>Discover</Text>
        <Text style={s.sub}>Sacred texts from every faith on earth</Text>
      </View>

      {/* Religion filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chips}
        style={s.chipsScroll}
      >
        {religions.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={[s.chip, activeRel === r.id && s.chipOn]}
            onPress={() => filterByReligion(r.id, r.name)}
          >
            <Text style={s.chipIcon}>{RELIGION_ICONS[r.name] || "◆"}</Text>
            <Text style={[s.chipText, activeRel === r.id && s.chipTextOn]}>
              {r.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Gold ornament divider */}
      <View style={s.divider}>
        <View style={s.divLine} />
        <Text style={s.divDia}>◆</Text>
        <View style={s.divLine} />
      </View>

      {loading ? (
        <ActivityIndicator
          color={theme.colors.gold}
          style={{ marginTop: 40 }}
        />
      ) : (
        <FlatList
          data={prayers}
          keyExtractor={(i) => i.id}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                color={theme.colors.gold}
                style={{ margin: 20 }}
              />
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.card}
              onPress={() =>
                navigation.navigate("PrayerDetail", { prayer: item })
              }
            >
              <View style={s.cardTop}>
                <Text style={s.cardRel}>
                  {RELIGION_ICONS[item.religions?.name] || "◆"}{" "}
                  {item.religions?.name}
                </Text>
                {item.tradition ? (
                  <Text style={s.cardTrad}>{item.tradition}</Text>
                ) : null}
              </View>
              <Text style={s.cardTitle}>{item.title}</Text>
              <Text style={s.cardBody} numberOfLines={3}>
                {item.body}
              </Text>
              {item.source ? (
                <Text style={s.cardSource}>— {item.source}</Text>
              ) : null}
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={s.empty}>No prayers found.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.ink },
  header: { padding: 20, paddingBottom: 12 },
  eyebrow: {
    fontFamily: "System",
    fontSize: 9,
    letterSpacing: 4,
    color: theme.colors.gold,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  heading: {
    fontSize: 36,
    fontWeight: "900",
    color: theme.colors.parchment,
    marginBottom: 4,
  },
  sub: { fontSize: 13, color: theme.colors.dust, fontStyle: "italic" },
  chipsScroll: { maxHeight: 48, marginBottom: 4 },
  chips: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: theme.colors.goldBorder,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  chipOn: {
    backgroundColor: theme.colors.goldDim,
    borderColor: theme.colors.gold,
  },
  chipIcon: { fontSize: 12 },
  chipText: {
    fontSize: 10,
    color: theme.colors.parchmentDim,
    fontFamily: "System",
    letterSpacing: 0.5,
  },
  chipTextOn: { color: theme.colors.gold },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginVertical: 14,
    gap: 10,
  },
  divLine: { flex: 1, height: 1, backgroundColor: theme.colors.goldBorder },
  divDia: { fontSize: 10, color: theme.colors.gold },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.goldBorder,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  cardRel: {
    fontSize: 9,
    color: theme.colors.gold,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  cardTrad: { fontSize: 9, color: theme.colors.dust, fontStyle: "italic" },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.parchment,
    marginBottom: 6,
  },
  cardBody: {
    fontSize: 13,
    color: theme.colors.parchmentDim,
    lineHeight: 19,
    fontStyle: "italic",
    marginBottom: 6,
  },
  cardSource: { fontSize: 10, color: theme.colors.dust, letterSpacing: 1 },
  empty: {
    textAlign: "center",
    color: theme.colors.dust,
    marginTop: 60,
    fontSize: 14,
    fontStyle: "italic",
  },
});
