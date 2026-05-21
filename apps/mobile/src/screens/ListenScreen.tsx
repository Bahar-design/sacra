import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Audio } from "expo-av";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../theme";
import { PrayerAPI, WS_BASE } from "../lib/api";
import { trackListen } from "../lib/analytics";

type State = "idle" | "recording" | "processing" | "results" | "error";
const BARS = 24;

export default function ListenScreen({ navigation }: any) {
  const [state, setState] = useState<State>("idle");
  const [results, setResults] = useState<any[]>([]);
  const [transcript, setTranscript] = useState("");
  const [streamText, setStreamText] = useState(""); // live partial text
  const [errorMsg, setErrorMsg] = useState("");
  const recRef = useRef<Audio.Recording | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const waves = useRef(
    Array.from({ length: BARS }, () => new Animated.Value(0.2)),
  ).current;
  const waveLoop = useRef<Animated.CompositeAnimation | null>(null);

  const startWave = () => {
    waveLoop.current = Animated.loop(
      Animated.stagger(
        50,
        waves.map((a) =>
          Animated.sequence([
            Animated.timing(a, {
              toValue: Math.random() * 0.8 + 0.2,
              duration: 200 + Math.random() * 300,
              useNativeDriver: false,
            }),
            Animated.timing(a, {
              toValue: 0.2,
              duration: 200 + Math.random() * 300,
              useNativeDriver: false,
            }),
          ]),
        ),
      ),
    );
    waveLoop.current.start();
  };
  const stopWave = () => {
    waveLoop.current?.stop();
    waves.forEach((a) => a.setValue(0.2));
  };
  const startPulse = () =>
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  const stopPulse = () => {
    pulse.stopAnimation();
    pulse.setValue(1);
  };

  const connectWS = () =>
    new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(`${WS_BASE}/api/listen/stream`);
      ws.onopen = () => resolve(ws);
      ws.onerror = reject;
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "partial") setStreamText(msg.text);
          if (msg.type === "processing") setState("processing");
          if (msg.type === "result") {
            setTranscript(msg.transcription);
            setResults(msg.matches || []);
            setStreamText("");
            setState("results");
            trackListen({
              matched: msg.matches?.length > 0,
              similarity: msg.top_match?.similarity,
            });
          }
          if (msg.type === "error") {
            setErrorMsg(msg.message);
            setState("error");
          }
        } catch {}
      };
      wsRef.current = ws;
    });

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setErrorMsg("Microphone access required.");
        setState("error");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recRef.current = recording;
      setResults([]);
      setTranscript("");
      setStreamText("");
      setState("recording");
      startPulse();
      startWave();
      // Removed WebSocket — use reliable HTTP POST only
    } catch {
      setErrorMsg("Failed to start recording. Please try again.");
      setState("error");
    }
  };

  const stopAndProcess = async () => {
    if (!recRef.current) return;
    stopPulse();
    stopWave();
    setState("processing");
    try {
      await recRef.current.stopAndUnloadAsync();
      const uri = recRef.current.getURI();
      recRef.current = null;
      if (!uri) throw new Error("No audio recorded");
      const res = await PrayerAPI.listen(uri);
      setTranscript(res.data.transcription);
      setResults(res.data.matches || []);
      setState("results");
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.error ||
          "Could not process audio. Make sure the API is running and try again.",
      );
      setState("error");
    }
  };

  const reset = () => {
    setState("idle");
    setResults([]);
    setTranscript("");
    setStreamText("");
    setErrorMsg("");
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.eyebrow}>SACRA</Text>
        <Text style={s.heading}>Listen</Text>
        <Text style={s.sub}>
          {state === "idle" && "Hold your phone to any prayer being spoken"}
          {state === "recording" && "Listening — tap again when done"}
          {state === "processing" && "Identifying prayer across all faiths..."}
          {state === "results" && "Sacred text identified"}
          {state === "error" && errorMsg}
        </Text>
      </View>

      {state === "recording" && (
        <View style={s.waveform}>
          {waves.map((a, i) => (
            <Animated.View
              key={i}
              style={[
                s.bar,
                {
                  height: a.interpolate({
                    inputRange: [0, 1],
                    outputRange: [4, 40],
                  }),
                  opacity: a.interpolate({
                    inputRange: [0.2, 1],
                    outputRange: [0.3, 1],
                  }),
                },
              ]}
            />
          ))}
        </View>
      )}

      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <TouchableOpacity
          style={[
            s.orb,
            state === "recording" && s.orbRec,
            state === "processing" && s.orbProc,
          ]}
          onPress={state === "recording" ? stopAndProcess : startRecording}
          disabled={state === "processing"}
        >
          {state === "processing" ? (
            <ActivityIndicator color={theme.colors.ink} size="large" />
          ) : (
            <Text style={s.orbSym}>{state === "recording" ? "◼" : "◎"}</Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      {streamText ? (
        <View style={s.stream}>
          <Text style={s.streamLbl}>HEARING</Text>
          <Text style={s.streamTxt}>{streamText}</Text>
        </View>
      ) : null}

      {transcript ? (
        <View style={s.transc}>
          <Text style={s.transcLbl}>TRANSCRIBED</Text>
          <Text style={s.transcTxt}>"{transcript}"</Text>
        </View>
      ) : null}

      <ScrollView
        style={s.results}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {results.map((m, i) => (
          <TouchableOpacity
            key={m.id}
            style={s.card}
            onPress={() => navigation.navigate("PrayerDetail", { prayer: m })}
          >
            <View style={s.cardTop}>
              <Text style={s.rank}>
                ◆ {i === 0 ? "TOP MATCH" : `#${i + 1}`}
              </Text>
              <Text style={s.sim}>{(m.similarity * 100).toFixed(0)}%</Text>
            </View>
            <Text style={s.cardTitle}>{m.title}</Text>
            <Text style={s.cardBody} numberOfLines={3}>
              {m.body}
            </Text>
            <Text style={s.cardSrc}>{m.source}</Text>
          </TouchableOpacity>
        ))}
        {state === "results" && (
          <TouchableOpacity style={s.resetBtn} onPress={reset}>
            <Text style={s.resetTxt}>✦ Listen Again</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.ink,
    alignItems: "center",
    padding: 20,
  },
  header: { alignItems: "center", marginTop: 16, marginBottom: 28 },
  eyebrow: {
    fontFamily: "System",
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
  sub: {
    fontSize: 13,
    color: theme.colors.dust,
    textAlign: "center",
    fontStyle: "italic",
    maxWidth: 260,
  },
  waveform: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 50,
    marginBottom: 24,
  },
  bar: { width: 3, backgroundColor: theme.colors.gold, borderRadius: 1 },
  orb: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: theme.colors.gold,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.goldLight,
  },
  orbRec: { backgroundColor: theme.colors.ember },
  orbProc: { backgroundColor: theme.colors.dust },
  orbSym: { fontSize: 36, color: theme.colors.ink },
  stream: {
    marginTop: 20,
    padding: 14,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.gold,
    backgroundColor: theme.colors.goldGlow,
    width: "100%",
  },
  streamLbl: {
    fontSize: 8,
    letterSpacing: 3,
    color: theme.colors.gold,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  streamTxt: {
    fontSize: 15,
    color: theme.colors.parchment,
    fontStyle: "italic",
    lineHeight: 22,
  },
  transc: {
    marginTop: 14,
    padding: 14,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.goldBorder,
    backgroundColor: "rgba(201,168,76,0.04)",
    width: "100%",
  },
  transcLbl: {
    fontSize: 8,
    letterSpacing: 3,
    color: theme.colors.dust,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  transcTxt: {
    fontSize: 13,
    color: theme.colors.parchmentDim,
    fontStyle: "italic",
    lineHeight: 20,
  },
  results: { width: "100%", marginTop: 18 },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.goldBorder,
    padding: 16,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  rank: {
    fontSize: 9,
    color: theme.colors.gold,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  sim: { fontSize: 9, color: theme.colors.ember, fontWeight: "700" },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.parchment,
    marginBottom: 6,
  },
  cardBody: {
    fontSize: 13,
    color: theme.colors.parchmentDim,
    lineHeight: 19,
    marginBottom: 6,
    fontStyle: "italic",
  },
  cardSrc: { fontSize: 10, color: theme.colors.dust, letterSpacing: 1 },
  resetBtn: {
    marginTop: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.goldBorder,
    alignItems: "center",
  },
  resetTxt: {
    fontSize: 12,
    color: theme.colors.gold,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
});
