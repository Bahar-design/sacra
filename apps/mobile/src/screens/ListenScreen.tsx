import { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
} from "react-native";
import {
  useAudioRecorder,
  AudioQuality,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, getReligionColor, getReligionIcon } from "../theme";
import { PrayerAPI } from "../lib/api";
import { trackListen } from "../lib/analytics";
import type { RecordingOptions } from "expo-audio";

type State = "idle" | "recording" | "processing" | "results" | "error";
const BARS = 24;

const MATCHING_STEPS = [
  "Transcribing…",
  "Generating embedding…",
  "Searching across faiths…",
  "Finding matches…",
];

export default function ListenScreen({ navigation }: any) {
  const [state, setState] = useState<State>("idle");
  const [results, setResults] = useState<any[]>([]);
  const [transcript, setTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [matchingStep, setMatchingStep] = useState(MATCHING_STEPS[0]);

  const recorder = useAudioRecorder({
    extension: ".m4a",
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    android: { outputFormat: "mpeg4", audioEncoder: "aac" },
    ios: { audioQuality: AudioQuality.HIGH },
    web: {},
  } as RecordingOptions);

  const waves = useRef(
    Array.from({ length: BARS }, () => new Animated.Value(0.2)),
  ).current;
  const waveLoop = useRef<Animated.CompositeAnimation | null>(null);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pingAnim = useRef(new Animated.Value(0.65)).current;
  const ping2Anim = useRef(new Animated.Value(0.65)).current;
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startWave = () => {
    waveLoop.current = Animated.loop(
      Animated.stagger(
        40,
        waves.map((a) =>
          Animated.sequence([
            Animated.timing(a, {
              toValue: Math.random() * 0.8 + 0.2,
              duration: 180 + Math.random() * 280,
              useNativeDriver: false,
            }),
            Animated.timing(a, {
              toValue: 0.15,
              duration: 180 + Math.random() * 280,
              useNativeDriver: false,
            }),
          ]),
        ),
      ),
    );
    waveLoop.current.start();

    // Ping rings
    Animated.loop(
      Animated.sequence([
        Animated.timing(pingAnim, { toValue: 2, duration: 2400, useNativeDriver: true }),
        Animated.timing(pingAnim, { toValue: 0.65, duration: 0, useNativeDriver: true }),
      ]),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(ping2Anim, { toValue: 2, duration: 2400, useNativeDriver: true }),
        Animated.timing(ping2Anim, { toValue: 0.65, duration: 0, useNativeDriver: true }),
      ]),
    ).start();
  };

  const stopWave = () => {
    waveLoop.current?.stop();
    waves.forEach((a) => a.setValue(0.15));
    pingAnim.stopAnimation();
    ping2Anim.stopAnimation();
  };

  const startSpinner = () => {
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
    ).start();
    let idx = 0;
    stepTimer.current = setInterval(() => {
      idx = (idx + 1) % MATCHING_STEPS.length;
      setMatchingStep(MATCHING_STEPS[idx]);
    }, 1200);
  };

  const stopSpinner = () => {
    spinAnim.stopAnimation();
    spinAnim.setValue(0);
    if (stepTimer.current) clearInterval(stepTimer.current);
  };

  const startRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setErrorMsg("Microphone access required.");
        setState("error");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setResults([]);
      setTranscript("");
      setState("recording");
      startWave();
    } catch {
      setErrorMsg("Failed to start recording. Please try again.");
      setState("error");
    }
  };

  const stopAndProcess = async () => {
    if (state !== "recording") return;
    stopWave();
    setState("processing");
    startSpinner();
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("No audio recorded");
      const res = await PrayerAPI.listen(uri);
      setTranscript(res.data.transcription);
      setResults(res.data.matches || []);
      stopSpinner();
      setState("results");
      trackListen({
        matched: (res.data.matches?.length ?? 0) > 0,
        similarity: res.data.top_match?.similarity,
      });
    } catch (err: any) {
      stopSpinner();
      const serverMsg = err?.response?.data?.error || err?.response?.data?.message;
      const clientMsg = serverMsg
        ?? (err?.code === "ECONNABORTED" ? "Processing timed out. Try a shorter recording."
          : err?.message === "Network Error" ? "Cannot reach server. Check your connection."
          : err?.message ?? "Could not process audio. Please try again.");
      setErrorMsg(clientMsg);
      setState("error");
    }
  };

  const reset = () => {
    setState("idle");
    setResults([]);
    setTranscript("");
    setErrorMsg("");
  };

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const topResult = results[0];

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.headerRow}>
          <Text style={s.eyebrow}>Listen</Text>
        </View>

        {/* Transcript / Headline area */}
        <View style={s.transcriptArea}>
          {state === "idle" && (
            <Text style={s.headline}>
              Hold up to{"\n"}a prayer
            </Text>
          )}
          {state === "recording" && (
            <Text style={s.transcript}>
              Listening…{" "}
              <Text style={{ color: C.accent3 }}>|</Text>
            </Text>
          )}
          {state === "processing" && (
            <Text style={s.transcript}>
              {transcript
                ? `"${transcript}"`
                : "Processing your recording…"}
            </Text>
          )}
          {state === "results" && transcript ? (
            <Text style={s.transcript}>
              "{transcript}"
            </Text>
          ) : null}
          {state === "error" && (
            <Text style={[s.transcript, { color: C.accent }]}>{errorMsg}</Text>
          )}
        </View>

        {/* Waveform stage */}
        <View style={s.waveStage}>
          {/* Halo glow */}
          <View
            style={[
              s.halo,
              { opacity: state === "recording" ? 0.7 : 0.2 },
            ]}
          />

          {/* Ping rings when recording */}
          {state === "recording" && (
            <>
              <Animated.View
                style={[
                  s.pingRing,
                  { borderColor: C.accent, transform: [{ scale: pingAnim }], opacity: 0.35 },
                ]}
              />
              <Animated.View
                style={[
                  s.pingRing,
                  { borderColor: C.accent2, transform: [{ scale: ping2Anim }], opacity: 0.35 },
                ]}
              />
            </>
          )}

          {/* Waveform bars */}
          <View style={s.waveform}>
            {waves.map((a, i) => (
              <Animated.View
                key={i}
                style={[
                  s.bar,
                  {
                    height: a.interpolate({
                      inputRange: [0, 1],
                      outputRange: [4, state === "recording" ? 90 : 20],
                    }),
                    opacity: a.interpolate({
                      inputRange: [0.15, 1],
                      outputRange: [0.25, 0.9],
                    }),
                    backgroundColor:
                      state === "recording" ? C.accent
                      : state === "processing" ? C.accent2
                      : C.line,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Controls */}
        <View style={s.controls}>
          {state === "idle" && (
            <>
              <TouchableOpacity
                style={s.mainBtn}
                onPress={startRecording}
                activeOpacity={0.85}
              >
                <Text style={s.mainBtnIcon}>🎙</Text>
                <Text style={s.mainBtnTxt}>Hold up to a prayer</Text>
              </TouchableOpacity>
              <Text style={s.idleSub}>
                In any language, any tradition.{"\n"}We'll find it.
              </Text>
            </>
          )}

          {state === "recording" && (
            <>
              <View style={s.listeningRow}>
                <View style={s.listeningDot} />
                <Text style={s.listeningTxt}>Listening</Text>
              </View>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={stopAndProcess}
                activeOpacity={0.7}
              >
                <Text style={s.cancelTxt}>Tap to stop</Text>
              </TouchableOpacity>
            </>
          )}

          {state === "processing" && (
            <View style={s.matchingRow}>
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Text style={s.spinnerIcon}>↻</Text>
              </Animated.View>
              <Text style={s.matchingTxt}>{matchingStep}</Text>
            </View>
          )}

          {state === "error" && (
            <TouchableOpacity style={s.cancelBtn} onPress={reset}>
              <Text style={s.cancelTxt}>Try again</Text>
            </TouchableOpacity>
          )}

          {state === "results" && (
            <View style={{ width: "100%" }}>
              {/* Match badge */}
              {topResult && (
                <View style={s.matchBadge}>
                  <Text style={s.matchBadgeTxt}>
                    Matched · {(topResult.similarity * 100).toFixed(0)}%
                  </Text>
                </View>
              )}

              {/* Results cards */}
              {results.map((m, i) => {
                const name = m.religions?.name ?? "";
                const color = getReligionColor(name);
                const icon = getReligionIcon(name);
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={s.resultCard}
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate("PrayerDetail", { prayer: m })}
                  >
                    {/* Accent top line */}
                    <View style={[s.resultTopLine, { backgroundColor: i === 0 ? C.accent : C.line }]} />
                    <View style={s.resultMeta}>
                      <View style={[s.resultDot, { backgroundColor: color }]} />
                      <Text style={[s.resultRel, { color }]}>
                        {icon} {name} · {m.language || ""}
                      </Text>
                    </View>
                    <Text style={s.resultTitle}>{m.title}</Text>
                    <Text style={s.resultExcerpt} numberOfLines={2}>
                      "{m.body}"
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity style={s.againBtn} onPress={reset}>
                <Text style={s.againTxt}>↺ Listen again</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const HALO_SIZE = 260;
const RING_SIZE = 150;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, paddingBottom: 110, paddingHorizontal: 22 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    marginBottom: 6,
  },
  eyebrow: {
    fontFamily: "HankenGrotesk_700Bold",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: C.text3,
  },

  transcriptArea: {
    minHeight: 118,
    justifyContent: "flex-end",
    paddingBottom: 0,
    marginTop: 10,
  },
  headline: {
    fontFamily: "InstrumentSerif_400Regular",
    fontSize: 38,
    lineHeight: 40,
    color: C.text,
    letterSpacing: -0.5,
  },
  transcript: {
    fontFamily: "Newsreader_400Regular",
    fontSize: 27,
    lineHeight: 36,
    color: C.text2,
  },

  // Waveform stage
  waveStage: {
    height: 230,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 6,
    position: "relative",
  },
  halo: {
    position: "absolute",
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
    backgroundColor: C.accent,
    opacity: 0.18,
  },
  pingRing: {
    position: "absolute",
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
  },
  waveform: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 100,
    width: 330,
    justifyContent: "center",
  },
  bar: {
    width: 3,
    borderRadius: 2,
  },

  // Controls
  controls: {
    alignItems: "center",
    flex: 1,
    paddingTop: 6,
  },
  mainBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: C.accent,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 999,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 8,
  },
  mainBtnIcon: { fontSize: 19 },
  mainBtnTxt: {
    fontFamily: "HankenGrotesk_700Bold",
    fontSize: 16,
    color: C.onacc,
  },
  idleSub: {
    fontFamily: "Newsreader_400Regular_Italic",
    fontSize: 17,
    color: C.text3,
    textAlign: "center",
    marginTop: 18,
    lineHeight: 25,
    maxWidth: 250,
  },

  listeningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  listeningDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: C.accent,
  },
  listeningTxt: {
    fontFamily: "HankenGrotesk_700Bold",
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: C.accent,
  },
  cancelBtn: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 22,
  },
  cancelTxt: {
    fontFamily: "HankenGrotesk_600SemiBold",
    fontSize: 13,
    color: C.text3,
  },

  matchingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  spinnerIcon: {
    fontSize: 18,
    color: C.accent2,
  },
  matchingTxt: {
    fontFamily: "HankenGrotesk_700Bold",
    fontSize: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: C.accent2,
  },

  matchBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  matchBadgeTxt: {
    fontFamily: "HankenGrotesk_700Bold",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: C.accent3,
    backgroundColor: C.accent3 + "28",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },

  resultCard: {
    borderRadius: 24,
    backgroundColor: C.surface,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 4,
    padding: 22,
    marginBottom: 12,
    overflow: "hidden",
  },
  resultTopLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  resultMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 11,
  },
  resultDot: { width: 9, height: 9, borderRadius: 5 },
  resultRel: {
    fontFamily: "HankenGrotesk_700Bold",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  resultTitle: {
    fontFamily: "InstrumentSerif_400Regular",
    fontSize: 30,
    lineHeight: 32,
    color: C.text,
    marginBottom: 9,
  },
  resultExcerpt: {
    fontFamily: "Newsreader_400Regular_Italic",
    fontSize: 18,
    lineHeight: 26,
    color: C.text2,
  },

  againBtn: {
    alignSelf: "center",
    marginTop: 16,
  },
  againTxt: {
    fontFamily: "HankenGrotesk_700Bold",
    fontSize: 13,
    color: C.text3,
  },
});
