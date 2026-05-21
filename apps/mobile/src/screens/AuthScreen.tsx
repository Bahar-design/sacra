import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { theme } from "../theme";
import { signIn, signUp, supabase } from "../lib/supabase";

// Required for OAuth redirect handling
WebBrowser.maybeCompleteAuthSession();

interface Props {
  onSuccess: () => void;
}

export default function AuthScreen({ onSuccess }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // ─── Email / Password ──────────────────────────────────────

  const handleEmailAuth = async () => {
    if (!email.trim()) {
      Alert.alert("Required", "Please enter your email address.");
      return;
    }
    if (!password.trim()) {
      Alert.alert("Required", "Please enter a password.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Too short", "Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await signUp(email.trim(), password);
        if (error) {
          Alert.alert("Sign Up Failed", error.message);
        } else {
          Alert.alert(
            "Account Created",
            "You can now sign in with your email and password.",
            [{ text: "Sign In", onPress: () => setMode("signin") }],
          );
        }
      } else {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          Alert.alert(
            "Sign In Failed",
            error.message === "Invalid login credentials"
              ? "Incorrect email or password. Please try again."
              : error.message,
          );
        } else {
          onSuccess();
        }
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Google OAuth ──────────────────────────────────────────

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      // Build the redirect URL — this is what Google sends the user back to
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: "sacra",
        path: "auth/callback",
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      // Open the Google sign-in page in a browser
      const result = await WebBrowser.openAuthSessionAsync(
        data.url!,
        redirectUrl,
      );

      if (result.type === "success") {
        // Extract the session from the URL Supabase redirected back to
        const url = result.url;
        const params = new URLSearchParams(
          url.split("#")[1] || url.split("?")[1] || "",
        );
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
          onSuccess();
        } else {
          // Session may already be set via deep link — check
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) {
            onSuccess();
          } else {
            Alert.alert("Sign In Incomplete", "Please try again.");
          }
        }
      } else if (result.type === "cancel") {
        // User cancelled — do nothing
      }
    } catch (err: any) {
      Alert.alert(
        "Google Sign In Failed",
        err.message || "Something went wrong.",
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={s.header}>
            <Text style={s.eyebrow}>SACRA</Text>
            <Text style={s.title}>
              {mode === "signin" ? "Welcome\nBack" : "Join\nSACRA"}
            </Text>
            <View style={s.ornament}>
              <View style={s.ornLine} />
              <Text style={s.ornDia}>✦</Text>
              <Text style={s.ornDia}>◆</Text>
              <Text style={s.ornDia}>✦</Text>
              <View style={s.ornLine} />
            </View>
            <Text style={s.sub}>
              {mode === "signin"
                ? "Sign in to save prayers, build your sacred collection, and track your listening history"
                : "Create an account to save prayers across devices, build personal collections, and more"}
            </Text>
          </View>

          {/* Google Sign In */}
          <TouchableOpacity
            style={[s.googleBtn, googleLoading && { opacity: 0.6 }]}
            onPress={handleGoogleSignIn}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator color={theme.colors.ink} />
            ) : (
              <>
                <Text style={s.googleIcon}>G</Text>
                <Text style={s.googleText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.divLine} />
            <Text style={s.divText}>or</Text>
            <View style={s.divLine} />
          </View>

          {/* Email form */}
          <View style={s.form}>
            <Text style={s.label}>EMAIL ADDRESS</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={theme.colors.parchmentMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <Text style={s.label}>PASSWORD</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder={
                mode === "signup"
                  ? "Choose a password (6+ characters)"
                  : "••••••••"
              }
              placeholderTextColor={theme.colors.parchmentMuted}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleEmailAuth}
            />

            <TouchableOpacity
              style={[s.emailBtn, loading && { opacity: 0.6 }]}
              onPress={handleEmailAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.ink} />
              ) : (
                <Text style={s.emailBtnText}>
                  {mode === "signin" ? "✦ Sign In" : "✦ Create Account"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Switch mode */}
          <TouchableOpacity
            style={s.switchBtn}
            onPress={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setEmail("");
              setPassword("");
            }}
          >
            <Text style={s.switchText}>
              {mode === "signin"
                ? "Don't have an account? Create one →"
                : "Already have an account? Sign in →"}
            </Text>
          </TouchableOpacity>

          {/* Skip — user can use app without account */}
          <TouchableOpacity style={s.skipBtn} onPress={onSuccess}>
            <Text style={s.skipText}>Continue without signing in</Text>
            <Text style={s.skipSub}>
              You can still browse and listen — sign in later to save prayers
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.ink },
  scroll: { flexGrow: 1, padding: 28, paddingTop: 20, paddingBottom: 40 },
  header: { alignItems: "center", marginBottom: 32 },
  eyebrow: {
    fontFamily: "System",
    fontSize: 9,
    letterSpacing: 4,
    color: theme.colors.gold,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  title: {
    fontSize: 40,
    fontWeight: "900",
    color: theme.colors.parchment,
    textAlign: "center",
    lineHeight: 44,
    marginBottom: 16,
  },
  ornament: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: 180,
    marginBottom: 14,
  },
  ornLine: { flex: 1, height: 1, backgroundColor: theme.colors.goldBorder },
  ornDia: { fontSize: 10, color: theme.colors.gold },
  sub: {
    fontSize: 13,
    color: theme.colors.dust,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: theme.colors.parchment,
    padding: 15,
    marginBottom: 24,
  },
  googleIcon: { fontSize: 16, fontWeight: "900", color: "#4285F4" },
  googleText: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.ink,
    letterSpacing: 0.5,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  divLine: { flex: 1, height: 1, backgroundColor: theme.colors.goldBorder },
  divText: {
    fontFamily: "System",
    fontSize: 11,
    color: theme.colors.dust,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  form: { gap: 2 },
  label: {
    fontFamily: "System",
    fontSize: 9,
    letterSpacing: 3,
    color: theme.colors.gold,
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.parchment,
    borderWidth: 1,
    borderColor: theme.colors.goldBorder,
    padding: 14,
    fontSize: 15,
  },
  emailBtn: {
    backgroundColor: theme.colors.gold,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
  },
  emailBtnText: {
    fontSize: 13,
    color: theme.colors.ink,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  switchBtn: { alignItems: "center", marginTop: 20, padding: 8 },
  switchText: {
    fontSize: 13,
    color: theme.colors.parchmentDim,
    fontStyle: "italic",
  },
  skipBtn: {
    alignItems: "center",
    marginTop: 16,
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.goldBorder,
    paddingTop: 20,
  },
  skipText: {
    fontSize: 12,
    color: theme.colors.dust,
    letterSpacing: 1,
    marginBottom: 4,
  },
  skipSub: {
    fontSize: 11,
    color: theme.colors.parchmentMuted,
    fontStyle: "italic",
    textAlign: "center",
  },
});
