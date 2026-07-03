import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
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
const BARS     = 24;
const CHUNK_MS = 1500; // 1.5s chunks — faster word appearance

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

// Word entry with its own animation value for scWord entrance
type LiveWord = { text: string; anim: Animated.Value; animY: Animated.Value };

// Mic icon — vertical bars style matching Claude Design
function MicIcon({ color, size = 22 }: { color: string; size?: number }) {
  const bodyW = size * 0.46;
  const bodyH = size * 0.58;
  const stemW = size * 0.07;
  const stemH = size * 0.2;
  const baseW = size * 0.46;
  const arcH  = size * 0.06;
  return (
    <View style={{ width: size * 0.7, height: size, alignItems: "center" }}>
      <View style={{ width: bodyW, height: bodyH, borderRadius: bodyW / 2, backgroundColor: color }} />
      <View style={{ width: stemW, height: stemH, backgroundColor: color }} />
      <View style={{ width: baseW, height: arcH, borderRadius: arcH / 2, backgroundColor: color }} />
    </View>
  );
}

const ORB_SIZE    = 136;
const HALO_SIZE   = 280;
const PING_SIZE   = 190;

export default function ListenScreen({ navigation }: any) {
  const { C } = useTheme();
  const [appState, setAppState] = useState<State>("idle");
  const [results, setResults]   = useState<any[]>([]);
  const [liveWords, setLiveWords] = useState<LiveWord[]>([]);
  const [errorMsg, setErrorMsg]   = useState("");
  const [matchingStep, setMatchingStep] = useState(MATCHING_STEPS[0]);
  const [religionsMap, setReligionsMap] = useState<Record<string, string>>({});

  const isRecordingRef   = useRef(false);
  const chunkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accumulatedRef   = useRef<string[]>([]);
  const liveWordsRef     = useRef<LiveWord[]>([]);

  useEffect(() => {
    getReligionsMap().then(setReligionsMap).catch(console.error);
  }, []);

  const recorder      = useAudioRecorder(
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

  // ── Animated values ─────────────────────────────────────────────────────────
  const waves     = useRef(Array.from({ length: BARS }, () => new Animated.Value(0.08))).current;
  const spinAnim  = useRef(new Animated.Value(0)).current;
  const haloAnim  = useRef(new Animated.Value(0)).current;
  const pingAnim1 = useRef(new Animated.Value(0)).current;
  const pingAnim2 = useRef(new Animated.Value(0)).current;
  const orbScale  = useRef(new Animated.Value(1)).current;
  const orbPulse  = useRef<any>(null);

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

  // ── Orb breathe pulse (recording state) ────────────────────────────────────
  const startOrbPulse = () => {
    orbPulse.current = Animated.loop(
      Animated.sequence([
        Animated.timing(orbScale, { toValue: 1.08, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(orbScale, { toValue: 0.97, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    orbPulse.current.start();
  };
  const stopOrbPulse = () => {
    orbPulse.current?.stop();
    Animated.spring(orbScale, { toValue: 1, useNativeDriver: true }).start();
  };

  // ── Halo ────────────────────────────────────────────────────────────────────
  const startHalo = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(haloAnim, { toValue: 1,   duration: 1600, useNativeDriver: true }),
        Animated.timing(haloAnim, { toValue: 0.3, duration: 1600, useNativeDriver: true }),
      ]),
    ).start();
  };
  const stopHalo = () => { haloAnim.stopAnimation(); haloAnim.setValue(0); };

  // ── Ping rings ──────────────────────────────────────────────────────────────
  const startPingRings = () => {
    const makePing = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 2200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 300,  useNativeDriver: true }),
        ]),
      );
    pingLoop1.current = makePing(pingAnim1, 0);
    pingLoop2.current = makePing(pingAnim2, 1100);
    pingLoop1.current.start();
    pingLoop2.current.start();
  };
  const stopPingRings = () => {
    pingLoop1.current?.stop(); pingAnim1.setValue(0);
    pingLoop2.current?.stop(); pingAnim2.setValue(0);
  };

  // ── Waveform ────────────────────────────────────────────────────────────────
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

  // ── Processing spinner ──────────────────────────────────────────────────────
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

  // ── Per-word scWord animation: translateY 7→0, opacity 0→1 ─────────────────
  const appendWords = useCallback((newWords: string[]) => {
    const animated: LiveWord[] = newWords.map((text) => ({
      text,
      anim:  new Animated.Value(0),
      animY: new Animated.Value(7),
    }));
    // Kick off each word's entrance with a small stagger
    animated.forEach(({ anim, animY }, i) => {
      const delay = i * 60;
      Animated.parallel([
        Animated.timing(anim,  { toValue: 1, duration: 280, delay, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(animY, { toValue: 0, duration: 280, delay, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start();
    });
    const updated = [...liveWordsRef.current, ...animated];
    liveWordsRef.current = updated;
    setLiveWords([...updated]);
  }, []);

  // ── Chunk processing ────────────────────────────────────────────────────────
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
          appendWords(words);
        }
      }
    } catch {
      // silent — keep going
    }
  }, [recorder, appendWords]);

  const startRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) { setErrorMsg("Microphone access required."); setAppState("error"); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      isRecordingRef.current  = true;
      accumulatedRef.current  = [];
      liveWordsRef.current    = [];
      setResults([]);
      setLiveWords([]);
      setAppState("recording");
      startWaveAnimation();
      startHalo();
      startPingRings();
      startOrbPulse();
      chunkIntervalRef.current = setInterval(processChunk, CHUNK_MS);
    } catch {
      setErrorMsg("Failed to start recording. Please try again.");
      setAppState("error");
    }
  };

  const stopAndProcess = async () => {
    if (appState !== "recording") return;
    isRecordingRef.current = false;
    if (chunkIntervalRef.current) { clearInterval(chunkIntervalRef.current); chunkIntervalRef.current = null; }
    stopWaveAnimation();
    stopHalo();
    stopPingRings();
    stopOrbPulse();
    animateBarsToIdle();
    setAppState("processing");
    startProcessingAnim();
    try {
      await recorder.stop();
      const uri = recorder.uri;
      let finalText = "";
      if (uri) finalText = await PrayerAPI.listenChunk(uri).catch(() => "");
      const finalWords = finalText.trim().split(/\s+/).filter(Boolean);
      if (finalWords.length) appendWords(finalWords);

      const allWords  = [...accumulatedRef.current, ...finalWords];
      const fullText  = allWords.join(" ");
      if (!fullText.trim()) throw new Error("No audio captured. Try in a quieter environment.");

      const res     = await PrayerAPI.search({ query: fullText, limit: 5 });
      const matches = res.data.results || [];
      setResults(matches);
      stopProcessingAnim();
      setAppState("results");
      trackListen({ matched: matches.length > 0, similarity: matches[0]?.similarity });
    } catch (err: any) {
      stopProcessingAnim();
      const serverMsg = err?.response?.data?.error || err?.response?.data?.message;
      setErrorMsg(
        serverMsg ?? (
          err?.code === "ECONNABORTED" ? "Processing timed out. Try a shorter recording."
          : err?.message === "Network Error" ? "Cannot reach server. Check your connection."
          : err?.message ?? "Could not process audio. Please try again."
        ),
      );
      setAppState("error");
    }
  };

  const reset = () => {
    setAppState("idle");
    setResults([]);
    setLiveWords([]);
    liveWordsRef.current = [];
    accumulatedRef.current = [];
    setErrorMsg("");
    animateBarsToIdle();
  };

  const spin     = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const topResult = results[0];
  const relName   = (item: any) => item.religions?.name ?? religionsMap[item.religion_id] ?? "";
  const isCapturing = appState === "recording";
  const haloOpacity = haloAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] });

  const pingStyle = (anim: Animated.Value) => ({
    opacity:   anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.2, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
  });

  const s = useMemo(() => makeStyles(C), [C]);

  // Orb color: idle = accent, recording = ember tint of accent, processing = accent2
  const orbColor =
    appState === "recording"   ? C.accent
    : appState === "processing" ? C.accent2
    : C.accent;

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.headerRow}>
          <Text style={s.eyebrow}>Listen</Text>
          <ThemeToggle />
        </View>

        {/* Live transcript — words flow in with scWord animation */}
        <View style={s.transcriptArea}>
          {appState === "idle" && (
            <>
              <Text style={s.headline}>Hold up to{"\n"}a prayer</Text>
              <Text style={s.sub}>In any language, any tradition</Text>
            </>
          )}

          {appState === "processing" && liveWords.length === 0 && (
            <Text style={s.matchingHint}>{matchingStep}</Text>
          )}

          {appState === "error" && (
            <Text style={[s.matchingHint, { color: C.accent }]}>{errorMsg}</Text>
          )}

          {/* Animated word stream — shown during recording, processing, results */}
          {(appState === "recording" || appState === "processing" || appState === "results") && (
            <View style={s.wordStream}>
              {liveWords.length === 0 && appState === "recording" && (
                <Text style={s.listeningPlaceholder}>Listening…</Text>
              )}
              <View style={s.wordLine}>
                {liveWords.map(({ text, anim, animY }, i) => (
                  <Animated.View
                    key={i}
                    style={{ opacity: anim, transform: [{ translateY: animY }] }}
                  >
                    <Text style={[s.word, i === liveWords.length - 1 && { color: C.accent }]}>
                      {text}{" "}
                    </Text>
                  </Animated.View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Waveform stage — layered using absoluteFillObject so everything stays centered */}
        <View style={s.waveStage}>
          {/* Layer 1: halo glow */}
          <View style={s.stageLayer} pointerEvents="none">
            <Animated.View style={[s.halo, { opacity: haloOpacity, backgroundColor: C.accent + "38" }]} />
          </View>

          {/* Layer 2: ping rings — each in its own layer so both center independently */}
          {isCapturing && (
            <>
              <View style={s.stageLayer} pointerEvents="none">
                <Animated.View style={[s.pingRing, { borderColor: C.accent  }, pingStyle(pingAnim1)]} />
              </View>
              <View style={s.stageLayer} pointerEvents="none">
                <Animated.View style={[s.pingRing, { borderColor: C.accent2 }, pingStyle(pingAnim2)]} />
              </View>
            </>
          )}

          {/* Layer 3: waveform bars */}
          <View style={s.stageLayer} pointerEvents="none">
            <View style={s.waveform}>
              {waves.map((a, i) => (
                <Animated.View
                  key={i}
                  style={[
                    s.bar,
                    {
                      height: a.interpolate({
                        inputRange:  [0, 1],
                        outputRange: [4, isCapturing ? 96 : 28],
                      }),
                      opacity: a.interpolate({ inputRange: [0.06, 1], outputRange: [0.18, 0.92] }),
                      backgroundColor:
                        appState === "recording"   ? C.accent
                        : appState === "processing" ? C.accent2
                        : C.line,
                    },
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Layer 4: ORB — receives touches */}
          <View style={s.stageLayer}>
            <Animated.View style={{ transform: [{ scale: orbScale }] }}>
              <TouchableOpacity
                style={[s.orb, { backgroundColor: orbColor }]}
                onPress={
                  appState === "idle"       ? startRecording
                  : appState === "recording" ? stopAndProcess
                  : appState === "error"     ? reset
                  : undefined
                }
                activeOpacity={0.88}
                disabled={appState === "processing"}
              >
                {appState === "processing" ? (
                  <Animated.Text style={[s.orbSpinner, { color: C.onacc, transform: [{ rotate: spin }] }]}>
                    ↻
                  </Animated.Text>
                ) : appState === "recording" ? (
                  <View style={[s.stopIcon, { backgroundColor: C.onacc }]} />
                ) : (
                  <MicIcon color={C.onacc} size={26} />
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>

        {/* Status label below orb */}
        <View style={s.statusRow}>
          {appState === "idle" && (
            <Text style={s.statusLabel}>Tap the orb to begin</Text>
          )}
          {appState === "recording" && (
            <View style={s.listeningBadge}>
              <View style={[s.listeningDot, { backgroundColor: C.accent }]} />
              <Text style={[s.listeningTxt, { color: C.accent }]}>Listening · tap to stop</Text>
            </View>
          )}
          {appState === "processing" && (
            <View style={s.listeningBadge}>
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Text style={[s.orbSpinnerSmall, { color: C.accent2 }]}>↻</Text>
              </Animated.View>
              <Text style={[s.listeningTxt, { color: C.accent2 }]}>{matchingStep}</Text>
            </View>
          )}
          {appState === "error" && (
            <TouchableOpacity onPress={reset}>
              <Text style={[s.statusLabel, { color: C.accent }]}>Try again →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Results */}
        {appState === "results" && (
          <View style={{ width: "100%", marginTop: 28 }}>
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
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: ReturnType<typeof import("../lib/ThemeContext").useTheme>["C"]) {
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

    transcriptArea: { minHeight: 130, justifyContent: "flex-end", marginTop: 10, marginBottom: 10 },
    headline: {
      fontFamily: "InstrumentSerif_400Regular",
      fontSize: 38,
      lineHeight: 40,
      color: C.text,
      letterSpacing: -0.5,
    },
    sub: {
      fontFamily: "Newsreader_400Regular_Italic",
      fontSize: 16,
      color: C.text3,
      marginTop: 10,
      lineHeight: 22,
    },
    matchingHint: {
      fontFamily: "HankenGrotesk_700Bold",
      fontSize: 13,
      letterSpacing: 1,
      textTransform: "uppercase",
      color: C.accent2,
    },

    // Word stream — words flow inline with animation
    wordStream:   { flexDirection: "column", justifyContent: "flex-end" },
    wordLine:     { flexDirection: "row", flexWrap: "wrap" },
    word: {
      fontFamily: "Newsreader_400Regular",
      fontSize: 27,
      lineHeight: 36,
      color: C.text2,
      includeFontPadding: false,
    },
    listeningPlaceholder: {
      fontFamily: "Newsreader_400Regular_Italic",
      fontSize: 27,
      color: C.text3,
      lineHeight: 36,
    },

    // Waveform stage — fixed height, layers stacked via absoluteFillObject
    waveStage: {
      height: 260,
      marginVertical: 4,
    },
    // Each layer fills the stage and centers its single child
    stageLayer: {
      position: "absolute",
      top: 0, left: 0, right: 0, bottom: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    halo: {
      width: HALO_SIZE,
      height: HALO_SIZE,
      borderRadius: HALO_SIZE / 2,
    },
    pingRing: {
      width: PING_SIZE,
      height: PING_SIZE,
      borderRadius: PING_SIZE / 2,
      borderWidth: 1.5,
    },
    waveform: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      height: 120,
      justifyContent: "center",
    },
    bar: { width: 3.5, borderRadius: 2 },

    // Orb — large circle, centered over waveform
    orb: {
      width: ORB_SIZE,
      height: ORB_SIZE,
      borderRadius: ORB_SIZE / 2,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: C.accent,
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.55,
      shadowRadius: 28,
      elevation: 12,
    },
    stopIcon: { width: 28, height: 28, borderRadius: 5 },
    orbSpinner:      { fontSize: 30 },
    orbSpinnerSmall: { fontSize: 16 },

    statusRow: { alignItems: "center", marginTop: 16 },
    statusLabel: {
      fontFamily: "HankenGrotesk_600SemiBold",
      fontSize: 13,
      color: C.text3,
      letterSpacing: 0.3,
    },
    listeningBadge: { flexDirection: "row", alignItems: "center", gap: 8 },
    listeningDot:   { width: 8, height: 8, borderRadius: 4 },
    listeningTxt:   { fontFamily: "HankenGrotesk_700Bold", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },

    matchBadge:    { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 14 },
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

    noMatch:  { fontFamily: "Newsreader_400Regular_Italic", fontSize: 17, color: C.text3, textAlign: "center", marginVertical: 20, lineHeight: 25 },
    againBtn: { alignSelf: "center", marginTop: 16 },
    againTxt: { fontFamily: "HankenGrotesk_700Bold", fontSize: 13, color: C.text3 },
  });
}
