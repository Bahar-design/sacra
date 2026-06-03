import { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
} from "react-native";
import {
  useAudioRecorder,
  AudioQuality,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../theme";
import { PrayerAPI } from "../lib/api";
import { trackListen } from "../lib/analytics";
import type { RecordingOptions } from "expo-audio";

type State = "idle" | "recording" | "processing" | "results" | "error";
const BARS = 24;

export default function ListenScreen({ navigation }: any) {
  const [state, setState] = useState<State>("idle");
  const [results, setResults] = useState<any[]>([]);
  const [transcript, setTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const recorder = useAudioRecorder({
    extension: ".m4a",
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    android: { outputFormat: "mpeg4", audioEncoder: "aac" },
    ios: { audioQuality: AudioQuality.HIGH },
    web: {},
  } as RecordingOptions);
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

  const startRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setErrorMsg("Microphone access required.");
        setState("error");
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      recorder.record();
      setResults([]);
      setTranscript("");
      setState("recording");
      startPulse();
      startWave();
    } catch {
      setErrorMsg("Failed to start recording. Please try again.");
      setState("error");
    }
  };

  const stopAndProcess = async () => {
    if (state !== "recording") return;
    stopPulse();
    stopWave();
    setState("processing");
    try {
      // eslint-disable-next-line @typescript-eslint/await-thenable
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("No audio recorded");
      const res = await PrayerAPI.listen(uri);
      setTranscript(res.data.transcription);
      setResults(res.data.matches || []);
      setState("results");
      trackListen({
        matched: (res.data.matches?.length ?? 0) > 0,
        similarity: res.data.top_match?.similarity,
      });
    } catch (err: any) {
      const serverMsg =
        err?.response?.data?.error || err?.response?.data?.message;
      let clientMsg: string;
      if (serverMsg) {
        clientMsg = serverMsg;
      } else if (err?.code === "ECONNABORTED") {
        clientMsg = "Processing timed out. Try a shorter recording.";
      } else if (err?.message === "Network Error") {
        clientMsg = "Cannot reach server. Check your connection.";
      } else if (err?.message) {
        clientMsg = err.message;
      } else {
        clientMsg = "Could not process audio. Please try again.";
      }
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
