import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Animated,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../lib/ThemeContext";
import { useLanguage, APP_LANGUAGES } from "../lib/LanguageContext";
import { getReligionColor, getReligionIcon, getReligionTint } from "../theme";
import { PrayerAPI } from "../lib/api";
import ThemeToggle from "../components/ThemeToggle";

// Returns greeting text based on hour
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// Deterministic daily prayer picker — changes by morning/afternoon/evening period
function pickTodaysPrayer(prayers: any[]): any | null {
  if (!prayers.length) return null;
  const now = new Date();
  const h = now.getHours();
  const period = h < 12 ? 0 : h < 18 ? 1 : 2;
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  return prayers[(dayOfYear * 3 + period) % prayers.length];
}

const AURORA_COLORS = [
  "rgba(226,85,61,0.10)",
  "rgba(92,75,150,0.12)",
  "rgba(30,138,127,0.10)",
  "rgba(224,160,46,0.11)",
  "rgba(226,85,61,0.10)",
];

// ── Small icon helpers ────────────────────────────────────────────────────────

function GlobeIcon({ color }: { color: string }) {
  return (
    <Text style={{ fontSize: 13, color, lineHeight: 15, includeFontPadding: false }}>
      ⟡
    </Text>
  );
}

function ChevronDown({ color, open }: { color: string; open: boolean }) {
  return (
    <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
      <View style={{
        width: 0, height: 0,
        borderLeftWidth: 4, borderRightWidth: 4, borderTopWidth: 5,
        borderLeftColor: "transparent", borderRightColor: "transparent",
        borderTopColor: color,
      }} />
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }: any) {
  const { C } = useTheme();
  const { appLanguage, setAppLanguage, translatePrayers, isTranslating } = useLanguage();

  // Raw English data — source of truth for translation
  const rawPrayersRef  = useRef<any[]>([]);
  const rawFeaturedRef = useRef<any>(null);

  // Display state (possibly translated)
  const [prayers,  setPrayers]  = useState<any[]>([]);
  const [featured, setFeatured] = useState<any>(null);
  const [religions,  setReligions]  = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [activeRel,  setActiveRel]  = useState("");
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Language dropdown
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [langMenuY,    setLangMenuY]    = useState(0);
  const langBtnRef = useRef<View>(null);

  const greeting = getGreeting();

  // Aurora animation for featured card
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

  // ── Translation helper ──────────────────────────────────────────────────────
  // Translates rawList + optional rawFeat in one batch, then updates state.
  // Pass rawFeat=undefined to leave featured unchanged.
  const applyTranslation = useCallback(
    async (rawList: any[], rawFeat?: any) => {
      if (appLanguage === "English") {
        setPrayers(rawList);
        if (rawFeat !== undefined) setFeatured(rawFeat);
        return;
      }
      try {
        // Deduplicate so we don't translate featured twice if it's also in rawList
        const combined = rawFeat != null
          ? Array.from(new Map([...rawList, rawFeat].map((p) => [p.id, p])).values())
          : rawList;
        const translated = await translatePrayers(combined);
        const map = new Map(translated.map((p: any) => [p.id, p]));
        setPrayers(rawList.map((p) => map.get(p.id) ?? p));
        if (rawFeat !== undefined) {
          setFeatured(rawFeat != null ? (map.get(rawFeat.id) ?? rawFeat) : null);
        }
      } catch {
        setPrayers(rawList);
        if (rawFeat !== undefined) setFeatured(rawFeat);
      }
    },
    [appLanguage, translatePrayers],
  );

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([PrayerAPI.getReligions(), PrayerAPI.list({ limit: 50 })])
      .then(([relRes, prayRes]) => {
        setReligions(relRes.data.data || []);
        const raw: any[] = prayRes.data.data || [];
        rawPrayersRef.current = raw;
        const feat = pickTodaysPrayer(raw);
        rawFeaturedRef.current = feat;
        setHasMore(raw.length === 50);
        applyTranslation(raw, feat);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Retranslate when language changes ───────────────────────────────────────
  useEffect(() => {
    if (!rawPrayersRef.current.length) return;
    applyTranslation(rawPrayersRef.current, rawFeaturedRef.current);
  }, [applyTranslation]);

  // ── Pagination ──────────────────────────────────────────────────────────────
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
      const rawNew: any[] = res.data.data || [];
      rawPrayersRef.current = [...rawPrayersRef.current, ...rawNew];
      const displayNew =
        appLanguage !== "English" ? await translatePrayers(rawNew) : rawNew;
      setPrayers((prev) => [...prev, ...displayNew]);
      setPage(nextPage);
      setHasMore(rawNew.length === 50);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  };

  // ── Religion filter ─────────────────────────────────────────────────────────
  const filterByReligion = async (religionId: string) => {
    const next = activeRel === religionId ? "" : religionId;
    setActiveRel(next);
    setLoading(true);
    try {
      const res = await PrayerAPI.list({ religion_id: next || undefined, limit: 50 });
      const raw: any[] = res.data.data || [];
      rawPrayersRef.current = raw;
      setPage(1);
      setHasMore(raw.length === 50);
      await applyTranslation(raw);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ── Language selector ───────────────────────────────────────────────────────
  const openLangMenu = () => {
    langBtnRef.current?.measureInWindow((_x: number, y: number, _w: number, h: number) => {
      setLangMenuY(y + h + 8);
      setLangMenuOpen(true);
    });
  };

  const relName  = (item: any) => item.religions?.name ?? "";
  const listPrayers = prayers.filter((p) => p.id !== featured?.id);

  const renderItem = ({ item }: { item: any }) => {
    const name  = relName(item);
    const color = getReligionColor(name);
    const tint  = getReligionTint(name);
    const icon  = getReligionIcon(name);
    // Navigate with English original so PrayerDetailScreen translates fresh
    const orig  = rawPrayersRef.current.find((p) => p.id === item.id) ?? item;
    return (
      <TouchableOpacity
        style={s.card}
        activeOpacity={0.75}
        onPress={() => navigation.navigate("PrayerDetail", { prayer: orig })}
      >
        <View style={[s.iconBox, { backgroundColor: tint }]}>
          <Text style={[s.iconText, { color }]}>{icon}</Text>
        </View>
        <View style={s.cardBody}>
          <Text style={[s.cardRel, { color }]}>{name}</Text>
          <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={s.cardExcerpt} numberOfLines={1}>{item.body}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const s = useMemo(() => makeStyles(C), [C]);
  const currLang = APP_LANGUAGES.find((l) => l.code === appLanguage) ?? APP_LANGUAGES[0];
  const langActive = appLanguage !== "English";

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
            {/* ── Header ─────────────────────────────────────────────────── */}
            <View style={s.header}>
              <Text style={s.greeting}>{greeting}</Text>

              {/* "Today's" sits in a row with the controls at its baseline */}
              <View style={s.headingRow}>
                <Text style={s.heading}>Today's</Text>
                <View style={s.headerControls}>
                  {/* Language pill */}
                  <TouchableOpacity
                    ref={langBtnRef}
                    style={[s.langPill, langActive && { backgroundColor: C.accent + "22", borderColor: C.accent }]}
                    onPress={openLangMenu}
                    activeOpacity={0.75}
                  >
                    <GlobeIcon color={langActive ? C.accent : C.text3} />
                    <Text style={[s.langPillTxt, langActive && { color: C.accent }]}>
                      {currLang.short}
                    </Text>
                    <ChevronDown color={langActive ? C.accent : C.text3} open={langMenuOpen} />
                  </TouchableOpacity>
                  <ThemeToggle />
                </View>
              </View>

              <Text style={s.heading}>prayers</Text>

              {/* Translating indicator */}
              {isTranslating && (
                <Text style={[s.translatingHint, { color: C.text3 }]}>Translating…</Text>
              )}
            </View>

            {/* Language dropdown modal */}
            <Modal
              visible={langMenuOpen}
              transparent
              animationType="fade"
              onRequestClose={() => setLangMenuOpen(false)}
            >
              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={1}
                onPress={() => setLangMenuOpen(false)}
              >
                <View
                  style={[s.langMenu, { top: langMenuY, backgroundColor: C.surface, borderColor: C.line, shadowColor: C.shadow }]}
                  onStartShouldSetResponder={() => true}
                >
                  {APP_LANGUAGES.map((lang) => {
                    const sel = appLanguage === lang.code;
                    return (
                      <TouchableOpacity
                        key={lang.code}
                        style={[s.langOption, sel && { backgroundColor: C.accent + "18" }]}
                        onPress={() => {
                          setLangMenuOpen(false);
                          setAppLanguage(lang.code);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={s.langOptionLeft}>
                          <Text style={[s.langDot, { color: sel ? C.accent : C.text3 }]}>⟡</Text>
                          <Text style={[s.langOptionTxt, { color: sel ? C.accent : C.text }]}>
                            {lang.code}
                          </Text>
                        </View>
                        {sel && <Text style={[s.langCheck, { color: C.accent }]}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </TouchableOpacity>
            </Modal>

            {/* ── Featured "Today's Prayer" card ──────────────────────────── */}
            {featured && (
              <TouchableOpacity
                activeOpacity={0.8}
                style={s.featured}
                onPress={() => navigation.navigate("PrayerDetail", { prayer: rawFeaturedRef.current ?? featured })}
              >
                <Animated.View style={[s.auroraOverlay, { backgroundColor: auroraColor }]} />
                <View style={s.featuredInner}>
                  <View style={s.featMeta}>
                    <View style={[s.featDot, { backgroundColor: getReligionColor(relName(featured)) }]} />
                    <Text style={s.featLabel}>
                      Prayer of the moment · {relName(featured)}
                    </Text>
                  </View>
                  <Text style={s.featTitle} numberOfLines={2}>{featured.title}</Text>
                  <Text style={s.featExcerpt} numberOfLines={3}>"{featured.body}"</Text>
                  <View style={s.featFooter}>
                    {featured.source ? (
                      <Text style={s.featSource} numberOfLines={1}>{featured.source}</Text>
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

            {/* ── Religion filter chips ────────────────────────────────────── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chips}
              style={{ marginTop: 22, marginBottom: 6 }}
            >
              {religions.map((r) => {
                const isOn = activeRel === r.id;
                const col  = getReligionColor(r.name);
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[s.chip, isOn && { backgroundColor: col + "22", borderColor: col }]}
                    onPress={() => filterByReligion(r.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.chipIcon}>{getReligionIcon(r.name)}</Text>
                    <Text style={[s.chipText, isOn && { color: col, fontFamily: "HankenGrotesk_700Bold" }]}>
                      {r.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* ── Section label ────────────────────────────────────────────── */}
            <Text style={s.sectionLabel}>
              {langActive ? `${appLanguage} prayers` : "The collection"}
            </Text>

            {loading && (
              <ActivityIndicator color={C.accent} style={{ marginTop: 40, marginBottom: 20 }} />
            )}
          </>
        }
        renderItem={renderItem}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={C.accent} style={{ margin: 24 }} /> : null
        }
        ListEmptyComponent={
          !loading ? <Text style={s.empty}>No prayers found.</Text> : null
        }
      />
    </SafeAreaView>
  );
}

function makeStyles(C: ReturnType<typeof import("../lib/ThemeContext").useTheme>["C"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },

    header: { paddingHorizontal: 22, paddingTop: 16, marginBottom: 22 },

    // "Today's" and the controls are in one row; alignItems:"flex-end" puts the
    // controls at the bottom of "Today's" text — visually between "Today's" and "prayers"
    headingRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    },
    headerControls: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingBottom: 4, // slight nudge to sit closer to the baseline of "Today's"
    },

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
    translatingHint: {
      fontFamily: "HankenGrotesk_500Medium",
      fontSize: 11,
      marginTop: 4,
      letterSpacing: 0.3,
    },

    // Language pill
    langPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      height: 30,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: C.surface2,
      borderWidth: 1,
      borderColor: C.line,
    },
    langPillTxt: {
      fontFamily: "HankenGrotesk_700Bold",
      fontSize: 11,
      letterSpacing: 0.2,
      color: C.text3,
    },

    // Language dropdown panel (inside Modal)
    langMenu: {
      position: "absolute",
      right: 22,
      width: 210,
      borderWidth: 1,
      borderRadius: 16,
      padding: 7,
      elevation: 24,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 1,
      shadowRadius: 20,
      maxHeight: 420,
    },
    langOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: 10,
    },
    langOptionLeft: { flexDirection: "row", alignItems: "center", gap: 9 },
    langDot:        { fontSize: 13, lineHeight: 16, includeFontPadding: false },
    langOptionTxt:  { fontFamily: "HankenGrotesk_600SemiBold", fontSize: 14 },
    langCheck:      { fontFamily: "HankenGrotesk_700Bold", fontSize: 14 },

    // Featured card
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
    auroraOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    featuredInner: { padding: 22 },
    featMeta:  { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 16 },
    featDot:   { width: 9, height: 9, borderRadius: 5 },
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
    featFooter:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    featSource:  { fontFamily: "HankenGrotesk_600SemiBold", fontSize: 12, color: C.text3, flex: 1, marginRight: 12 },
    readBtn:     { backgroundColor: C.accent, paddingVertical: 9, paddingHorizontal: 15, borderRadius: 999 },
    readBtnTxt:  { fontFamily: "HankenGrotesk_700Bold", fontSize: 13, color: C.onacc },

    // Religion chips
    chips: { paddingHorizontal: 22, gap: 8, flexDirection: "row", alignItems: "center" },
    chip: {
      flexDirection: "row", alignItems: "center", gap: 6,
      borderWidth: 1, borderColor: C.line, borderRadius: 999,
      paddingVertical: 7, paddingHorizontal: 12,
      backgroundColor: C.surface,
    },
    chipIcon: { fontSize: 13 },
    chipText: { fontFamily: "HankenGrotesk_500Medium", fontSize: 12, color: C.text2 },

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

    // Prayer list cards
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
      width: 42, height: 42, borderRadius: 13,
      alignItems: "center", justifyContent: "center",
      flexShrink: 0, overflow: "hidden",
    },
    iconText: { fontSize: 17, includeFontPadding: false, textAlignVertical: "center", textAlign: "center" },
    cardBody:    { flex: 1, minWidth: 0 },
    cardRel:     { fontFamily: "HankenGrotesk_700Bold", fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 },
    cardTitle:   { fontFamily: "InstrumentSerif_400Regular", fontSize: 23, lineHeight: 25, color: C.text, marginBottom: 3 },
    cardExcerpt: { fontFamily: "Newsreader_400Regular_Italic", fontSize: 16.5, lineHeight: 22, color: C.text2 },

    empty: { textAlign: "center", color: C.text3, marginTop: 60, fontSize: 16, fontFamily: "Newsreader_400Regular_Italic" },
  });
}
