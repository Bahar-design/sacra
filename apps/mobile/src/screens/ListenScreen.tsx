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

// 42 bars matching the listen.html canvas design
const BARS    = 42;
const BAR_W   = 4;
const BAR_GAP = 2;
const WAVE_H  = 140; // total height of waveform area (bars grow ±70px from center)
const MAX_BAR = WAVE_H * 0.48; // max bar half-height

// Dome envelope: matches listen.html exactly — 0.32 at edges, 1.0 at centre
// Bars at the edges are never invisible; they still show at 32% of max height
const DOME_MULTIPLIERS = Array.from({ length: BARS }, (_, i) =>
  0.32 + 0.68 * Math.sin(Math.PI * i / (BARS - 1)),
);

// Horizontal gradient: coral → violet → jade (matches listen.html)
function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): string {
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}
const CORAL:  [number, number, number] = [226, 85, 61];
const VIOLET: [number, number, number] = [92, 75, 150];
const JADE:   [number, number, number] = [30, 138, 127];
const BAR_COLORS = Array.from({ length: BARS }, (_, i) => {
  const t = i / (BARS - 1);
  return t <= 0.5
    ? lerpColor(CORAL, VIOLET, t * 2)
    : lerpColor(VIOLET, JADE, (t - 0.5) * 2);
});

const MATCHING_STEPS = [
  "Transcribing…",
  "Generating embedding…",
  "Searching across faiths…",
  "Finding matches…",
];

// Mic icon — filled pill shape (matches the listen.html CTA button icon)
function MicIcon({ color, size = 20 }: { color: string; size?: number }) {
  const bodyW = size * 0.46;
  const bodyH = size * 0.56;
  const stemH = size * 0.18;
  const baseW = size * 0.44;
  return (
    <View style={{ width: size * 0.7, height: size, alignItems: "center" }}>
      <View style={{ width: bodyW, height: bodyH, borderRadius: bodyW / 2, backgroundColor: color }} />
      <View style={{ width: size * 0.07, height: stemH, backgroundColor: color }} />
      <View style={{ width: baseW, height: size * 0.06, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

const HALO_SIZE = 260;
const PING_SIZE = 180;

// Word entry with its own animation values
type LiveWord = { text: string; anim: Animated.Value; animY: Animated.Value };

export default function ListenScreen({ navigation }: any) {
  const { C } = useTheme();
  const [appState, setAppState]     = useState<State>("idle");
  const [results, setResults]       = useState<any[]>([]);
  const [liveWords, setLiveWords]   = useState<LiveWord[]>([]);
  const [errorMsg, setErrorMsg]     = useState("");
  const [matchingStep, setMatchingStep] = useState(MATCHING_STEPS[0]);
  const [religionsMap, setReligionsMap] = useState<Record<string, string>>({});

  const isRecordingRef = useRef(false);
  const liveWordsRef   = useRef<LiveWord[]>([]);

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
  const waves    = useRef(Array.from({ length: BARS }, () => new Animated.Value(0.04))).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const haloAnim = useRef(new Animated.Value(0)).current;
  const pingAnim1 = useRef(new Animated.Value(0)).current;
  const pingAnim2 = useRef(new Animated.Value(0)).current;

  const stepTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const spinLoopRef = useRef<any>(null);
  const pingLoop1   = useRef<any>(null);
  const pingLoop2   = useRef<any>(null);
  const meteringRef = useRef<number | null>(null);
  // Exponential smoothing state for amplitude (matches listen.html ampCurrent logic)
  const ampRef             = useRef(0.04);
  // Accumulated transcript text across all chunks — used for final search
  const accumulatedTextRef = useRef('');
  // Timer handle for the 3.5 s chunk cycle
  const chunkTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (recorderState.metering !== undefined && recorderState.metering !== null) {
      meteringRef.current = recorderState.metering;
    }
  }, [recorderState.metering]);

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
    ampRef.current = 0.04;
    waveTimer.current = setInterval(() => {
      // Exponential smoothing — matches listen.html: ampCurrent += (target - ampCurrent) * 0.14
      let ampTarget: number;
      if (meteringRef.current !== null) {
        ampTarget = Math.max(0, Math.min(1, (meteringRef.current + 60) / 60));
      } else {
        ampTarget = 0.3 + Math.random() * 0.4; // idle shimmer fallback
      }
      ampRef.current += (ampTarget - ampRef.current) * 0.14;
      const amp = ampRef.current;

      waves.forEach((wave, i) => {
        const target = Math.max(0.04, amp * DOME_MULTIPLIERS[i]);
        Animated.timing(wave, { toValue: target, duration: 60, useNativeDriver: false }).start();
      });
    }, 60);
  };
  const stopWaveAnimation = () => {
    if (waveTimer.current) { clearInterval(waveTimer.current); waveTimer.current = null; }
    meteringRef.current = null;
    ampRef.current = 0.04;
  };
  const animateBarsToIdle = () => {
    waves.forEach((a) =>
      Animated.timing(a, { toValue: 0.04, duration: 400, useNativeDriver: false }).start(),
    );
  };

  // ── Processing spinner ──────────────────────────────────────────────────────
  const startProcessingAnim = () => {
    spinLoopRef.current = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
    );
    spinLoopRef.current.start();
    // Gentle ripple through bars while processing
    waves.forEach((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 40),
          Animated.timing(a, { toValue: 0.28, duration: 500, useNativeDriver: false }),
          Animated.timing(a, { toValue: 0.04, duration: 500, useNativeDriver: false }),
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

  // ── Word animation ──────────────────────────────────────────────────────────
  const appendWords = useCallback((newWords: string[]) => {
    const animated: LiveWord[] = newWords.map((text) => ({
      text,
      anim:  new Animated.Value(0),
      animY: new Animated.Value(7),
    }));
    animated.forEach(({ anim, animY }, i) => {
      const delay = i * 50;
      Animated.parallel([
        Animated.timing(anim,  { toValue: 1, duration: 260, delay, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(animY, { toValue: 0, duration: 260, delay, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start();
    });
    const updated = [...liveWordsRef.current, ...animated];
    liveWordsRef.current = updated;
    setLiveWords([...updated]);
  }, []);

  // ── Idle shimmer: gentle per-bar oscillation when not recording ─────────────
  useEffect(() => {
    if (appState !== "idle") return;
    let t = 0;
    const seeds = DOME_MULTIPLIERS.map(() => Math.random() * Math.PI * 2);
    const timer = setInterval(() => {
      t += 0.05;
      waves.forEach((w, i) => {
        const val = 0.04 + 0.12 * DOME_MULTIPLIERS[i] * (0.5 + 0.5 * Math.sin(t * (1 + i * 0.015) + seeds[i]));
        Animated.timing(w, { toValue: val, duration: 100, useNativeDriver: false }).start();
      });
    }, 100);
    return () => clearInterval(timer);
  }, [appState]);

  // ── Chunked transcription: fires every 3.5 s while recording ────────────────
  // Each chunk is sent to /api/listen/transcribe (Whisper only, no search).
  // Words appear on screen as each chunk comes back.
  // On Stop the final in-progress clip is transcribed, then the full accumulated
  // text is sent to /api/search so the match uses the complete prayer context.
  const scheduleNextChunk = () => {
    chunkTimerRef.current = setTimeout(async () => {
      if (!isRecordingRef.current) return;
      let uri: string | null = null;
      try {
        await recorder.stop();
        uri = recorder.uri ?? null;
      } catch { /* recorder may have already stopped externally */ }
      if (isRecordingRef.current) {
        try {
          await recorder.prepareToRecordAsync();
          recorder.record();
        } catch { /* restart failed — no more auto-chunks */ }
        scheduleNextChunk();
      }
      if (uri) {
        PrayerAPI.listenChunk(uri)
          .then(text => {
            if (text?.trim()) {
              accumulatedTextRef.current +=
                (accumulatedTextRef.current ? " " : "") + text.trim();
              if (isRecordingRef.current) {
                appendWords(text.trim().split(/\s+/).filter(Boolean));
              }
            }
          })
          .catch(() => {});
      }
    }, 3500);
  };

  // ── Recording ────────────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) { setErrorMsg("Microphone access required."); setAppState("error"); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      isRecordingRef.current     = true;
      accumulatedTextRef.current = '';
      liveWordsRef.current       = [];
      setResults([]);
      setLiveWords([]);
      setAppState("recording");
      startWaveAnimation();
      startHalo();
      startPingRings();
      scheduleNextChunk();
    } catch {
      setErrorMsg("Failed to start recording. Please try again.");
      setAppState("error");
    }
  };

  const stopAndProcess = async () => {
    if (appState !== "recording") return;
    // Stop chunk cycling first so no new recording restart happens
    if (chunkTimerRef.current) {
      clearTimeout(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
    isRecordingRef.current = false;
    stopWaveAnimation();
    stopHalo();
    stopPingRings();
    animateBarsToIdle();
    setAppState("processing");
    startProcessingAnim();
    try {
      await recorder.stop();
      const uri = recorder.uri;

      // Transcribe the current (final) in-progress chunk
      if (uri) {
        try {
          const finalText = await PrayerAPI.listenChunk(uri);
          if (finalText?.trim()) {
            accumulatedTextRef.current +=
              (accumulatedTextRef.current ? " " : "") + finalText.trim();
            appendWords(finalText.trim().split(/\s+/).filter(Boolean));
          }
        } catch { /* use whatever was accumulated from earlier chunks */ }
      }

      const searchText = accumulatedTextRef.current.trim();
      if (!searchText) throw new Error("No speech detected. Try holding the phone closer or speaking for longer.");

      const res     = await PrayerAPI.search({ query: searchText, limit: 5 });
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
    if (chunkTimerRef.current) {
      clearTimeout(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
    accumulatedTextRef.current = '';
    setAppState("idle");
    setResults([]);
    setLiveWords([]);
    liveWordsRef.current = [];
    setErrorMsg("");
    animateBarsToIdle();
  };

  const spin       = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const topResult  = results[0];
  const relName    = (item: any) => item.religions?.name ?? religionsMap[item.religion_id] ?? "";
  const isCapturing = appState === "recording";
  const haloOpacity = haloAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] });

  const pingStyle = (anim: Animated.Value) => ({
    opacity:   anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.45, 0.15, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.65] }) }],
  });

  const s = useMemo(() => makeStyles(C), [C]);

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.headerRow}>
          <Text style={s.eyebrow}>Listen</Text>
          <ThemeToggle />
        </View>

        {/* Live transcript area */}
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

        {/* ── Waveform stage ────────────────────────────────────────────────── */}
        <View style={s.waveStage}>
          {/* Halo glow */}
          <View style={s.stageLayer} pointerEvents="none">
            <Animated.View style={[s.halo, { opacity: haloOpacity, backgroundColor: C.accent + "30" }]} />
          </View>

          {/* Ping rings — only during recording */}
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

          {/* Full-width mirrored waveform (bars grow ± from centre line) */}
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
                        outputRange: [3, MAX_BAR * 2],
                      }),
                      opacity: a.interpolate({ inputRange: [0.03, 1], outputRange: [0.15, 0.9] }),
                      backgroundColor:
                        appState === "recording"   ? BAR_COLORS[i]
                        : appState === "processing" ? C.accent2
                        : C.line,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>

        {/* ── Controls below waveform ───────────────────────────────────────── */}
        <View style={s.controlRow}>
          {/* Idle: CTA pill button */}
          {appState === "idle" && (
            <TouchableOpacity style={[s.ctaBtn, { backgroundColor: C.accent }]} onPress={startRecording} activeOpacity={0.88}>
              <MicIcon color={C.onacc} size={18} />
              <Text style={[s.ctaBtnTxt, { color: C.onacc }]}>Hold up to a prayer</Text>
            </TouchableOpacity>
          )}

          {/* Recording: Listening badge + Cancel */}
          {isCapturing && (
            <View style={s.listeningGroup}>
              <View style={s.listeningBadge}>
                <View style={[s.listeningDot, { backgroundColor: C.accent }]} />
                <Text style={[s.listeningTxt, { color: C.accent }]}>Listening</Text>
              </View>
              <TouchableOpacity
                style={[s.cancelBtn, { borderColor: C.line }]}
                onPress={stopAndProcess}
                activeOpacity={0.75}
              >
                <Text style={[s.cancelTxt, { color: C.text2 }]}>Stop</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Processing */}
          {appState === "processing" && (
            <View style={s.listeningBadge}>
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Text style={[s.spinnerGlyph, { color: C.accent2 }]}>↻</Text>
              </Animated.View>
              <Text style={[s.listeningTxt, { color: C.accent2 }]}>{matchingStep}</Text>
            </View>
          )}

          {/* Error */}
          {appState === "error" && (
            <TouchableOpacity onPress={reset} activeOpacity={0.75}>
              <Text style={[s.hintTxt, { color: C.accent }]}>Try again →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Results ───────────────────────────────────────────────────────── */}
        {appState === "results" && (
          <View style={s.resultsWrap}>
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
                    <Text style={[s.resultRel, { color }]}>{icon}  {name}</Text>
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

    wordStream:           { flexDirection: "column", justifyContent: "flex-end" },
    wordLine:             { flexDirection: "row", flexWrap: "wrap" },
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

    // Waveform stage — layered, full screen width
    waveStage: {
      height: WAVE_H + 40, // extra space for halo/ping rings
      marginVertical: 8,
    },
    stageLayer: {
      position: "absolute",
      top: 0, left: -22, right: -22, bottom: 0, // bleed past scroll padding
      alignItems: "center",
      justifyContent: "center",
    },
    halo: {
      width:  HALO_SIZE,
      height: HALO_SIZE,
      borderRadius: HALO_SIZE / 2,
    },
    pingRing: {
      width:  PING_SIZE,
      height: PING_SIZE,
      borderRadius: PING_SIZE / 2,
      borderWidth: 1.5,
    },
    // Full-width bar row — alignItems:'center' makes bars grow symmetrically up+down
    waveform: {
      flexDirection: "row",
      alignItems: "center",
      gap: BAR_GAP,
      height: WAVE_H,
    },
    bar: {
      width: BAR_W,
      borderRadius: BAR_W / 2,
    },

    // Controls row
    controlRow: {
      alignItems: "center",
      marginTop: 12,
      marginBottom: 4,
    },

    // Idle CTA pill
    ctaBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 16,
      paddingHorizontal: 28,
      borderRadius: 999,
      shadowColor: C.accent,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.45,
      shadowRadius: 18,
      elevation: 8,
    },
    ctaBtnTxt: {
      fontFamily: "HankenGrotesk_700Bold",
      fontSize: 15,
      letterSpacing: 0.2,
    },

    // Recording state
    listeningGroup: { alignItems: "center", gap: 14 },
    listeningBadge: { flexDirection: "row", alignItems: "center", gap: 8 },
    listeningDot:   { width: 8, height: 8, borderRadius: 4 },
    listeningTxt: {
      fontFamily: "HankenGrotesk_700Bold",
      fontSize: 12,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    cancelBtn: {
      borderWidth: 1,
      borderRadius: 999,
      paddingVertical: 11,
      paddingHorizontal: 36,
    },
    cancelTxt: {
      fontFamily: "HankenGrotesk_500Medium",
      fontSize: 15,
      letterSpacing: 0.2,
    },

    spinnerGlyph: { fontSize: 16 },
    hintTxt: {
      fontFamily: "HankenGrotesk_600SemiBold",
      fontSize: 13,
      letterSpacing: 0.3,
    },

    // Results
    resultsWrap: { width: "100%", marginTop: 20 },
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
