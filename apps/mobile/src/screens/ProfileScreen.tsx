import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { theme } from "../theme";
import { getAllOfflinePrayers } from "../lib/offlineStorage";

export default function ProfileScreen({ navigation }: any) {
  const [prayers, setPrayers] = useState<any[]>([]);

  // Reload saved prayers every time this tab is focused
  useFocusEffect(
    useCallback(() => {
      setPrayers(getAllOfflinePrayers());
    }, []),
  );

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.eyebrow}>SACRA</Text>
        <Text style={s.heading}>Saved Prayers</Text>
        <Text style={s.sub}>
          Available offline — in churches, mosques, and temples with no signal
        </Text>
      </View>

      <TouchableOpacity
        style={s.contributeBtn}
        onPress={() => navigation.navigate("CommunitySubmit")}
      >
        <Text style={s.contributeTxt}>✦ Contribute a Prayer to SACRA</Text>
      </TouchableOpacity>

      {prayers.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptySymbol}>◇</Text>
          <Text style={s.emptyTitle}>No saved prayers yet</Text>
          <Text style={s.emptySub}>
            Tap ◇ Save on any prayer to add it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={prayers}
          keyExtractor={(i) => i.id}
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
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
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
  heading: {
    fontSize: 36,
    fontWeight: "900",
    color: theme.colors.parchment,
    marginBottom: 8,
  },
  sub: { fontSize: 12, color: theme.colors.dust, fontStyle: "italic" },
  contributeBtn: {
    borderWidth: 1,
    borderColor: theme.colors.goldBorder,
    padding: 14,
    alignItems: "center",
    marginBottom: 24,
  },
  contributeTxt: {
    fontSize: 12,
    color: theme.colors.gold,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
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
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.goldBorder,
    padding: 16,
    marginBottom: 10,
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
