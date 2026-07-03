import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");

interface Props {
  onFinish: () => void;
}

// Splash always uses the light-mode cream background (matches the HTML design)
const BG       = "#FFFDF9";
const TEXT_INK = "#211B30";
const TEXT_DIM = "#8a7e6e";
const ACCENT   = "#E2553D";

// Orb dimensions
const ORB      = 130;
const ORB_CX   = width / 2;
const ORB_CY   = height / 2 - 95;

// 5 floating dots — positioned relative to orb center (matches splash.html)
const DOTS = [
  { color: "#3E6FB0", size: 15, dx: -88, dy: -48 },
  { color: "#E0A02E", size: 11, dx:  72, dy: -36 },
  { color: "#1E8A7F", size:  9, dx: -80, dy:  60 },
  { color: "#8E5BA6", size: 13, dx:  64, dy:  52 },
  { color: "#C24D52", size:  8, dx:  40, dy: -58 },
];

const FLOAT_PATTERNS = [
  { tx: 10, ty: -14 },
  { tx: -12, ty: 10 },
  { tx: 8,   ty: 12 },
  { tx: 10,  ty: -14 },
  { tx: 8,   ty: 12 },
];

export default function SplashScreen({ onFinish }: Props) {
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
      {/* Cream background */}
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

      {/* Soft coral glow behind orb (approximates filter: blur glow) */}
      <View
        style={[
          s.orbGlow,
          {
            left: ORB_CX - (ORB + 32) / 2,
            top:  ORB_CY - (ORB + 32) / 2,
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
        <Text style={s.title}>SACRA</Text>
        <Text style={s.tagline}>Find any prayer</Text>
      </Animated.View>

      {/* Bottom tagline */}
      <Animated.Text style={[s.sub, { opacity: fadeAnim }]}>
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

  // Soft coral bloom behind the orb
  orbGlow: {
    position: "absolute",
    width:  ORB + 32,
    height: ORB + 32,
    borderRadius: (ORB + 32) / 2,
    backgroundColor: ACCENT,
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
    color: TEXT_INK,
    letterSpacing: 1.5,
    includeFontPadding: false,
  },
  tagline: {
    fontFamily: "HankenGrotesk_700Bold",
    fontSize: 12,
    letterSpacing: 4.08,
    textTransform: "uppercase",
    color: ACCENT,
    marginTop: 14,
  },

  sub: {
    position: "absolute",
    bottom: 54,
    alignSelf: "center",
    fontFamily: "Newsreader_400Regular_Italic",
    fontSize: 17,
    color: TEXT_DIM,
    letterSpacing: 0.3,
  },
});
