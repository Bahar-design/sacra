import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../theme";
import { PrayerAPI } from "../lib/api";
import { trackSearch } from "../lib/analytics";

const INTENTS = [
  "a prayer for grief",
  "morning blessing",
  "prayer for peace",
  "gratitude and thanks",
  "healing and recovery",
  "prayer before a meal",
  "forgiveness and mercy",
  "guidance and wisdom",
];
const MOODS = [
  "peaceful",
  "reverent",
  "joyful",
  "repentant",
  "grateful",
  "meditative",
];
const OCCASIONS = [
  "morning",
  "evening",
  "daily",
  "grief",
  "celebration",
  "healing",
];

export default function SearchScreen({ navigation }: any) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [mood, setMood] = useState("");
  const [occ, setOcc] = useState("");

  const doSearch = async (q = query, m = mood, o = occ) => {
    if (!q.trim() && !m && !o) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await PrayerAPI.search(q || m || o, { limit: 20 });
      const r = res.data.results || [];
      setResults(r);
      trackSearch(q || m || o, r.length);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.eyebrow}>SACRA</Text>
        <Text style={s.heading}>Search</Text>
      </View>

      <View style={s.row}>
        <TextInput
          style={s.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search prayers, moods, occasions, meanings..."
          placeholderTextColor={theme.colors.parchmentMuted}
          onSubmitEditing={() => doSearch()}
          returnKeyType="search"
        />
        <TouchableOpacity style={s.btn} onPress={() => doSearch()}>
          <Text style={s.btnTxt}>⊕</Text>
        </TouchableOpacity>
      </View>

      {!searched && (
        <ScrollView>
          <Text style={s.lbl}>SEARCH BY INTENT</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.chips}>
              {INTENTS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={s.chip}
                  onPress={() => {
                    setQuery(c);
                    doSearch(c);
                  }}
                >
                  <Text style={s.chipTxt}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <Text style={[s.lbl, { marginTop: 20 }]}>FILTER BY MOOD</Text>
          <View style={s.chipWrap}>
            {MOODS.map((m2) => (
              <TouchableOpacity
                key={m2}
                style={[s.chip, mood === m2 && s.chipOn]}
                onPress={() => {
                  const n = mood === m2 ? "" : m2;
                  setMood(n);
                  doSearch(query, n, occ);
                }}
              >
                <Text style={[s.chipTxt, mood === m2 && s.chipTxtOn]}>
                  {m2}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[s.lbl, { marginTop: 16 }]}>FILTER BY OCCASION</Text>
          <View style={s.chipWrap}>
            {OCCASIONS.map((o2) => (
              <TouchableOpacity
                key={o2}
                style={[s.chip, occ === o2 && s.chipOn]}
                onPress={() => {
                  const n = occ === o2 ? "" : o2;
                  setOcc(n);
                  doSearch(query, mood, n);
                }}
              >
                <Text style={[s.chipTxt, occ === o2 && s.chipTxtOn]}>{o2}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {loading && (
        <ActivityIndicator
          color={theme.colors.gold}
          style={{ marginTop: 40 }}
        />
      )}

      <FlatList
        data={results}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() =>
              navigation.navigate("PrayerDetail", { prayer: item })
            }
          >
            <Text style={s.cTitle}>{item.title}</Text>
            <Text style={s.cBody} numberOfLines={3}>
              {item.body}
            </Text>
            <Text style={s.cSrc}>{item.source}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          searched && !loading ? (
            <Text style={s.empty}>No prayers found. Try different words.</Text>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.ink, padding: 20 },
  header: { marginBottom: 20 },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 4,
    color: theme.colors.gold,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  heading: { fontSize: 36, fontWeight: "900", color: theme.colors.parchment },
  row: { flexDirection: "row", gap: 8, marginBottom: 20 },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    color: theme.colors.parchment,
    borderWidth: 1,
    borderColor: theme.colors.goldBorder,
    padding: 12,
    fontSize: 14,
    fontStyle: "italic",
  },
  btn: {
    backgroundColor: theme.colors.gold,
    width: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  btnTxt: { fontSize: 20, color: theme.colors.ink },
  lbl: {
    fontSize: 8,
    letterSpacing: 3,
    color: theme.colors.dust,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  chips: { flexDirection: "row", gap: 8 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.goldBorder,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipOn: {
    backgroundColor: theme.colors.goldDim,
    borderColor: theme.colors.gold,
  },
  chipTxt: {
    fontSize: 11,
    color: theme.colors.parchmentDim,
    fontStyle: "italic",
  },
  chipTxtOn: { color: theme.colors.gold },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.goldBorder,
    padding: 16,
    marginBottom: 10,
  },
  cTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.parchment,
    marginBottom: 6,
  },
  cBody: {
    fontSize: 13,
    color: theme.colors.parchmentDim,
    lineHeight: 19,
    marginBottom: 6,
    fontStyle: "italic",
  },
  cSrc: { fontSize: 10, color: theme.colors.dust },
  empty: {
    textAlign: "center",
    color: theme.colors.dust,
    marginTop: 40,
    fontSize: 14,
    fontStyle: "italic",
  },
});
