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

// Orb — nudged toward bottom-left so it doesn't sit dead-centre
const ORB    = 130;
const ORB_CX = width  / 2 - 40;
const ORB_CY = height / 2 - 35;

// 5 floating dots — spread wide to fill more of the screen
const DOTS = [
  { color: "#3E6FB0", size: 15, dx: -145, dy:  -90 },
  { color: "#E0A02E", size: 11, dx:  120, dy:  -75 },
  { color: "#1E8A7F", size:  9, dx: -125, dy:  115 },
  { color: "#8E5BA6", size: 13, dx:  105, dy:   98 },
  { color: "#C24D52", size:  8, dx:   60, dy: -115 },
];

const FLOAT_PATTERNS = [
  { tx: 10, ty: -14 },
  { tx: -12, ty: 10 },
  { tx: 8,   ty: 12 },
  { tx: 10,  ty: -14 },
  { tx: 8,   ty: 12 },
];

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
  // Aurora: slides a 2×-wide gradient left so the hue drifts across the orb
  const auroraX   = useRef(new Animated.Value(0)).current;
  const exitAnim  = useRef(new Animated.Value(1)).current;
  const dotAnims  = useRef(
    DOTS.map(() => ({ x: new Animated.Value(0), y: new Animated.Value(0) })),
  ).current;

  useEffect(() => {
    // Aurora sweep: 0 → -ORB px (one full colour cycle), 3.8 s per loop
    Animated.loop(
      Animated.timing(auroraX, {
        toValue: -ORB,
        duration: 3800,
        useNativeDriver: true,
      }),
    ).start();

    // Breathe: scale 1 ↔ 1.06, 4 s total
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

    // Staggered dot floats
    dotAnims.forEach((anim, i) => {
      const { tx, ty } = FLOAT_PATTERNS[i];
      const dur = 5000 + i * 500;
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(anim.x, { toValue: tx, duration: dur, useNativeDriver: true }),
            Animated.timing(anim.y, { toValue: ty, duration: dur, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(anim.x, { toValue: 0, duration: dur, useNativeDriver: true }),
            Animated.timing(anim.y, { toValue: 0, duration: dur, useNativeDriver: true }),
          ]),
        ]),
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
      {/* Full-bleed background — colour set by time-of-day theme */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: BG }]} />

      {/* 5 floating dots */}
      {DOTS.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            s.dot,
            {
              width:  dot.size,
              height: dot.size,
              borderRadius: dot.size / 2,
              backgroundColor: dot.color,
              left: ORB_CX + dot.dx - dot.size / 2,
              top:  ORB_CY + dot.dy - dot.size / 2,
              transform: [
                { translateX: dotAnims[i].x },
                { translateY: dotAnims[i].y },
              ],
            },
          ]}
        />
      ))}

      {/* Soft coral glow behind orb */}
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
        {/* Clip to circle */}
        <View style={s.orbClip}>
          {/* 2× wide gradient slides left for aurora hue-drift */}
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

      {/* Bottom tagline */}
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

  // Soft coral bloom behind the orb — colour overridden inline at runtime
  orbGlow: {
    position: "absolute",
    width:  ORB + 32,
    height: ORB + 32,
    borderRadius: (ORB + 32) / 2,
    backgroundColor: ACCENT_L,
    opacity: 0.16,
  },

  orbWrap: {
    position: "absolute",
    width:  ORB,
    height: ORB,
  },

  // Hard-clip to circle so gradient doesn't overflow
  orbClip: {
    width:  ORB,
    height: ORB,
    borderRadius: ORB / 2,
    overflow: "hidden",
    opacity: 0.96,
  },

  // 2× width so the aurora sweep has room to slide
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
    color: TEXT_INK_L,
    letterSpacing: 1.5,
    includeFontPadding: false,
  },
  tagline: {
    fontFamily: "HankenGrotesk_700Bold",
    fontSize: 12,
    letterSpacing: 4.08,
    textTransform: "uppercase",
    color: ACCENT_L,
    marginTop: 14,
  },

  sub: {
    position: "absolute",
    bottom: 54,
    alignSelf: "center",
    fontFamily: "Newsreader_400Regular_Italic",
    fontSize: 17,
    color: TEXT_DIM_L,
    letterSpacing: 0.3,
  },
});
