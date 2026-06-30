import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { C, getReligionColor, getReligionIcon } from "../theme";
import { supabase } from "../lib/supabase";
import { getAllOfflinePrayers, removeFromDevice } from "../lib/offlineStorage";

export default function ProfileScreen({ navigation }: any) {
  const [saved, setSaved] = useState<any[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setSaved(getAllOfflinePrayers());
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          setUserEmail(user.email ?? null);
          setIsGuest(false);
        } else {
          setIsGuest(true);
        }
      });
    }, []),
  );

  const handleSignOut = () => {
    Alert.alert(
      "Sign out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: () => supabase.auth.signOut(),
        },
      ],
    );
  };

  const handleRemove = (id: string) => {
    removeFromDevice(id);
    setSaved((prev) => prev.filter((p) => p.id !== id));
  };

  const initials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : "GU";

  const renderSaved = ({ item }: { item: any }) => {
    // Offline prayers from SQLite have flat `religion` string, not nested `religions.name`
    const name = item.religion ?? item.religions?.name ?? "";
    const color = getReligionColor(name);
    const icon = getReligionIcon(name);
    return (
      <TouchableOpacity
        style={s.savedCard}
        activeOpacity={0.75}
        onPress={() => navigation.navigate("PrayerDetail", { prayer: item })}
      >
        <View style={[s.savedBar, { backgroundColor: color }]} />
        <View style={s.savedBody}>
          <View style={s.savedMeta}>
            <Text style={[s.savedRel, { color }]}>{icon} {name}</Text>
          </View>
          <Text style={s.savedTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={s.savedExcerpt} numberOfLines={1}>{item.body}</Text>
        </View>
        <TouchableOpacity
          style={s.removeBtn}
          onPress={() => handleRemove(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={s.removeBtnTxt}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <FlatList
        data={saved}
        keyExtractor={(i) => i.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        ListHeaderComponent={
          <>
            {/* Header eyebrow */}
            <View style={s.header}>
              <Text style={s.eyebrow}>Sacred</Text>
              <Text style={s.heading}>Your sanctuary</Text>
            </View>

            {/* Avatar + account */}
            <View style={s.accountRow}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{initials}</Text>
              </View>
              <View style={s.accountInfo}>
                <Text style={s.accountEmail} numberOfLines={1}>
                  {isGuest ? "Browsing as guest" : (userEmail ?? "")}
                </Text>
                <Text style={s.accountSub}>
                  {saved.length} prayer{saved.length !== 1 ? "s" : ""} saved offline
                </Text>
              </View>
              {!isGuest && (
                <TouchableOpacity
                  style={s.signOutBtn}
                  onPress={handleSignOut}
                  activeOpacity={0.7}
                >
                  <Text style={s.signOutTxt}>Sign out</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Stats */}
            <View style={s.statsRow}>
              <View style={s.statCard}>
                <Text style={s.statNum}>{saved.length}</Text>
                <Text style={s.statLabel}>Saved</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statNum}>
                  {[...new Set(saved.map((p) => p.religion ?? p.religions?.name).filter(Boolean))].length}
                </Text>
                <Text style={s.statLabel}>Traditions</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statNum}>
                  {[...new Set(saved.map((p) => p.language).filter(Boolean))].length || "—"}
                </Text>
                <Text style={s.statLabel}>Languages</Text>
              </View>
            </View>

            {/* Saved heading */}
            {saved.length > 0 && (
              <Text style={s.sectionLabel}>Kept close</Text>
            )}

            {saved.length === 0 && (
              <View style={s.emptySaved}>
                <Text style={s.emptyTitle}>Nothing saved yet</Text>
                <Text style={s.emptySub}>
                  Hold the heart on any prayer to keep it here, even offline.
                </Text>
              </View>
            )}
          </>
        }
        renderItem={renderSaved}
        ListFooterComponent={
          <TouchableOpacity
            style={s.contributeCta}
            onPress={() => navigation.navigate("CommunitySubmit")}
            activeOpacity={0.8}
          >
            <Text style={s.contributeIcon}>+</Text>
            <View>
              <Text style={s.contributeTxt}>Contribute a prayer</Text>
              <Text style={s.contributeSub}>Share a tradition with the world</Text>
            </View>
          </TouchableOpacity>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
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

  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 22,
    marginBottom: 22,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 999,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 4,
  },
  avatarText: {
    fontFamily: "HankenGrotesk_700Bold",
    fontSize: 17,
    color: C.onacc,
  },
  accountInfo: { flex: 1, minWidth: 0 },
  accountEmail: {
    fontFamily: "HankenGrotesk_600SemiBold",
    fontSize: 15,
    color: C.text,
    marginBottom: 3,
  },
  accountSub: {
    fontFamily: "Newsreader_400Regular_Italic",
    fontSize: 14,
    color: C.text3,
  },
  signOutBtn: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  signOutTxt: {
    fontFamily: "HankenGrotesk_600SemiBold",
    fontSize: 12,
    color: C.text2,
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 22,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    alignItems: "center",
  },
  statNum: {
    fontFamily: "InstrumentSerif_400Regular",
    fontSize: 32,
    color: C.text,
    lineHeight: 34,
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: "HankenGrotesk_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: C.text3,
  },

  sectionLabel: {
    fontFamily: "HankenGrotesk_700Bold",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: C.text3,
    marginHorizontal: 22,
    marginBottom: 12,
  },

  savedCard: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: C.surface,
    borderRadius: 16,
    marginHorizontal: 22,
    marginBottom: 10,
    overflow: "hidden",
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 2,
  },
  savedBar: { width: 5 },
  savedBody: { flex: 1, padding: 14 },
  savedMeta: { marginBottom: 6 },
  savedRel: {
    fontFamily: "HankenGrotesk_700Bold",
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  savedTitle: {
    fontFamily: "InstrumentSerif_400Regular",
    fontSize: 22,
    lineHeight: 24,
    color: C.text,
    marginBottom: 4,
  },
  savedExcerpt: {
    fontFamily: "Newsreader_400Regular_Italic",
    fontSize: 15,
    lineHeight: 21,
    color: C.text2,
  },
  removeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtnTxt: { fontSize: 13, color: C.text3 },

  emptySaved: {
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 20,
    paddingBottom: 30,
  },
  emptyTitle: {
    fontFamily: "InstrumentSerif_400Regular",
    fontSize: 28,
    color: C.text2,
    textAlign: "center",
    marginBottom: 10,
  },
  emptySub: {
    fontFamily: "Newsreader_400Regular_Italic",
    fontSize: 17,
    color: C.text3,
    textAlign: "center",
    lineHeight: 25,
  },

  contributeCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginHorizontal: 22,
    marginTop: 20,
    borderWidth: 1.5,
    borderColor: C.line,
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 18,
  },
  contributeIcon: {
    fontSize: 24,
    color: C.text3,
    width: 30,
    textAlign: "center",
  },
  contributeTxt: {
    fontFamily: "HankenGrotesk_600SemiBold",
    fontSize: 15,
    color: C.text,
    marginBottom: 3,
  },
  contributeSub: {
    fontFamily: "Newsreader_400Regular_Italic",
    fontSize: 14,
    color: C.text3,
  },
});
