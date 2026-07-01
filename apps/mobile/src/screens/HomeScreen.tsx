import { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../lib/ThemeContext";
import { getReligionColor, getReligionIcon, getReligionTint } from "../theme";
import { PrayerAPI } from "../lib/api";

// Returns greeting + period index (0=morning,1=afternoon,2=evening)
function getGreetingInfo(): { greeting: string; period: number } {
  const h = new Date().getHours();
  if (h < 12) return { greeting: "Good morning", period: 0 };
  if (h < 18) return { greeting: "Good afternoon", period: 1 };
  return { greeting: "Good evening", period: 2 };
}

// Deterministic daily prayer picker — changes by morning/afternoon/evening
function pickTodaysPrayer(prayers: any[]): any | null {
  if (!prayers.length) return null;
  const now = new Date();
  const { period } = getGreetingInfo();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  const seed = dayOfYear * 3 + period;
  return prayers[seed % prayers.length];
}

// Overlay colors that cycle on the featured card
const AURORA_COLORS = [
  "rgba(226,85,61,0.10)",
  "rgba(92,75,150,0.12)",
  "rgba(30,138,127,0.10)",
  "rgba(224,160,46,0.11)",
  "rgba(226,85,61,0.10)",
];

export default function HomeScreen({ navigation }: any) {
  const { C } = useTheme();
  const [prayers, setPrayers] = useState<any[]>([]);
  const [allPrayers, setAllPrayers] = useState<any[]>([]); // full unfiltered set — used for Today's Prayer
  const [religions, setReligions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRel, setActiveRel] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const { greeting } = getGreetingInfo();

  // Animated color cycling for featured card aurora overlay
  const colorAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(colorAnim, {
        toValue: AURORA_COLORS.length - 1,
        duration: (AURORA_COLORS.length - 1) * 4000,
        useNativeDriver: false,
      }),
    ).start();
  }, []);

  const auroraColor = colorAnim.interpolate({
    inputRange: AURORA_COLORS.map((_, i) => i),
    outputRange: AURORA_COLORS,
  });

  useEffect(() => {
    Promise.all([PrayerAPI.getReligions(), PrayerAPI.list({ limit: 50 })])
      .then(([relRes, prayRes]) => {
        setReligions(relRes.data.data || []);
        const data = prayRes.data.data || [];
        setAllPrayers(data); // store full list once — never overwritten by filter
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

  const filterByReligion = async (religionId: string) => {
    const next = activeRel === religionId ? "" : religionId;
    setActiveRel(next);
    setLoading(true);
    try {
      const res = await PrayerAPI.list({ religion_id: next || undefined, limit: 50 });
      setPrayers(res.data.data || []);
      setPage(1);
      setHasMore((res.data.data || []).length === 50);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Use the full unfiltered set so Today's Prayer never changes when religion filter is tapped
  const featured = pickTodaysPrayer(allPrayers);
  const listPrayers = prayers.filter((p) => p.id !== featured?.id);
  const relName = (item: any) => item.religions?.name ?? "";

  const renderItem = ({ item }: { item: any }) => {
    const name = relName(item);
    const color = getReligionColor(name);
    const tint = getReligionTint(name);
    const icon = getReligionIcon(name);
    return (
      <TouchableOpacity
        style={s.card}
        activeOpacity={0.75}
        onPress={() => navigation.navigate("PrayerDetail", { prayer: item })}
      >
        <View style={[s.iconBox, { backgroundColor: tint }]}>
          <Text style={[s.iconText, { color }]}>{icon}</Text>
        </View>
        <View style={s.cardBody}>
          <View style={s.cardMeta}>
            <Text style={[s.cardRel, { color }]}>{name}</Text>
            {item.language ? (
              <Text style={s.cardLang}>· {item.language}</Text>
            ) : null}
          </View>
          <Text style={s.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={s.cardExcerpt} numberOfLines={1}>
            {item.body}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const s = useMemo(() => makeStyles(C), [C]);

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <FlatList
        data={listPrayers}
        keyExtractor={(i) => i.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={s.header}>
              <Text style={s.greeting}>{greeting}</Text>
              <Text style={s.heading}>Today's prayers</Text>
            </View>

            {/* Featured "Today's Prayer" card */}
            {featured && (
              <TouchableOpacity
                activeOpacity={0.8}
                style={s.featured}
                onPress={() =>
                  navigation.navigate("PrayerDetail", { prayer: featured })
                }
              >
                {/* Color-cycling aurora overlay */}
                <Animated.View
                  style={[s.auroraOverlay, { backgroundColor: auroraColor }]}
                />
                <View style={s.featuredInner}>
                  <View style={s.featMeta}>
                    <View
                      style={[
                        s.featDot,
                        { backgroundColor: getReligionColor(relName(featured)) },
                      ]}
                    />
                    <Text style={s.featLabel}>
                      Today's prayer · {relName(featured)}
                    </Text>
                  </View>
                  <Text style={s.featTitle} numberOfLines={2}>
                    {featured.title}
                  </Text>
                  <Text style={s.featExcerpt} numberOfLines={3}>
                    "{featured.body}"
                  </Text>
                  <View style={s.featFooter}>
                    {featured.source ? (
                      <Text style={s.featSource} numberOfLines={1}>
                        {featured.source}
                      </Text>
                    ) : (
                      <View />
                    )}
                    <View style={s.readBtn}>
                      <Text style={s.readBtnTxt}>Read →</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {/* Religion filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chips}
              style={{ marginTop: 22, marginBottom: 6 }}
            >
              {religions.map((r) => {
                const isOn = activeRel === r.id;
                const col = getReligionColor(r.name);
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[
                      s.chip,
                      isOn && {
                        backgroundColor: col + "22",
                        borderColor: col,
                      },
                    ]}
                    onPress={() => filterByReligion(r.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.chipIcon}>{getReligionIcon(r.name)}</Text>
                    <Text
                      style={[
                        s.chipText,
                        isOn && {
                          color: col,
                          fontFamily: "HankenGrotesk_700Bold",
                        },
                      ]}
                    >
                      {r.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Section label */}
            <Text style={s.sectionLabel}>The collection</Text>

            {loading && (
              <ActivityIndicator
                color={C.accent}
                style={{ marginTop: 40, marginBottom: 20 }}
              />
            )}
          </>
        }
        renderItem={renderItem}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={C.accent} style={{ margin: 24 }} />
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={s.empty}>No prayers found.</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function makeStyles(C: ReturnType<typeof import("../lib/ThemeContext").useTheme>["C"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },

    header: { paddingHorizontal: 22, paddingTop: 16, marginBottom: 22 },
    greeting: {
      fontFamily: "HankenGrotesk_700Bold",
      fontSize: 12,
      letterSpacing: 0.4,
      color: C.accent,
      marginBottom: 6,
      textTransform: "uppercase",
    },
    heading: {
      fontFamily: "InstrumentSerif_400Regular",
      fontSize: 42,
      lineHeight: 40,
      color: C.text,
      letterSpacing: -0.5,
    },

    featured: {
      marginHorizontal: 22,
      borderRadius: 26,
      backgroundColor: C.surface,
      shadowColor: C.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 1,
      shadowRadius: 24,
      elevation: 6,
      overflow: "hidden",
    },
    auroraOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    featuredInner: { padding: 22 },
    featMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      marginBottom: 16,
    },
    featDot: { width: 9, height: 9, borderRadius: 5 },
    featLabel: {
      fontFamily: "HankenGrotesk_700Bold",
      fontSize: 11,
      letterSpacing: 1.4,
      textTransform: "uppercase",
      color: C.text2,
    },
    featTitle: {
      fontFamily: "InstrumentSerif_400Regular",
      fontSize: 34,
      lineHeight: 36,
      color: C.text,
      marginBottom: 12,
    },
    featExcerpt: {
      fontFamily: "Newsreader_400Regular_Italic",
      fontSize: 20,
      lineHeight: 29,
      color: C.text2,
      marginBottom: 20,
    },
    featFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    featSource: {
      fontFamily: "HankenGrotesk_600SemiBold",
      fontSize: 12,
      color: C.text3,
      flex: 1,
      marginRight: 12,
    },
    readBtn: {
      backgroundColor: C.accent,
      paddingVertical: 9,
      paddingHorizontal: 15,
      borderRadius: 999,
    },
    readBtnTxt: { fontFamily: "HankenGrotesk_700Bold", fontSize: 13, color: C.onacc },

    chips: {
      paddingHorizontal: 22,
      gap: 8,
      flexDirection: "row",
      alignItems: "center",
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: C.line,
      borderRadius: 999,
      paddingVertical: 7,
      paddingHorizontal: 12,
      backgroundColor: C.surface,
    },
    chipIcon: { fontSize: 13 },
    chipText: {
      fontFamily: "HankenGrotesk_500Medium",
      fontSize: 12,
      color: C.text2,
    },

    sectionLabel: {
      fontFamily: "HankenGrotesk_700Bold",
      fontSize: 12,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: C.text3,
      marginHorizontal: 22,
      marginTop: 24,
      marginBottom: 6,
    },

    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 22,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: C.hair,
    },
    iconBox: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    iconText: { fontSize: 19 },
    cardBody: { flex: 1, minWidth: 0 },
    cardMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      marginBottom: 3,
    },
    cardRel: {
      fontFamily: "HankenGrotesk_700Bold",
      fontSize: 10.5,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    cardLang: {
      fontFamily: "HankenGrotesk_500Medium",
      fontSize: 10.5,
      color: C.text3,
    },
    cardTitle: {
      fontFamily: "InstrumentSerif_400Regular",
      fontSize: 23,
      lineHeight: 25,
      color: C.text,
      marginBottom: 3,
    },
    cardExcerpt: {
      fontFamily: "Newsreader_400Regular_Italic",
      fontSize: 16.5,
      lineHeight: 22,
      color: C.text2,
    },

    empty: {
      textAlign: "center",
      color: C.text3,
      marginTop: 60,
      fontSize: 16,
      fontFamily: "Newsreader_400Regular_Italic",
    },
  });
}
