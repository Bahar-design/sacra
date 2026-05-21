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
import { theme } from "../theme";
import { getAllOfflinePrayers } from "../lib/offlineStorage";
import { supabase, signOut } from "../lib/supabase";

export default function ProfileScreen({ navigation }: any) {
  const [prayers, setPrayers] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      setPrayers(getAllOfflinePrayers());
      supabase.auth.getUser().then(({ data }) => setUser(data.user));
    }, []),
  );

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          // Auth state change listener in App.tsx will handle showing auth screen
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.eyebrow}>SACRA</Text>
        <Text style={s.heading}>Sacred</Text>

        {/* User info */}
        {user ? (
          <View style={s.userRow}>
            <View style={s.userInfo}>
              <Text style={s.userLabel}>SIGNED IN AS</Text>
              <Text style={s.userEmail} numberOfLines={1}>
                {user.email || user.user_metadata?.full_name || "User"}
              </Text>
            </View>
            <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
              <Text style={s.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.guestRow}>
            <Text style={s.guestText}>
              You are browsing as a guest. Sign in to sync your saved prayers
              across devices.
            </Text>
          </View>
        )}
      </View>

      {/* Contribute button */}
      <TouchableOpacity
        style={s.contributeBtn}
        onPress={() => navigation.navigate("CommunitySubmit")}
      >
        <Text style={s.contributeTxt}>✦ Contribute a Prayer to SACRA</Text>
      </TouchableOpacity>

      {/* Saved prayers */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionLabel}>SAVED PRAYERS</Text>
        <Text style={s.sectionSub}>
          Available offline — even without internet
        </Text>
      </View>

      {prayers.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptySymbol}>◇</Text>
          <Text style={s.emptyTitle}>No saved prayers yet</Text>
          <Text style={s.emptySub}>
            Tap ◇ Save on any prayer to add it here.{"\n"}
            Saved prayers work offline in churches, mosques, and temples.
          </Text>
        </View>
      ) : (
        <FlatList
          data={prayers}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.card}
              onPress={() =>
                navigation.navigate("PrayerDetail", { prayer: item })
              }
            >
              <Text style={s.cardRel}>{item.religion}</Text>
              <Text style={s.cardTitle}>{item.title}</Text>
              <Text style={s.cardBody} numberOfLines={2}>
                {item.body}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.ink },
  header: { padding: 20, paddingBottom: 12 },
  eyebrow: {
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
    marginBottom: 14,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.goldBorder,
    padding: 12,
  },
  userInfo: { flex: 1 },
  userLabel: {
    fontSize: 8,
    letterSpacing: 3,
    color: theme.colors.gold,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: theme.colors.parchmentDim,
    fontStyle: "italic",
  },
  signOutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.emberDim,
  },
  signOutText: {
    fontSize: 10,
    color: theme.colors.ember,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  guestRow: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.goldBorder,
    padding: 12,
  },
  guestText: {
    fontSize: 12,
    color: theme.colors.dust,
    fontStyle: "italic",
    lineHeight: 18,
  },
  contributeBtn: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.goldBorder,
    padding: 14,
    alignItems: "center",
  },
  contributeTxt: {
    fontSize: 12,
    color: theme.colors.gold,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  sectionHeader: { paddingHorizontal: 20, marginBottom: 12 },
  sectionLabel: {
    fontSize: 9,
    letterSpacing: 3,
    color: theme.colors.gold,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sectionSub: { fontSize: 11, color: theme.colors.dust, fontStyle: "italic" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptySymbol: {
    fontSize: 48,
    color: theme.colors.goldBorder,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.parchmentDim,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    color: theme.colors.dust,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.goldBorder,
    padding: 16,
    marginBottom: 12,
  },
  cardRel: {
    fontSize: 9,
    color: theme.colors.gold,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.parchment,
    marginBottom: 6,
  },
  cardBody: {
    fontSize: 13,
    color: theme.colors.parchmentDim,
    fontStyle: "italic",
    lineHeight: 19,
  },
});
