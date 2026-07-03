import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { lightC, darkC } from "../theme";

const { width, height } = Dimensions.get("window");

interface Props {
  onFinish: () => void;
}

// Time-based theme: evening (18:00–05:59) → dark, otherwise → light
const hour = new Date().getHours();
const isEvening = hour >= 18 || hour < 6;
const C = isEvening ? darkC : lightC;

// Stage background colors (approximate Claude Design's radial-gradient stage)
const STAGE_BASE  = isEvening ? "#141021" : "#FBF7EF";
const STAGE_TOP   = isEvening ? "#251c44" : "#FDEFE0";

// Orb container matches Claude Design: 230×200, centered, 26px gap above text
const CONTAINER_W = 230;
const CONTAINER_H = 200;
const CTR_LEFT = (width - CONTAINER_W) / 2;
const CTR_TOP  = height / 2 - 163;

const ORB_SIZE = 130;

// Floating dots — exact positions from Claude Design
const DOTS = [
  { color: "#3E6FB0", size: 16, x: CTR_LEFT + 30,  y: CTR_TOP + 24  },
  { color: "#E0A02E", size: 13, x: CTR_LEFT + 186, y: CTR_TOP + 40  },
  { color: "#1E8A7F", size: 11, x: CTR_LEFT + 40,  y: CTR_TOP + 170 },
  { color: "#8E5BA6", size: 15, x: CTR_LEFT + 179, y: CTR_TOP + 160 },
  { color: "#C24D52", size: 9,  x: CTR_LEFT + 157, y: CTR_TOP + 8   },
];

// Float animation patterns matching Claude Design scFloatA/B/C
const FLOAT_PATTERNS = [
  { tx: 10, ty: -14 },  // scFloatA
  { tx: -12, ty: 10 },  // scFloatB
  { tx: 8,  ty: 12  },  // scFloatC
  { tx: 10, ty: -14 },  // scFloatA again
  { tx: 8,  ty: 12  },  // scFloatC again
];

const DOT_DURATIONS = [5000, 6000, 5500, 6500, 5000];

export default function SplashScreen({ onFinish }: Props) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const orbScale  = useRef(new Animated.Value(1)).current;
  const exitAnim  = useRef(new Animated.Value(1)).current;
  const dotAnims  = useRef(DOTS.map(() => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
  }))).current;

  useEffect(() => {
    // Orb breathe — matches scBreathe 4s
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbScale, { toValue: 1.06, duration: 2000, useNativeDriver: true }),
        Animated.timing(orbScale, { toValue: 1,    duration: 2000, useNativeDriver: true }),
      ]),
    ).start();

    // Text entrance — fade + pop in
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 18, friction: 7, useNativeDriver: true }),
    ]).start();

    // Staggered dot floats — each dot has its own x+y target (matches scFloatA/B/C)
    dotAnims.forEach((anim, i) => {
      const { tx, ty } = FLOAT_PATTERNS[i];
      const dur = DOT_DURATIONS[i];
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

    // Exit after 3s
    const t = setTimeout(() => {
      Animated.timing(exitAnim, { toValue: 0, duration: 600, useNativeDriver: true }).start(
        () => onFinish(),
      );
    }, 3000);

    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[s.container, { opacity: exitAnim }]}>
      {/* Stage background — two-layer radial gradient approximation */}
      <View style={[s.stageBase, { backgroundColor: STAGE_BASE }]} />
      <View style={s.stageTop} pointerEvents="none" />

      {/* Floating colored dots */}
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
              left: dot.x,
              top:  dot.y,
              transform: [
                { translateX: dotAnims[i].x },
                { translateY: dotAnims[i].y },
              ],
            },
          ]}
        />
      ))}

      {/* Orb glow ring — separate from clip container so it bleeds out */}
      <Animated.View
        style={[
          s.orbGlowWrap,
          {
            left: (width - ORB_SIZE) / 2 - 40,
            top:  CTR_TOP + (CONTAINER_H - ORB_SIZE) / 2 - 40,
            transform: [{ scale: orbScale }],
          },
        ]}
      >
        <View style={s.orbGlow} />
      </Animated.View>

      {/* Orb — clip container so quadrant overlays conform to circle shape */}
      <Animated.View
        style={[
          s.orbWrap,
          {
            left: (width - ORB_SIZE) / 2,
            top:  CTR_TOP + (CONTAINER_H - ORB_SIZE) / 2,
            transform: [{ scale: orbScale }],
          },
        ]}
      >
        {/* Base orb — accent color */}
        <View style={[s.orb, { backgroundColor: C.accent }]} />
        {/* accent2 top-right quadrant overlay */}
        <View style={{
          position: "absolute",
          right: 0, top: 0,
          width: ORB_SIZE * 0.6, height: ORB_SIZE * 0.6,
          backgroundColor: C.accent2,
          opacity: 0.55,
        }} />
        {/* accent3 bottom-left quadrant overlay */}
        <View style={{
          position: "absolute",
          left: 0, bottom: 0,
          width: ORB_SIZE * 0.55, height: ORB_SIZE * 0.55,
          backgroundColor: C.accent3,
          opacity: 0.45,
        }} />
      </Animated.View>

      {/* Text block — entrance animation */}
      <Animated.View
        style={[
          s.content,
          { top: CTR_TOP + CONTAINER_H + 26 },
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Text style={s.title}>SACRA</Text>
        <Text style={s.tagline}>Find any prayer</Text>
      </Animated.View>

      {/* Bottom subtitle */}
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
  stageBase: {
    position: "absolute",
    inset: 0,
    top: 0, left: 0, right: 0, bottom: 0,
  },
  // Top radial bloom (lighter area at very top — approximates radial-gradient at 50% -8%)
  stageTop: {
    position: "absolute",
    top: 0,
    left: width * 0.1,
    right: width * 0.1,
    height: height * 0.45,
    borderBottomLeftRadius: width * 0.6,
    borderBottomRightRadius: width * 0.6,
    backgroundColor: STAGE_TOP,
    opacity: isEvening ? 0.55 : 0.45,
  },
  dot: {
    position: "absolute",
    opacity: 0.82,
  },

  orbGlowWrap: {
    position: "absolute",
    width: ORB_SIZE + 80,
    height: ORB_SIZE + 80,
  },
  orbGlow: {
    width: ORB_SIZE + 80,
    height: ORB_SIZE + 80,
    borderRadius: (ORB_SIZE + 80) / 2,
    backgroundColor: isEvening
      ? "rgba(255,110,84,0.16)"
      : "rgba(226,85,61,0.13)",
  },
  orbWrap: {
    position: "absolute",
    width: ORB_SIZE,
    height: ORB_SIZE,
    overflow: "hidden",
    borderRadius: ORB_SIZE / 2,
  },
  orb: {
    position: "absolute",
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
  },

  content: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  title: {
    fontFamily: "InstrumentSerif_400Regular",
    fontSize: 74,
    lineHeight: 74,
    color: C.text,
    letterSpacing: 1.5,
    includeFontPadding: false,
  },
  tagline: {
    fontFamily: "HankenGrotesk_700Bold",
    fontSize: 12,
    letterSpacing: 4.08,
    textTransform: "uppercase",
    color: C.accent,
    marginTop: 14,
  },

  sub: {
    position: "absolute",
    bottom: 54,
    alignSelf: "center",
    fontFamily: "Newsreader_400Regular_Italic",
    fontSize: 17,
    color: C.text3,
    letterSpacing: 0.3,
  },
});
