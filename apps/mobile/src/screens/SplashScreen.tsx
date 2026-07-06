import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");

interface Props {
  onFinish: () => void;
}

// Light-mode palette (day, 07:00–19:00)
const BG_L       = "#FFFDF9";
const TEXT_INK_L = "#211B30";
const TEXT_DIM_L = "#A79FB0";
const ACCENT_L   = "#E2553D";
// Dark-mode palette (night, 19:00–07:00)
const BG_D       = "#141021";
const TEXT_INK_D = "#F4EFE6";
const TEXT_DIM_D = "#6E6784";
const ACCENT_D   = "#FF6E54";

// Orb — centred on screen with slight upward offset to leave room for text below
const ORB    = 130;
const ORB_CX = width  / 2;
const ORB_CY = height / 2 - 10;

// 5 orbiting "planets" — spread at comfortable distances from the central "sun"
// Radii chosen so no planet touches the orb (radius 65px) and they scatter
// naturally across the screen, evoking "many voices · one light"
const DOTS = [
  { color: "#3E6FB0", size: 14, radius: 130, startAngle:  20, period: 6200 },
  { color: "#E0A02E", size:  9, radius: 152, startAngle: 100, period: 9000 },
  { color: "#1E8A7F", size: 11, radius: 116, startAngle: 185, period: 5000 },
  { color: "#8E5BA6", size: 13, radius: 148, startAngle: 258, period: 8000 },
  { color: "#C24D52", size:  8, radius: 138, startAngle: 335, period: 7000 },
];

// Precompute N keyframe positions (x, y offsets from orbit center) for one full circle.
// N=17 gives smooth circles while staying lightweight.
const N = 17;
function orbitKeyframes(radius: number, startAngle: number) {
  const inp  = Array.from({ length: N }, (_, i) => i / (N - 1));
  const xOut = inp.map((t) => radius * Math.cos((startAngle + t * 360) * (Math.PI / 180)));
  const yOut = inp.map((t) => radius * Math.sin((startAngle + t * 360) * (Math.PI / 180)));
  return { inp, xOut, yOut };
}

export default function SplashScreen({ onFinish }: Props) {
  // Day 07:00–19:00 → light; night → dark
  const hour     = new Date().getHours();
  const isDark   = hour < 7 || hour >= 19;
  const BG       = isDark ? BG_D       : BG_L;
  const TEXT_INK = isDark ? TEXT_INK_D : TEXT_INK_L;
  const TEXT_DIM = isDark ? TEXT_DIM_D : TEXT_DIM_L;
  const ACCENT   = isDark ? ACCENT_D   : ACCENT_L;

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const orbScale  = useRef(new Animated.Value(1)).current;
  const auroraX   = useRef(new Animated.Value(0)).current;
  const exitAnim  = useRef(new Animated.Value(1)).current;

  // One Animated.Value per dot, 0→1 drives the orbital interpolation
  const dotAngle = useRef(DOTS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Aurora colour sweep across the orb
    Animated.loop(
      Animated.timing(auroraX, { toValue: -ORB, duration: 3800, useNativeDriver: true }),
    ).start();

    // Breathe: scale 1 ↔ 1.06
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbScale, { toValue: 1.06, duration: 2000, useNativeDriver: true }),
        Animated.timing(orbScale, { toValue: 1,    duration: 2000, useNativeDriver: true }),
      ]),
    ).start();

    // Text fade + pop-in
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 18, friction: 7, useNativeDriver: true }),
    ]).start();

    // Each dot orbits continuously at its own speed
    DOTS.forEach((dot, i) => {
      Animated.loop(
        Animated.timing(dotAngle[i], {
          toValue:  1,
          duration: dot.period,
          useNativeDriver: true,
        }),
      ).start();
    });

    // Exit after 3 s
    const t = setTimeout(() => {
      Animated.timing(exitAnim, { toValue: 0, duration: 600, useNativeDriver: true }).start(
        () => onFinish(),
      );
    }, 3000);

    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[s.container, { opacity: exitAnim }]}>
      {/* Full-bleed background */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: BG }]} />

      {/* 5 orbiting dots */}
      {DOTS.map((dot, i) => {
        const { inp, xOut, yOut } = orbitKeyframes(dot.radius, dot.startAngle);
        const tx = dotAngle[i].interpolate({ inputRange: inp, outputRange: xOut });
        const ty = dotAngle[i].interpolate({ inputRange: inp, outputRange: yOut });
        return (
          <Animated.View
            key={i}
            style={[
              s.dot,
              {
                width:           dot.size,
                height:          dot.size,
                borderRadius:    dot.size / 2,
                backgroundColor: dot.color,
                left: ORB_CX - dot.size / 2,
                top:  ORB_CY - dot.size / 2,
                transform: [{ translateX: tx }, { translateY: ty }],
              },
            ]}
          />
        );
      })}

      {/* Soft glow behind orb */}
      <View
        style={[
          s.orbGlow,
          {
            left: ORB_CX - (ORB + 32) / 2,
            top:  ORB_CY - (ORB + 32) / 2,
            backgroundColor: ACCENT,
          },
        ]}
      />

      {/* Orb: breathing scale + aurora colour drift */}
      <Animated.View
        style={[
          s.orbWrap,
          {
            left: ORB_CX - ORB / 2,
            top:  ORB_CY - ORB / 2,
            transform: [{ scale: orbScale }],
          },
        ]}
      >
        <View style={s.orbClip}>
          <Animated.View
            style={[s.auroraSlide, { transform: [{ translateX: auroraX }] }]}
          >
            <LinearGradient
              colors={["#E2553D", "#5C4B96", "#1E8A7F", "#E2553D"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        </View>
      </Animated.View>

      {/* SACRA wordmark + tagline */}
      <Animated.View
        style={[
          s.textBlock,
          { top: ORB_CY + ORB / 2 + 36 },
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Text style={[s.title,   { color: TEXT_INK }]}>SACRA</Text>
        <Text style={[s.tagline, { color: ACCENT }]}>Find any prayer</Text>
      </Animated.View>

      {/* Bottom caption */}
      <Animated.Text style={[s.sub, { opacity: fadeAnim, color: TEXT_DIM }]}>
        many voices · one light
      </Animated.Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: "absolute",
    width,
    height,
    zIndex: 999,
  },
  dot: {
    position: "absolute",
    opacity: 0.85,
  },

  orbGlow: {
    position: "absolute",
    width:  ORB + 32,
    height: ORB + 32,
    borderRadius: (ORB + 32) / 2,
    opacity: 0.16,
  },

  orbWrap: {
    position: "absolute",
    width:  ORB,
    height: ORB,
  },

  orbClip: {
    width:  ORB,
    height: ORB,
    borderRadius: ORB / 2,
    overflow: "hidden",
    opacity: 0.96,
  },

  auroraSlide: {
    width:  ORB * 2,
    height: ORB,
  },

  textBlock: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  title: {
    fontFamily: "InstrumentSerif_400Regular",
    fontSize: 74,
    lineHeight: 74,
    letterSpacing: 1.5,
    includeFontPadding: false,
  },
  tagline: {
    fontFamily: "HankenGrotesk_700Bold",
    fontSize: 12,
    letterSpacing: 4.08,
    textTransform: "uppercase",
    marginTop: 14,
  },

  sub: {
    position: "absolute",
    bottom: 54,
    alignSelf: "center",
    fontFamily: "Newsreader_400Regular_Italic",
    fontSize: 17,
    letterSpacing: 0.3,
  },
});
