import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../theme";
import { PrayerAPI } from "../lib/api";
import { getUser } from "../lib/supabase";
import { trackCommunitySubmitted } from "../lib/analytics";

export default function CommunitySubmitScreen({ navigation }: any) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert("Required", "Title and prayer text are required.");
      return;
    }
    if (body.trim().length < 20) {
      Alert.alert("Too Short", "Prayer text must be at least 20 characters.");
      return;
    }
    setLoading(true);
    try {
      const { data: ud } = await getUser();
      await PrayerAPI.submitCommunity({
        title: title.trim(),
        body: body.trim(),
        source: source.trim() || undefined,
        user_id: ud.user?.id,
      });
      trackCommunitySubmitted();
      setSubmitted(true);
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.error || "Submission failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (submitted)
    return (
      <SafeAreaView
        style={[
          s.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text style={s.successSym}>◆</Text>
        <Text style={s.successTitle}>Submitted</Text>
        <Text style={s.successBody}>
          Your prayer has been submitted for review. If approved, it will be
          embedded and added to SACRA's sacred collection for all faiths to
          discover.
        </Text>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backBtnTxt}>← Return to SACRA</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <TouchableOpacity
          style={{ padding: 20 }}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ fontSize: 16, color: theme.colors.gold }}>←</Text>
        </TouchableOpacity>
        <View style={s.header}>
          <Text style={s.eyebrow}>COMMUNITY</Text>
          <Text style={s.heading}>Contribute a Prayer</Text>
          <Text style={s.sub}>
            Share a sacred text from any faith tradition. All submissions are
            reviewed before being added to the collection.
          </Text>
        </View>
        <View style={s.form}>
          <Text style={s.lbl}>PRAYER TITLE *</Text>
          <TextInput
            style={s.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. The Serenity Prayer"
            placeholderTextColor={theme.colors.parchmentMuted}
          />
          <Text style={s.lbl}>PRAYER TEXT *</Text>
          <TextInput
            style={[s.input, s.area]}
            value={body}
            onChangeText={setBody}
            placeholder="Enter the full text of the prayer..."
            placeholderTextColor={theme.colors.parchmentMuted}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />
          <Text style={s.count}>{body.length} characters (minimum 20)</Text>
          <Text style={s.lbl}>SOURCE CITATION</Text>
          <TextInput
            style={s.input}
            value={source}
            onChangeText={setSource}
            placeholder="e.g. Alcoholics Anonymous Big Book, p. 59"
            placeholderTextColor={theme.colors.parchmentMuted}
          />
          <Text style={s.hint}>
            Including a source citation increases approval chances. Only public
            domain or openly licensed texts are accepted.
          </Text>
          <TouchableOpacity
            style={[s.submitBtn, loading && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.ink} />
            ) : (
              <Text style={s.submitTxt}>✦ Submit for Review</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.ink },
  header: { padding: 20, paddingTop: 0 },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 4,
    color: theme.colors.gold,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: theme.colors.parchment,
    marginBottom: 10,
  },
  sub: {
    fontSize: 14,
    color: theme.colors.dust,
    fontStyle: "italic",
    lineHeight: 21,
  },
  form: { padding: 20, paddingTop: 0 },
  lbl: {
    fontSize: 9,
    letterSpacing: 3,
    color: theme.colors.gold,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 20,
  },
  input: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.parchment,
    borderWidth: 1,
    borderColor: theme.colors.goldBorder,
    padding: 14,
    fontSize: 14,
    fontStyle: "italic",
  },
  area: { height: 160, textAlignVertical: "top" },
  count: {
    fontSize: 10,
    color: theme.colors.dust,
    marginTop: 6,
    textAlign: "right",
  },
  hint: {
    fontSize: 11,
    color: theme.colors.dust,
    fontStyle: "italic",
    marginTop: 8,
    lineHeight: 17,
  },
  submitBtn: {
    backgroundColor: theme.colors.gold,
    padding: 16,
    alignItems: "center",
    marginTop: 32,
  },
  submitTxt: {
    fontSize: 13,
    color: theme.colors.ink,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  successSym: { fontSize: 48, color: theme.colors.gold, marginBottom: 16 },
  successTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: theme.colors.parchment,
    marginBottom: 12,
  },
  successBody: {
    fontSize: 15,
    color: theme.colors.dust,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 23,
    maxWidth: 300,
    marginBottom: 32,
  },
  backBtn: {
    borderWidth: 1,
    borderColor: theme.colors.goldBorder,
    padding: 14,
    paddingHorizontal: 32,
  },
  backBtnTxt: {
    fontSize: 12,
    color: theme.colors.gold,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
});
