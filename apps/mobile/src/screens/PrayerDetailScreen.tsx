import { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../lib/ThemeContext";
import { getReligionColor, getReligionIcon, getReligionTint } from "../theme";
import { PrayerAPI } from "../lib/api";
import { savePrayer, unsavePrayer, getUser } from "../lib/supabase";
import { saveToDevice, removeFromDevice, isPrayerSaved } from "../lib/offlineStorage";
import { trackSaved, trackCrossFaithViewed } from "../lib/analytics";

export default function PrayerDetailScreen({ route, navigation }: any) {
  const { C } = useTheme();
  const { prayer } = route.params;
  const [similar, setSimilar] = useState<any[]>([]);
  const [loadSim, setLoadSim] = useState(true);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setSaved(isPrayerSaved(prayer.id));
    getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    PrayerAPI.getSimilar(prayer.id)
      .then((res) => {
        setSimilar(res.data.similar || []);
        if ((res.data.similar || []).length > 0) {
          trackCrossFaithViewed({ prayer_id: prayer.id });
        }
      })
      .catch(console.error)
      .finally(() => setLoadSim(false));
  }, [prayer.id]);

  const handleSave = async () => {
    // Block guests from saving
    if (!userId) {
      Alert.alert(
        "Sign in to save",
        "Create a free account to save prayers to your sanctuary.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Sign in", onPress: () => navigation.navigate("Sacred") },
        ],
      );
      return;
    }

    const next = !saved;
    setSaved(next);
    if (next) {
      saveToDevice(prayer);
      await savePrayer(userId, prayer.id);
      trackSaved({ prayer_id: prayer.id, religion: relName });
    } else {
      removeFromDevice(prayer.id);
      await unsavePrayer(userId, prayer.id);
    }
  };

  const handleShare = async () => {
    await Share.share({ message: `${prayer.title}\n\n${prayer.body}\n\n— Discovered with SACRA` });
  };

  const relName   = prayer.religions?.name ?? "";
  const relColor  = getReligionColor(relName);
  const relIcon   = getReligionIcon(relName);
  const relTint   = getReligionTint(relName);

  const s = useMemo(() => makeStyles(C), [C]);

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      {/* Sticky header */}
      <View style={s.stickyHeader}>
        <TouchableOpacity style={s.circleBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={s.circleBtnTxt}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.circleBtn, saved && { backgroundColor: relColor + "22", borderColor: relColor }]}
          onPress={handleSave}
          activeOpacity={0.7}
        >
          <Text style={[s.circleBtnTxt, saved && { color: relColor }]}>
            {saved ? "♥" : "♡"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Religion pill */}
        <View style={[s.relPill, { backgroundColor: relTint, borderColor: relColor + "55" }]}>
          <Text style={[s.relPillText, { color: relColor }]}>{relIcon} {relName}</Text>
        </View>

        {/* Title */}
        <Text style={s.title}>{prayer.title}</Text>

        {/* Meta chips */}
        {(prayer.source || prayer.language || prayer.tradition) && (
          <View style={s.metaRow}>
            {prayer.language  && <Text style={s.metaChip}>{prayer.language}</Text>}
            {prayer.tradition && <Text style={s.metaChip}>{prayer.tradition}</Text>}
            {prayer.source    && <Text style={s.metaSource} numberOfLines={1}>{prayer.source}</Text>}
          </View>
        )}

        <View style={s.divider} />

        {/* Prayer body */}
        <Text style={s.body}>{prayer.body}</Text>

        {/* Actions */}
        <View style={s.actions}>
          <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={s.saveBtnTxt}>
              {userId
                ? saved ? "♥ Saved" : "♡ Save to sanctuary"
                : "♡ Sign in to save"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.75}>
            <Text style={s.shareBtnTxt}>↗</Text>
          </TouchableOpacity>
        </View>

        {/* Cross-faith section */}
        <View style={s.crossFaithSection}>
          <Text style={s.crossFaithTitle}>Echoes across faiths</Text>
          <Text style={s.crossFaithSub}>
            This prayer resonates with similar words from other traditions.
          </Text>

          {loadSim && <ActivityIndicator color={C.accent} style={{ marginTop: 20 }} />}
          {!loadSim && similar.length === 0 && (
            <Text style={s.crossFaithEmpty}>No cross-faith matches found.</Text>
          )}

          {similar.map((item) => {
            const name  = item.religion_name ?? item.religions?.name ?? "";
            const color = getReligionColor(name);
            const icon  = getReligionIcon(name) || item.religion_icon || "";
            return (
              <TouchableOpacity
                key={item.id}
                style={s.faithNode}
                activeOpacity={0.75}
                onPress={() => navigation.push("PrayerDetail", { prayer: { ...item, religions: { name } } })}
              >
                <View style={[s.faithNodeBar, { backgroundColor: color }]} />
                <View style={s.faithNodeBody}>
                  <View style={s.faithNodeMeta}>
                    <Text style={[s.faithNodeRel, { color }]}>{icon} {name}</Text>
                    {item.similarity != null && (
                      <Text style={s.faithNodeSim}>{(item.similarity * 100).toFixed(0)}% match</Text>
                    )}
                  </View>
                  <Text style={s.faithNodeTitle}>{item.title}</Text>
                  <Text style={s.faithNodeExcerpt} numberOfLines={2}>{item.body}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: ReturnType<typeof import("../lib/ThemeContext").useTheme>["C"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },

    stickyHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    circleBtn: {
      width: 42,
      height: 42,
      borderRadius: 999,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.line,
      alignItems: "center",
      justifyContent: "center",
    },
    circleBtnTxt: { fontSize: 17, color: C.text2 },

    scroll: { paddingBottom: 110, paddingHorizontal: 22 },

    relPill: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 999,
      borderWidth: 1,
      paddingVertical: 6,
      paddingHorizontal: 13,
      marginBottom: 16,
    },
    relPillText: { fontFamily: "HankenGrotesk_700Bold", fontSize: 12, letterSpacing: 0.5 },

    title: {
      fontFamily: "InstrumentSerif_400Regular",
      fontSize: 46,
      lineHeight: 48,
      color: C.text,
      letterSpacing: -0.5,
      marginBottom: 16,
    },

    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 20 },
    metaChip: {
      fontFamily: "HankenGrotesk_600SemiBold",
      fontSize: 11,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: C.text3,
      backgroundColor: C.surface2,
      borderRadius: 999,
      paddingVertical: 5,
      paddingHorizontal: 10,
    },
    metaSource: { fontFamily: "Newsreader_400Regular_Italic", fontSize: 14, color: C.text3, flex: 1 },

    divider: { height: 1, backgroundColor: C.line, marginBottom: 26 },

    body: {
      fontFamily: "Newsreader_400Regular",
      fontSize: 22,
      lineHeight: 36,
      color: C.text,
      letterSpacing: 0.1,
      marginBottom: 32,
    },

    actions: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 40 },
    saveBtn: {
      flex: 1,
      backgroundColor: C.accent,
      paddingVertical: 15,
      borderRadius: 999,
      alignItems: "center",
      shadowColor: C.accent,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 6,
    },
    saveBtnTxt: { fontFamily: "HankenGrotesk_700Bold", fontSize: 15, color: C.onacc },
    shareBtn: {
      width: 50,
      height: 50,
      borderRadius: 14,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.line,
      alignItems: "center",
      justifyContent: "center",
    },
    shareBtnTxt: { fontSize: 19, color: C.text2 },

    crossFaithSection: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 28 },
    crossFaithTitle: {
      fontFamily: "InstrumentSerif_400Regular",
      fontSize: 30,
      lineHeight: 30,
      color: C.text,
      marginBottom: 8,
    },
    crossFaithSub: {
      fontFamily: "Newsreader_400Regular_Italic",
      fontSize: 17,
      lineHeight: 25,
      color: C.text2,
      marginBottom: 22,
    },
    crossFaithEmpty: { fontFamily: "Newsreader_400Regular_Italic", fontSize: 16, color: C.text3, marginTop: 10 },

    faithNode: {
      flexDirection: "row",
      backgroundColor: C.surface,
      borderRadius: 18,
      overflow: "hidden",
      marginBottom: 12,
      shadowColor: C.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 12,
      elevation: 3,
    },
    faithNodeBar: { width: 5, flexShrink: 0 },
    faithNodeBody: { flex: 1, padding: 16 },
    faithNodeMeta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    faithNodeRel: { fontFamily: "HankenGrotesk_700Bold", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
    faithNodeSim: { fontFamily: "HankenGrotesk_500Medium", fontSize: 11, color: C.text3 },
    faithNodeTitle: {
      fontFamily: "InstrumentSerif_400Regular",
      fontSize: 22,
      lineHeight: 24,
      color: C.text,
      marginBottom: 6,
    },
    faithNodeExcerpt: {
      fontFamily: "Newsreader_400Regular_Italic",
      fontSize: 15,
      lineHeight: 22,
      color: C.text2,
    },
  });
}
