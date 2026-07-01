import { useState, useMemo } from "react";
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
import { useTheme } from "../lib/ThemeContext";
import { signIn, signUp, supabase } from "../lib/supabase";

WebBrowser.maybeCompleteAuthSession();

interface Props {
  onSuccess: () => void;
}

export default function AuthScreen({ onSuccess }: Props) {
  const { C } = useTheme();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleEmailAuth = async () => {
    if (!email.trim()) { Alert.alert("Required", "Please enter your email address."); return; }
    if (!password.trim()) { Alert.alert("Required", "Please enter a password."); return; }
    if (password.length < 6) { Alert.alert("Too short", "Password must be at least 6 characters."); return; }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await signUp(email.trim(), password);
        if (error) {
          Alert.alert("Sign Up Failed", error.message);
        } else {
          Alert.alert("Account Created", "You can now sign in with your email and password.", [
            { text: "Sign In", onPress: () => setMode("signin") },
          ]);
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

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const redirectUrl = AuthSession.makeRedirectUri({ scheme: "sacra", path: "auth/callback" });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
      });
      if (error) throw error;

      const result = await WebBrowser.openAuthSessionAsync(data.url!, redirectUrl);
      if (result.type === "success") {
        const url = result.url;
        const params = new URLSearchParams(url.split("#")[1] || url.split("?")[1] || "");
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
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) { onSuccess(); }
          else { Alert.alert("Sign In Incomplete", "Please try again."); }
        }
      }
    } catch (err: any) {
      Alert.alert("Google Sign In Failed", err.message || "Something went wrong.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const s = useMemo(() => makeStyles(C), [C]);

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
            <Text style={s.wordmark}>SACRA</Text>
            <Text style={s.title}>
              {mode === "signin" ? "Welcome back" : "Join SACRA"}
            </Text>
            <Text style={s.sub}>
              {mode === "signin"
                ? "Sign in to save prayers and build your sacred collection."
                : "Create an account to save prayers across devices."}
            </Text>
          </View>

          {/* Google button */}
          <TouchableOpacity
            style={[s.googleBtn, googleLoading && { opacity: 0.6 }]}
            onPress={handleGoogleSignIn}
            disabled={googleLoading}
            activeOpacity={0.85}
          >
            {googleLoading ? (
              <ActivityIndicator color={C.text} />
            ) : (
              <>
                <Text style={s.googleIcon}>G</Text>
                <Text style={s.googleTxt}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.divLine} />
            <Text style={s.divTxt}>or</Text>
            <View style={s.divLine} />
          </View>

          {/* Email form */}
          <View>
            <Text style={s.fieldLabel}>Email address</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={C.text3}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              selectionColor={C.accent}
            />
            <Text style={[s.fieldLabel, { marginTop: 16 }]}>Password</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder={mode === "signup" ? "Choose a password (6+ chars)" : "••••••••"}
              placeholderTextColor={C.text3}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleEmailAuth}
              selectionColor={C.accent}
            />
            <TouchableOpacity
              style={[s.emailBtn, loading && { opacity: 0.6 }]}
              onPress={handleEmailAuth}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={C.onacc} />
              ) : (
                <Text style={s.emailBtnTxt}>
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Switch mode */}
          <TouchableOpacity
            style={s.switchBtn}
            onPress={() => { setMode(mode === "signin" ? "signup" : "signin"); setEmail(""); setPassword(""); }}
          >
            <Text style={s.switchTxt}>
              {mode === "signin" ? "No account? Create one →" : "Have an account? Sign in →"}
            </Text>
          </TouchableOpacity>

          {/* Skip */}
          <TouchableOpacity style={s.skipBtn} onPress={onSuccess}>
            <Text style={s.skipTxt}>Continue without signing in</Text>
            <Text style={s.skipSub}>Browse and listen freely — sign in anytime to save prayers</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(C: ReturnType<typeof import("../lib/ThemeContext").useTheme>["C"]) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48 },

    header: { marginBottom: 36 },
    wordmark: {
      fontFamily: "InstrumentSerif_400Regular",
      fontSize: 38,
      color: C.text,
      letterSpacing: 2,
      marginBottom: 16,
    },
    title: {
      fontFamily: "InstrumentSerif_400Regular",
      fontSize: 40,
      lineHeight: 40,
      color: C.text,
      marginBottom: 12,
      letterSpacing: -0.5,
    },
    sub: { fontFamily: "Newsreader_400Regular_Italic", fontSize: 18, lineHeight: 27, color: C.text2 },

    googleBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 11,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.line,
      borderRadius: 14,
      paddingVertical: 15,
      marginBottom: 22,
    },
    googleIcon: { fontSize: 16, fontFamily: "HankenGrotesk_700Bold", color: "#4285F4" },
    googleTxt: { fontFamily: "HankenGrotesk_600SemiBold", fontSize: 15, color: C.text },

    divider: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 22 },
    divLine: { flex: 1, height: 1, backgroundColor: C.line },
    divTxt: {
      fontFamily: "HankenGrotesk_500Medium",
      fontSize: 12,
      color: C.text3,
      textTransform: "uppercase",
      letterSpacing: 1,
    },

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
      paddingVertical: 14,
      fontFamily: "HankenGrotesk_400Regular",
      fontSize: 17,
      color: C.text,
    },

    emailBtn: {
      backgroundColor: C.accent,
      paddingVertical: 16,
      borderRadius: 999,
      alignItems: "center",
      marginTop: 22,
      shadowColor: C.accent,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 6,
    },
    emailBtnTxt: { fontFamily: "HankenGrotesk_700Bold", fontSize: 16, color: C.onacc },

    switchBtn: { alignItems: "center", marginTop: 22, padding: 8 },
    switchTxt: { fontFamily: "HankenGrotesk_500Medium", fontSize: 14, color: C.accent2 },

    skipBtn: {
      alignItems: "center",
      marginTop: 20,
      paddingTop: 22,
      borderTopWidth: 1,
      borderTopColor: C.line,
      gap: 6,
    },
    skipTxt: { fontFamily: "HankenGrotesk_600SemiBold", fontSize: 14, color: C.text2 },
    skipSub: {
      fontFamily: "Newsreader_400Regular_Italic",
      fontSize: 14,
      color: C.text3,
      textAlign: "center",
      lineHeight: 21,
    },
  });
}
