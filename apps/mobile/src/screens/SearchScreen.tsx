import { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../lib/ThemeContext";
import { getReligionColor, getReligionIcon, getReligionTint } from "../theme";
import { PrayerAPI, getReligionsMap } from "../lib/api";
import { trackSearch } from "../lib/analytics";

const INTENTS = [
  { label: "Gratitude", icon: "✦" },
  { label: "Healing",   icon: "◎" },
  { label: "Guidance",  icon: "⊕" },
  { label: "Peace",     icon: "◆" },
  { label: "Forgiveness", icon: "∗" },
  { label: "Strength",  icon: "↑" },
  { label: "Morning",   icon: "◐" },
  { label: "Evening",   icon: "◑" },
];

const MOODS = ["Hopeful", "Sorrowful", "Contemplative", "Joyful", "Fearful", "Grateful"];
const OCCASIONS = ["Daily", "Sabbath", "Fasting", "Funeral", "Wedding", "Birth", "New Year"];

export default function SearchScreen({ navigation }: any) {
  const { C } = useTheme();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [mood, setMood] = useState("");
  const [occasion, setOccasion] = useState("");
  const [religionsMap, setReligionsMap] = useState<Record<string, string>>({});

  useEffect(() => {
    getReligionsMap().then(setReligionsMap).catch(console.error);
  }, []);

  const doSearch = async (q = query) => {
    if (!q.trim() && !mood && !occasion) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await PrayerAPI.search({ query: q, mood: mood || undefined, occasion: occasion || undefined, limit: 20 });
      setResults(res.data.results || []);
      trackSearch({ query: q, mood, occasion, resultCount: (res.data.results || []).length });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleIntent = (label: string) => {
    setQuery(label);
    doSearch(label);
  };

  const relName = (item: any) =>
    item.religions?.name ?? religionsMap[item.religion_id] ?? "";

  const renderResult = ({ item }: { item: any }) => {
    const name = relName(item);
    const color = getReligionColor(name);
    const tint  = getReligionTint(name);
    const icon  = getReligionIcon(name);
    return (
      <TouchableOpacity
        style={s.card}
        activeOpacity={0.75}
        onPress={() =>
          navigation.navigate("PrayerDetail", {
            prayer: { ...item, religions: { name } },
          })
        }
      >
        <View style={[s.iconBox, { backgroundColor: tint }]}>
          <Text style={[s.iconText, { color }]}>{icon}</Text>
        </View>
        <View style={s.cardBody}>
          <View style={s.cardMeta}>
            <Text style={[s.cardRel, { color }]}>{name}</Text>
            {item.language ? <Text style={s.cardLang}> · {item.language}</Text> : null}
          </View>
          <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={s.cardExcerpt} numberOfLines={1}>{item.body}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const s = useMemo(() => makeStyles(C), [C]);

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <FlatList
        data={results}
        keyExtractor={(i) => i.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <View style={s.header}>
              <Text style={s.eyebrow}>Search</Text>
              <Text style={s.heading}>Seek a feeling</Text>
            </View>

            <View style={s.inputWrap}>
              <Text style={s.searchIcon}>⊙</Text>
              <TextInput
                style={s.input}
                placeholder="A prayer for healing, peace…"
                placeholderTextColor={C.text3}
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                onSubmitEditing={() => doSearch()}
                selectionColor={C.accent}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => { setQuery(""); setResults([]); setHasSearched(false); }}>
                  <Text style={s.clearBtn}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {!hasSearched && (
              <>
                <Text style={s.sectionLabel}>Try a feeling</Text>
                <View style={s.intentGrid}>
                  {INTENTS.map((intent) => (
                    <TouchableOpacity
                      key={intent.label}
                      style={s.intentChip}
                      onPress={() => handleIntent(intent.label)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.intentIcon, { color: C.accent }]}>{intent.icon}</Text>
                      <Text style={s.intentLabel}>{intent.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.sectionLabel}>Mood</Text>
                <View style={s.filterRow}>
                  {MOODS.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[s.filterChip, mood === m && { backgroundColor: C.accent + "18", borderColor: C.accent }]}
                      onPress={() => setMood(mood === m ? "" : m)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.filterChipText, mood === m && { color: C.accent, fontFamily: "HankenGrotesk_700Bold" }]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.sectionLabel}>Occasion</Text>
                <View style={s.filterRow}>
                  {OCCASIONS.map((o) => (
                    <TouchableOpacity
                      key={o}
                      style={[s.filterChip, occasion === o && { backgroundColor: C.accent + "18", borderColor: C.accent }]}
                      onPress={() => setOccasion(occasion === o ? "" : o)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.filterChipText, occasion === o && { color: C.accent, fontFamily: "HankenGrotesk_700Bold" }]}>
                        {o}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {(mood || occasion) && (
                  <TouchableOpacity style={s.searchBtn} onPress={() => doSearch()} activeOpacity={0.85}>
                    <Text style={s.searchBtnTxt}>Search →</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {loading && <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />}
            {hasSearched && !loading && results.length > 0 && (
              <Text style={s.sectionLabel}>{results.length} prayers found</Text>
            )}
          </>
        }
        renderItem={renderResult}
        ListEmptyComponent={
          hasSearched && !loading ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No prayers found</Text>
              <Text style={s.emptySub}>Try different words or remove filters</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function makeStyles(C: ReturnType<typeof import("../lib/ThemeContext").useTheme>["C"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },

    header: { paddingHorizontal: 22, paddingTop: 16, marginBottom: 20 },
    eyebrow: {
      fontFamily: "HankenGrotesk_700Bold",
      fontSize: 12,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: C.text3,
      marginBottom: 6,
    },
    heading: {
      fontFamily: "InstrumentSerif_400Regular",
      fontSize: 42,
      lineHeight: 40,
      color: C.text,
      letterSpacing: -0.5,
    },

    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginHorizontal: 22,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.line,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 13,
      marginBottom: 22,
    },
    searchIcon: { fontSize: 16, color: C.text3 },
    input: {
      flex: 1,
      fontFamily: "Newsreader_400Regular_Italic",
      fontSize: 19,
      color: C.text,
      padding: 0,
    },
    clearBtn: { fontSize: 13, color: C.text3, paddingHorizontal: 4 },

    sectionLabel: {
      fontFamily: "HankenGrotesk_700Bold",
      fontSize: 11,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: C.text3,
      marginHorizontal: 22,
      marginBottom: 12,
      marginTop: 8,
    },

    intentGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 9,
      paddingHorizontal: 22,
      marginBottom: 22,
    },
    intentChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.line,
      borderRadius: 999,
      paddingVertical: 9,
      paddingHorizontal: 14,
    },
    intentIcon: { fontSize: 12 },
    intentLabel: { fontFamily: "HankenGrotesk_600SemiBold", fontSize: 14, color: C.text2 },

    filterRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      paddingHorizontal: 22,
      marginBottom: 14,
    },
    filterChip: {
      borderWidth: 1,
      borderColor: C.line,
      borderRadius: 999,
      paddingVertical: 7,
      paddingHorizontal: 12,
      backgroundColor: C.surface,
    },
    filterChipText: { fontFamily: "HankenGrotesk_500Medium", fontSize: 13, color: C.text2 },

    searchBtn: {
      alignSelf: "center",
      backgroundColor: C.accent,
      paddingVertical: 14,
      paddingHorizontal: 28,
      borderRadius: 999,
      marginTop: 16,
      marginBottom: 22,
      shadowColor: C.accent,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.45,
      shadowRadius: 16,
      elevation: 6,
    },
    searchBtnTxt: { fontFamily: "HankenGrotesk_700Bold", fontSize: 15, color: C.onacc },

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
    cardMeta: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
    cardRel: {
      fontFamily: "HankenGrotesk_700Bold",
      fontSize: 10.5,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    cardLang: { fontFamily: "HankenGrotesk_500Medium", fontSize: 10.5, color: C.text3 },
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

    empty: { alignItems: "center", paddingTop: 50, paddingHorizontal: 40 },
    emptyTitle: {
      fontFamily: "InstrumentSerif_400Regular",
      fontSize: 28,
      color: C.text2,
      marginBottom: 8,
      textAlign: "center",
    },
    emptySub: {
      fontFamily: "Newsreader_400Regular_Italic",
      fontSize: 17,
      color: C.text3,
      textAlign: "center",
      lineHeight: 25,
    },
  });
}
