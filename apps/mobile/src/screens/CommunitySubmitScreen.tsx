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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../theme";
import { PrayerAPI } from "../lib/api";
import { trackCommunitySubmitted } from "../lib/analytics";

export default function CommunitySubmitScreen({ navigation }: any) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [religion, setReligion] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = (): string | null => {
    if (!title.trim()) return "Title is required.";
    if (body.trim().length < 20) return "Prayer text must be at least 20 characters.";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      Alert.alert("Check your entry", err);
      return;
    }
    setLoading(true);
    try {
      await PrayerAPI.submitCommunity({
        title: title.trim(),
        body: body.trim(),
        religion: religion.trim() || undefined,
        source: source.trim() || undefined,
      });
      setSuccess(true);
      trackCommunitySubmitted({ title, religion });
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? "Submission failed. Please try again.";
      Alert.alert("Submission error", msg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={[s.container, { justifyContent: "center", alignItems: "center" }]} edges={["top"]}>
        <Text style={s.successIcon}>✦</Text>
        <Text style={s.successTitle}>Received with gratitude</Text>
        <Text style={s.successSub}>
          Your prayer has been submitted for blessing and will join the collection soon.
        </Text>
        <TouchableOpacity
          style={s.doneBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <Text style={s.doneBtnTxt}>Return to sanctuary</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={s.headerRow}>
            <TouchableOpacity
              style={s.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Text style={s.backBtnTxt}>←</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.eyebrow}>Community</Text>
          <Text style={s.heading}>Offer a prayer</Text>
          <Text style={s.description}>
            Share a prayer from your tradition. It will be reviewed and, if authentic, added to the sacred collection.
          </Text>

          {/* Form */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Title *</Text>
            <TextInput
              style={s.input}
              placeholder="Name of the prayer"
              placeholderTextColor={C.text3}
              value={title}
              onChangeText={setTitle}
              selectionColor={C.accent}
            />
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Prayer text *</Text>
            <TextInput
              style={[s.input, s.textArea]}
              placeholder="Enter the full prayer here…"
              placeholderTextColor={C.text3}
              value={body}
              onChangeText={setBody}
              multiline
              textAlignVertical="top"
              selectionColor={C.accent}
            />
            <Text style={s.charCount}>{body.length} characters</Text>
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Religion / tradition</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Buddhism, Islam, Christianity…"
              placeholderTextColor={C.text3}
              value={religion}
              onChangeText={setReligion}
              selectionColor={C.accent}
            />
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Source</Text>
            <TextInput
              style={s.input}
              placeholder="Book name, URL, or oral tradition"
              placeholderTextColor={C.text3}
              value={source}
              onChangeText={setSource}
              selectionColor={C.accent}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={s.submitBtn}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={C.onacc} />
            ) : (
              <Text style={s.submitBtnTxt}>Submit for blessing ✦</Text>
            )}
          </TouchableOpacity>

          <Text style={s.disclaimer}>
            Submissions are reviewed for authenticity before being added to the collection.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 22, paddingBottom: 60 },

  headerRow: { paddingTop: 14, marginBottom: 20 },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnTxt: {
    fontSize: 17,
    color: C.text2,
  },

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
    fontSize: 40,
    lineHeight: 40,
    color: C.text,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  description: {
    fontFamily: "Newsreader_400Regular_Italic",
    fontSize: 19,
    lineHeight: 28,
    color: C.text2,
    marginBottom: 30,
  },

  fieldGroup: { marginBottom: 20 },
  fieldLabel: {
    fontFamily: "HankenGrotesk_700Bold",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: C.text3,
    marginBottom: 9,
  },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontFamily: "HankenGrotesk_400Regular",
    fontSize: 17,
    color: C.text,
  },
  textArea: {
    minHeight: 160,
    paddingTop: 13,
  },
  charCount: {
    fontFamily: "HankenGrotesk_500Medium",
    fontSize: 11,
    color: C.text3,
    marginTop: 6,
    textAlign: "right",
  },

  submitBtn: {
    backgroundColor: C.accent,
    paddingVertical: 17,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 18,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 8,
  },
  submitBtnTxt: {
    fontFamily: "HankenGrotesk_700Bold",
    fontSize: 16,
    color: C.onacc,
    letterSpacing: 0.4,
  },

  disclaimer: {
    fontFamily: "Newsreader_400Regular_Italic",
    fontSize: 14,
    color: C.text3,
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 20,
  },

  // Success state
  successIcon: {
    fontSize: 48,
    color: C.accent,
    marginBottom: 20,
  },
  successTitle: {
    fontFamily: "InstrumentSerif_400Regular",
    fontSize: 38,
    color: C.text,
    textAlign: "center",
    marginBottom: 14,
  },
  successSub: {
    fontFamily: "Newsreader_400Regular_Italic",
    fontSize: 19,
    color: C.text2,
    textAlign: "center",
    lineHeight: 29,
    paddingHorizontal: 32,
    marginBottom: 36,
  },
  doneBtn: {
    backgroundColor: C.accent,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 999,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  doneBtnTxt: {
    fontFamily: "HankenGrotesk_700Bold",
    fontSize: 16,
    color: C.onacc,
  },
});
