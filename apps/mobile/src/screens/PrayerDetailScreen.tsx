import { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Alert,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../lib/ThemeContext";
import { getReligionColor, getReligionIcon, getReligionTint } from "../theme";
import { PrayerAPI } from "../lib/api";
import { savePrayer, unsavePrayer, getSession } from "../lib/supabase";
import { saveToDevice, removeFromDevice, isPrayerSaved } from "../lib/offlineStorage";
import { trackSaved, trackCrossFaithViewed } from "../lib/analytics";

const { width: SCREEN_W } = Dimensions.get("window");

// Parse "Bahaullah -- Prayer for Purity of Heart" → "Bahaullah"
function authorOnly(source: string): string {
  const em = source.indexOf(' — ');
  if (em > 0) return source.slice(0, em).trim();
  const dash = source.indexOf(' -- ');
  if (dash > 0) return source.slice(0, dash).trim();
  return source;
}
// Constellation layout constants
const CONST_H   = 300;
const CONST_CX  = (SCREEN_W - 44) / 2; // center x within 22px horizontal padding
const CONST_CY  = CONST_H / 2;
const ORBIT_R   = 105; // radius for satellite nodes
const NODE_R    = 27;  // satellite radius (54px diameter / 2)
const CENTER_R  = 42;  // center orb radius (84px / 2)

// Satellite node: single prayer bubble with animated float
function ConstellationNode({
  item,
  angle,
  delay,
  onPress,
  C,
}: {
  item: any;
  angle: number;
  delay: number;
  onPress: () => void;
  C: any;
}) {
  const name  = item.religion_name ?? item.religions?.name ?? "";
  const color = getReligionColor(name);
  const icon  = getReligionIcon(name);
  const pct   = item.similarity != null ? Math.round(item.similarity * 100) : 0;

  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(floatAnim, { toValue: -8, duration: 2200, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 8,  duration: 2200, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0,  duration: 2200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const x = CONST_CX + Math.cos(angle) * ORBIT_R;
  const y = CONST_CY + Math.sin(angle) * ORBIT_R;

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: x - NODE_R - 12,  // extra width for label
        top:  y - NODE_R - 20,  // extra height for labels below
        width: (NODE_R + 12) * 2,
        alignItems: "center",
        transform: [{ translateY: floatAnim }],
      }}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={{ alignItems: "center" }}>
        <View style={{
          width: NODE_R * 2,
          height: NODE_R * 2,
          borderRadius: NODE_R,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: color,
          backgroundColor: C.surface,
          shadowColor: C.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 1,
          shadowRadius: 10,
          elevation: 4,
        }}>
          <Text style={{ fontSize: 22, includeFontPadding: false, textAlignVertical: "center" }}>
            {icon}
          </Text>
        </View>
        <Text style={{
          fontFamily: "HankenGrotesk_600SemiBold",
          fontSize: 8,
          color: C.text2,
          marginTop: 5,
          textAlign: "center",
          lineHeight: 11,
        }} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={{
          fontFamily: "HankenGrotesk_700Bold",
          fontSize: 8,
          color,
          textAlign: "center",
        }}>
          {pct > 0 ? `${pct}%` : ""}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Constellation diagram: center prayer + orbiting similar prayers
function ConstellationDiagram({
  prayer,
  similar,
  onNodePress,
  C,
}: {
  prayer: any;
  similar: any[];
  onNodePress: (item: any) => void;
  C: any;
}) {
  const relName  = prayer.religions?.name ?? "";
  const relIcon  = getReligionIcon(relName);
  const pingAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pingAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(pingAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  const count  = similar.length;
  const angles = Array.from({ length: count }, (_, i) =>
    -Math.PI / 2 + (2 * Math.PI / count) * i,
  );

  const pingOpacity = pingAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.3, 0.05, 0] });
  const pingScale   = pingAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });

  return (
    <View style={{ height: CONST_H, position: "relative" }}>
      {/* Satellite nodes */}
      {similar.map((item, i) => (
        <ConstellationNode
          key={item.id}
          item={item}
          angle={angles[i]}
          delay={i * 400}
          onPress={() => onNodePress(item)}
          C={C}
        />
      ))}

      {/* Center orb — the current prayer's religion */}
      <View style={{
        position: "absolute",
        left: CONST_CX - CENTER_R,
        top:  CONST_CY - CENTER_R,
        width: CENTER_R * 2,
        height: CENTER_R * 2,
        borderRadius: CENTER_R,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: C.accent,
        shadowColor: C.accent,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 8,
        zIndex: 3,
      }}>
        <Text style={{ fontSize: 30, color: C.onacc, includeFontPadding: false }}>
          {relIcon}
        </Text>

        {/* Ping ring */}
        <Animated.View style={{
          position: "absolute",
          width: (CENTER_R + 8) * 2,
          height: (CENTER_R + 8) * 2,
          borderRadius: CENTER_R + 8,
          borderWidth: 1.5,
          borderColor: C.accent,
          opacity: pingOpacity,
          transform: [{ scale: pingScale }],
        }} />
      </View>
    </View>
  );
}

export default function PrayerDetailScreen({ route, navigation }: any) {
  const { C } = useTheme();
  const { prayer } = route.params;
  const [similar, setSimilar]   = useState<any[]>([]);
  const [loadSim, setLoadSim]   = useState(true);
  const [saved, setSaved]       = useState(false);
  const [userId, setUserId]     = useState<string | null>(null);

  useEffect(() => {
    getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      if (uid) setSaved(isPrayerSaved(prayer.id, uid));
    });
    PrayerAPI.getSimilar(prayer.id)
      .then((res) => {
        const raw: any[] = res.data.similar || [];
        const sorted = [...raw].sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
        setSimilar(sorted);
        if (sorted.length > 0) trackCrossFaithViewed({ prayer_id: prayer.id });
      })
      .catch(console.error)
      .finally(() => setLoadSim(false));
  }, [prayer.id]);

  const handleSave = async () => {
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
    try {
      if (next) {
        saveToDevice(prayer, userId);
        await savePrayer(userId, prayer.id);
        trackSaved({ prayer_id: prayer.id, religion: relName });
      } else {
        removeFromDevice(prayer.id, userId);
        await unsavePrayer(userId, prayer.id);
      }
    } catch {
      setSaved(!next);
    }
  };

  const handleShare = async () => {
    const attr = prayer.source ? `\n\n— ${prayer.source}` : "";
    await Share.share({
      message: `${prayer.title}\n\n${prayer.body}${attr}\n\nDiscovered with SACRA`,
    });
  };

  const relName  = prayer.religions?.name ?? "";
  const relColor = getReligionColor(relName);
  const relIcon  = getReligionIcon(relName);
  const relTint  = getReligionTint(relName);

  const s = useMemo(() => makeStyles(C), [C]);

  const navigateToSimilar = (item: any) => {
    const name = item.religion_name ?? item.religions?.name ?? "";
    navigation.push("PrayerDetail", { prayer: { ...item, religions: { name } } });
  };

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
          <Text style={[s.relPillText, { color: relColor }]}>{relIcon}  {relName}</Text>
        </View>

        {/* Title */}
        <Text style={s.title}>{prayer.title}</Text>

        {/* Meta chips */}
        {prayer.tradition && (
          <View style={s.metaRow}>
            <Text style={s.metaChip}>{prayer.tradition}</Text>
          </View>
        )}

        <View style={s.divider} />

        {/* Prayer body */}
        <Text style={s.body}>{prayer.body}</Text>

        {/* Attribution — author only, strip "Author -- Prayer Title" suffix */}
        {prayer.source && (
          <Text style={s.attribution}>— {authorOnly(prayer.source)}</Text>
        )}

        {/* Action buttons */}
        <View style={s.actions}>
          <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={s.saveBtnTxt}>
              {userId
                ? saved ? "♥  Saved" : "♡  Save to sanctuary"
                : "♡  Sign in to save"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.75}>
            <Text style={s.shareBtnTxt}>↗</Text>
          </TouchableOpacity>
        </View>

        {/* ── Echoes across faiths ──────────────────────────────────────── */}
        <View style={s.crossFaithSection}>
          <Text style={s.crossFaithTitle}>Echoes across faiths</Text>
          <Text style={s.crossFaithSub}>
            The same longing, spoken in other tongues.
          </Text>

          {loadSim && <ActivityIndicator color={C.accent} style={{ marginTop: 20 }} />}

          {!loadSim && similar.length === 0 && (
            <Text style={s.crossFaithEmpty}>No cross-faith matches found.</Text>
          )}

          {!loadSim && similar.length > 0 && (
            <>
              {/* Constellation diagram */}
              <ConstellationDiagram
                prayer={prayer}
                similar={similar}
                onNodePress={navigateToSimilar}
                C={C}
              />

              {/* List below diagram */}
              {similar.map((item) => {
                const name  = item.religion_name ?? item.religions?.name ?? "";
                const color = getReligionColor(name);
                const pct   = item.similarity != null ? Math.round(item.similarity * 100) : 0;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={s.faithRow}
                    activeOpacity={0.75}
                    onPress={() => navigateToSimilar(item)}
                  >
                    <View style={[s.faithDot, { backgroundColor: color }]} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.faithTitle} numberOfLines={2}>{item.title}</Text>
                      <Text style={[s.faithRel, { color }]}>{name}</Text>
                    </View>
                    {pct > 0 && (
                      <Text style={s.faithSim}>{pct}%</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </>
          )}
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
      width: 42, height: 42,
      borderRadius: 999,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.line,
      alignItems: "center",
      justifyContent: "center",
    },
    circleBtnTxt: { fontSize: 17, color: C.text2 },

    scroll: { paddingBottom: 120, paddingHorizontal: 22 },

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

    divider: { height: 1, backgroundColor: C.line, marginBottom: 26 },

    body: {
      fontFamily: "Newsreader_400Regular",
      fontSize: 22,
      lineHeight: 36,
      color: C.text,
      letterSpacing: 0.1,
      marginBottom: 16,
    },

    attribution: {
      fontFamily: "Newsreader_400Regular_Italic",
      fontSize: 15,
      color: C.text3,
      marginBottom: 32,
      marginTop: 4,
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
      width: 50, height: 50,
      borderRadius: 14,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.line,
      alignItems: "center",
      justifyContent: "center",
    },
    shareBtnTxt: { fontSize: 19, color: C.text2 },

    // Echoes across faiths
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
      marginBottom: 14,
    },
    crossFaithEmpty: {
      fontFamily: "Newsreader_400Regular_Italic",
      fontSize: 16,
      color: C.text3,
      marginTop: 10,
    },

    // List rows below constellation
    faithRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingVertical: 15,
      borderTopWidth: 1,
      borderTopColor: C.hair,
    },
    faithDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
    faithTitle: {
      fontFamily: "InstrumentSerif_400Regular",
      fontSize: 19,
      lineHeight: 22,
      color: C.text,
    },
    faithRel: {
      fontFamily: "HankenGrotesk_700Bold",
      fontSize: 10,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginTop: 2,
    },
    faithSim: {
      fontFamily: "HankenGrotesk_700Bold",
      fontSize: 12,
      color: C.text3,
      flexShrink: 0,
    },
  });
}
