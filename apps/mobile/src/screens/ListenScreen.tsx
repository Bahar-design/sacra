import { useState, useRef, useEffect, useMemo, useCallback } from "react";
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
  useAudioRecorderState,
  AudioQuality,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../lib/ThemeContext";
import { getReligionColor, getReligionIcon } from "../theme";
import { PrayerAPI, getReligionsMap } from "../lib/api";
import { trackListen } from "../lib/analytics";
import ThemeToggle from "../components/ThemeToggle";
import type { RecordingOptions } from "expo-audio";

type State = "idle" | "recording" | "processing" | "results" | "error";
const BARS = 24;
const CHUNK_MS = 3000; // 3-second chunks for faster live transcription

const BAR_MULTIPLIERS = Array.from(
  { length: BARS },
  (_, i) => 0.4 + (Math.sin(i * 1.3) * 0.5 + 0.5) * 0.9,
);

const MATCHING_STEPS = [
  "Transcribing…",
  "Generating embedding…",
  "Searching across faiths…",
  "Finding matches…",
];

// Microphone icon matching Claude Design SVG path
function MicIcon({ color, size = 19 }: { color: string; size?: number }) {
  const bodyW  = size * 0.46;
  const bodyH  = size * 0.58;
  const stemW  = size * 0.07;
  const stemH  = size * 0.2;
  const baseW  = size * 0.46;
  const arcH   = size * 0.06;
  return (
    <View style={{ width: size * 0.7, height: size, alignItems: "center" }}>
      {/* Mic capsule */}
      <View style={{ width: bodyW, height: bodyH, borderRadius: bodyW / 2, backgroundColor: color }} />
      {/* Neck stem */}
      <View style={{ width: stemW, height: stemH, backgroundColor: color }} />
      {/* Base bar */}
      <View style={{ width: baseW, height: arcH, borderRadius: arcH / 2, backgroundColor: color }} />
    </View>
  );
}

export default function ListenScreen({ navigation }: any) {
  const { C } = useTheme();
  const [state, setState] = useState<State>("idle");
  const [results, setResults] = useState<any[]>([]);
  const [liveWords, setLiveWords] = useState<string[]>([]);
  const [caretVisible, setCaretVisible] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [matchingStep, setMatchingStep] = useState(MATCHING_STEPS[0]);
  const [religionsMap, setReligionsMap] = useState<Record<string, string>>({});

  const isRecordingRef   = useRef(false);
  const chunkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accumulatedRef   = useRef<string[]>([]);

  useEffect(() => {
    getReligionsMap().then(setReligionsMap).catch(console.error);
  }, []);

  // Blinking caret during recording
  useEffect(() => {
    if (state !== "recording") { setCaretVisible(true); return; }
    const blink = setInterval(() => setCaretVisible((v) => !v), 530);
    return () => clearInterval(blink);
  }, [state]);

  const recorder = useAudioRecorder(
    {
      extension: ".m4a",
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
      isMeteringEnabled: true,
      android: { outputFormat: "mpeg4", audioEncoder: "aac" },
      ios: { audioQuality: AudioQuality.HIGH },
      web: {},
    } as RecordingOptions,
  );

  const recorderState = useAudioRecorderState(recorder, 80);

  // ── Animated values ──────────────────────────────────────────────────────────
  const waves      = useRef(Array.from({ length: BARS }, () => new Animated.Value(0.08))).current;
  const spinAnim   = useRef(new Animated.Value(0)).current;
  const haloAnim   = useRef(new Animated.Value(0)).current;   // halo behind waveform
  const pingAnim1  = useRef(new Animated.Value(0)).current;   // ping ring 1
  const pingAnim2  = useRef(new Animated.Value(0)).current;   // ping ring 2 (offset)

  const stepTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const spinLoopRef = useRef<any>(null);
  const pingLoop1   = useRef<any>(null);
  const pingLoop2   = useRef<any>(null);
  const meteringRef = useRef<number | null>(null);

  useEffect(() => {
    if (recorderState.metering !== undefined && recorderState.metering !== null) {
      meteringRef.current = recorderState.metering;
    }
  }, [recorderState.metering]);

  // Halo pulse — active during recording
  const startHalo = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(haloAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(haloAnim, { toValue: 0.3, duration: 1600, useNativeDriver: true }),
      ]),
    ).start();
  };
  const stopHalo = () => {
    haloAnim.stopAnimation();
    haloAnim.setValue(0);
  };

  // Ping rings — matched to Claude Design scPing animation
  const startPingRings = () => {
    const ping = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      );
    pingLoop1.current = ping(pingAnim1, 0);
    pingLoop2.current = ping(pingAnim2, 1000);
    pingLoop1.current.start();
    pingLoop2.current.start();
  };
  const stopPingRings = () => {
    pingLoop1.current?.stop(); pingAnim1.setValue(0);
    pingLoop2.current?.stop(); pingAnim2.setValue(0);
  };

  const startWaveAnimation = () => {
    let phase = 0;
    waveTimer.current = setInterval(() => {
      phase += 0.18;
      let normalized: number;
      if (meteringRef.current !== null) {
        normalized = Math.max(0, Math.min(1, (meteringRef.current + 60) / 60));
      } else {
        const env = 0.35 + Math.sin(phase) * 0.22 + Math.cos(phase * 0.7) * 0.12;
        normalized = Math.max(0.08, Math.min(0.92, env + (Math.random() - 0.5) * 0.18));
      }
      waves.forEach((wave, i) => {
        const target = Math.max(0.07, normalized * BAR_MULTIPLIERS[i]);
        Animated.timing(wave, { toValue: target, duration: 75, useNativeDriver: false }).start();
      });
    }, 80);
  };

  const stopWaveAnimation = () => {
    if (waveTimer.current) { clearInterval(waveTimer.current); waveTimer.current = null; }
    meteringRef.current = null;
  };

  const animateBarsToIdle = () => {
    waves.forEach((a) =>
      Animated.timing(a, { toValue: 0.08, duration: 300, useNativeDriver: false }).start(),
    );
  };

  const startProcessingAnim = () => {
    spinLoopRef.current = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
    );
    spinLoopRef.current.start();
    waves.forEach((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 55),
          Animated.timing(a, { toValue: 0.35, duration: 600, useNativeDriver: false }),
          Animated.timing(a, { toValue: 0.08, duration: 600, useNativeDriver: false }),
        ]),
      ).start(),
    );
    let idx = 0;
    stepTimer.current = setInterval(() => {
      idx = (idx + 1) % MATCHING_STEPS.length;
      setMatchingStep(MATCHING_STEPS[idx]);
    }, 1200);
  };

  const stopProcessingAnim = () => {
    spinLoopRef.current?.stop();
    spinAnim.setValue(0);
    if (stepTimer.current) clearInterval(stepTimer.current);
    animateBarsToIdle();
  };

  const processChunk = useCallback(async () => {
    if (!isRecordingRef.current) return;
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (isRecordingRef.current) {
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
      if (uri) {
        const text = await PrayerAPI.listenChunk(uri);
        if (text?.trim()) {
          const words = text.trim().split(/\s+/).filter(Boolean);
          accumulatedRef.current = [...accumulatedRef.current, ...words];
          setLiveWords([...accumulatedRef.current]);
        }
      }
    } catch {
      // Chunk failed silently — keep recording
    }
  }, [recorder]);

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
      isRecordingRef.current = true;
      accumulatedRef.current = [];
      setResults([]);
      setLiveWords([]);
      setState("recording");
      startWaveAnimation();
      startHalo();
      startPingRings();
      chunkIntervalRef.current = setInterval(processChunk, CHUNK_MS);
    } catch {
      setErrorMsg("Failed to start recording. Please try again.");
      setState("error");
    }
  };

  const stopAndProcess = async () => {
    if (state !== "recording") return;
    isRecordingRef.current = false;
    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current);
      chunkIntervalRef.current = null;
    }
    stopWaveAnimation();
    stopHalo();
    stopPingRings();
    animateBarsToIdle();
    setState("processing");
    startProcessingAnim();
    try {
      await recorder.stop();
      const uri = recorder.uri;
      let finalText = "";
      if (uri) finalText = await PrayerAPI.listenChunk(uri).catch(() => "");

      const allWords = [...accumulatedRef.current, ...finalText.trim().split(/\s+/).filter(Boolean)];
      const fullText = allWords.join(" ");
      if (!fullText.trim()) throw new Error("No audio captured. Try in a quieter environment.");

      const res = await PrayerAPI.search({ query: fullText, limit: 5 });
      const matches = res.data.results || [];
      setResults(matches);
      setLiveWords(allWords);
      stopProcessingAnim();
      setState("results");
      trackListen({ matched: matches.length > 0, similarity: matches[0]?.similarity });
    } catch (err: any) {
      stopProcessingAnim();
      const serverMsg = err?.response?.data?.error || err?.response?.data?.message;
      setErrorMsg(
        serverMsg ??
          (err?.code === "ECONNABORTED"
            ? "Processing timed out. Try a shorter recording."
            : err?.message === "Network Error"
              ? "Cannot reach server. Check your connection."
              : err?.message ?? "Could not process audio. Please try again."),
      );
      setState("error");
    }
  };

  const reset = () => {
    setState("idle");
    setResults([]);
    setLiveWords([]);
    accumulatedRef.current = [];
    setErrorMsg("");
    animateBarsToIdle();
  };

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const topResult = results[0];
  const relName = (item: any) => item.religions?.name ?? religionsMap[item.religion_id] ?? "";

  const s = useMemo(() => makeStyles(C), [C]);

  const LiveTranscript = () => {
    if (liveWords.length === 0) return null;
    const prefix = liveWords.length > 1 ? liveWords.slice(0, -1).join(" ") : "";
    const last   = liveWords[liveWords.length - 1] ?? "";
    return (
      <Text style={s.transcript}>
        {prefix ? prefix + " " : ""}
        <Text style={{ color: C.accent, fontFamily: "Newsreader_400Regular" }}>{last}</Text>
        {state === "recording" && caretVisible
          ? <Text style={{ color: C.accent3 }}>|</Text>
          : null}
      </Text>
    );
  };

  // Ping ring style (scale + opacity driven by Animated.Value 0→1)
  const pingStyle = (anim: Animated.Value) => ({
    opacity: anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.4, 0.1, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
  });

  const isCapturing = state === "recording";
  const haloOpacity = haloAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] });

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.headerRow}>
          <Text style={s.eyebrow}>Listen</Text>
          <ThemeToggle />
        </View>

        {/* Transcript / headline */}
        <View style={s.transcriptArea}>
          {state === "idle" && (
            <Text style={s.headline}>Hold up to{"\n"}a prayer</Text>
          )}
          {state === "recording" && (
            liveWords.length > 0
              ? <LiveTranscript />
              : <Text style={s.transcript}>
                  Listening…{" "}
                  {caretVisible && <Text style={{ color: C.accent3 }}>|</Text>}
                </Text>
          )}
          {state === "processing" && (
            <Text style={s.transcript}>{matchingStep}</Text>
          )}
          {state === "results" && <LiveTranscript />}
          {state === "error" && (
            <Text style={[s.transcript, { color: C.accent }]}>{errorMsg}</Text>
          )}
        </View>

        {/* Waveform stage — halo + ping rings + bars */}
        <View style={s.waveStage}>
          {/* Halo — radial glow behind bars, only when recording */}
          <Animated.View
            style={[
              s.halo,
              { opacity: haloOpacity, backgroundColor: C.accent + "40" },
            ]}
          />

          {/* Ping rings — circle outlines that expand + fade when recording */}
          {isCapturing && (
            <>
              <Animated.View style={[s.pingRing, { borderColor: C.accent }, pingStyle(pingAnim1)]} />
              <Animated.View style={[s.pingRing, { borderColor: C.accent2 }, pingStyle(pingAnim2)]} />
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
                      outputRange: [4, isCapturing ? 100 : 28],
                    }),
                    opacity: a.interpolate({ inputRange: [0.06, 1], outputRange: [0.2, 0.95] }),
                    backgroundColor:
                      state === "recording"   ? C.accent
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
              <TouchableOpacity style={s.mainBtn} onPress={startRecording} activeOpacity={0.85}>
                <MicIcon color={C.onacc} size={19} />
                <Text style={s.mainBtnTxt}>Hold up to a prayer</Text>
              </TouchableOpacity>
              <Text style={s.idleSub}>In any language, any tradition.{"\n"}We'll find it.</Text>
            </>
          )}

          {state === "recording" && (
            <>
              <View style={s.listeningRow}>
                <Animated.View style={[s.listeningDot, { backgroundColor: C.accent }]} />
                <Text style={[s.listeningTxt, { color: C.accent }]}>Listening</Text>
              </View>
              <TouchableOpacity style={s.cancelBtn} onPress={stopAndProcess} activeOpacity={0.7}>
                <Text style={s.cancelTxt}>Tap to stop</Text>
              </TouchableOpacity>
            </>
          )}

          {state === "processing" && (
            <View style={s.matchingRow}>
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Text style={[s.spinnerIcon, { color: C.accent2 }]}>↻</Text>
              </Animated.View>
              <Text style={[s.matchingTxt, { color: C.accent2 }]}>{matchingStep}</Text>
            </View>
          )}

          {state === "error" && (
            <TouchableOpacity style={s.cancelBtn} onPress={reset}>
              <Text style={s.cancelTxt}>Try again</Text>
            </TouchableOpacity>
          )}

          {state === "results" && (
            <View style={{ width: "100%" }}>
              {topResult && (
                <View style={s.matchBadge}>
                  <Text style={[s.matchBadgeTxt, { color: C.accent3, backgroundColor: C.accent3 + "28" }]}>
                    Matched · {(topResult.similarity * 100).toFixed(0)}%
                  </Text>
                </View>
              )}

              {results.map((m, i) => {
                const name  = relName(m);
                const color = getReligionColor(name);
                const icon  = getReligionIcon(name);
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={s.resultCard}
                    activeOpacity={0.8}
                    onPress={() =>
                      navigation.navigate("PrayerDetail", { prayer: { ...m, religions: { name } } })
                    }
                  >
                    <View style={[s.resultTopLine, { backgroundColor: i === 0 ? C.accent : C.line }]} />
                    <View style={s.resultMeta}>
                      <View style={[s.resultDot, { backgroundColor: color }]} />
                      <Text style={[s.resultRel, { color }]}>
                        {icon}  {name}{m.language ? ` · ${m.language}` : ""}
                      </Text>
                    </View>
                    <Text style={s.resultTitle}>{m.title}</Text>
                    <Text style={s.resultExcerpt} numberOfLines={2}>"{m.body}"</Text>
                  </TouchableOpacity>
                );
              })}

              {results.length === 0 && (
                <Text style={s.noMatch}>
                  No prayers matched. Try recording longer or in a quieter space.
                </Text>
              )}

              <TouchableOpacity style={s.againBtn} onPress={reset}>
                <Text style={s.againTxt}>↺  Listen again</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: ReturnType<typeof import("../lib/ThemeContext").useTheme>["C"]) {
  const HALO_SIZE = 260;
  const PING_SIZE = 150;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    scroll:    { flexGrow: 1, paddingBottom: 120, paddingHorizontal: 22 },

    headerRow: {
      paddingTop: 16,
      marginBottom: 6,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    eyebrow: {
      fontFamily: "HankenGrotesk_700Bold",
      fontSize: 12,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: C.text3,
    },

    transcriptArea: { minHeight: 118, justifyContent: "flex-end", marginTop: 10 },
    headline:   { fontFamily: "InstrumentSerif_400Regular", fontSize: 38, lineHeight: 40, color: C.text, letterSpacing: -0.5 },
    transcript: { fontFamily: "Newsreader_400Regular", fontSize: 27, lineHeight: 36, color: C.text2 },

    // Waveform stage — centered, 230px tall
    waveStage: {
      height: 230,
      alignItems: "center",
      justifyContent: "center",
      marginVertical: 6,
    },
    halo: {
      position: "absolute",
      width: HALO_SIZE,
      height: HALO_SIZE,
      borderRadius: HALO_SIZE / 2,
    },
    pingRing: {
      position: "absolute",
      width: PING_SIZE,
      height: PING_SIZE,
      borderRadius: PING_SIZE / 2,
      borderWidth: 1.5,
    },
    waveform: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      height: 110,
      justifyContent: "center",
    },
    bar: { width: 3.5, borderRadius: 2 },

    controls:    { alignItems: "center", flex: 1, paddingTop: 6 },
    mainBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      backgroundColor: C.accent,
      paddingVertical: 18,
      paddingHorizontal: 32,
      borderRadius: 999,
      shadowColor: C.accent,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 8,
    },
    mainBtnTxt: { fontFamily: "HankenGrotesk_700Bold", fontSize: 16, color: C.onacc },
    idleSub: {
      fontFamily: "Newsreader_400Regular_Italic",
      fontSize: 17,
      color: C.text3,
      textAlign: "center",
      marginTop: 18,
      lineHeight: 25,
      maxWidth: 250,
    },

    listeningRow: { flexDirection: "row", alignItems: "center", gap: 9 },
    listeningDot: { width: 9, height: 9, borderRadius: 5 },
    listeningTxt: { fontFamily: "HankenGrotesk_700Bold", fontSize: 13, letterSpacing: 1.2, textTransform: "uppercase" },
    cancelBtn: {
      marginTop: 16,
      borderWidth: 1,
      borderColor: C.line,
      borderRadius: 999,
      paddingVertical: 11,
      paddingHorizontal: 22,
    },
    cancelTxt: { fontFamily: "HankenGrotesk_600SemiBold", fontSize: 13, color: C.text3 },

    matchingRow: { flexDirection: "row", alignItems: "center", gap: 9 },
    spinnerIcon: { fontSize: 18 },
    matchingTxt: { fontFamily: "HankenGrotesk_700Bold", fontSize: 13, letterSpacing: 1, textTransform: "uppercase" },

    matchBadge: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 14 },
    matchBadgeTxt: {
      fontFamily: "HankenGrotesk_700Bold",
      fontSize: 11,
      letterSpacing: 1,
      textTransform: "uppercase",
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
    resultTopLine: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
    resultMeta:    { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 11 },
    resultDot:     { width: 8, height: 8, borderRadius: 4 },
    resultRel:     { fontFamily: "HankenGrotesk_700Bold", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
    resultTitle:   { fontFamily: "InstrumentSerif_400Regular", fontSize: 30, lineHeight: 32, color: C.text, marginBottom: 9 },
    resultExcerpt: { fontFamily: "Newsreader_400Regular_Italic", fontSize: 18, lineHeight: 26, color: C.text2 },

    noMatch: { fontFamily: "Newsreader_400Regular_Italic", fontSize: 17, color: C.text3, textAlign: "center", marginVertical: 20, lineHeight: 25 },
    againBtn: { alignSelf: "center", marginTop: 16 },
    againTxt: { fontFamily: "HankenGrotesk_700Bold", fontSize: 13, color: C.text3 },
  });
}
