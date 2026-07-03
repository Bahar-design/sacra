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
  const orbDriftX = useRef(new Animated.Value(0)).current;
  const orbDriftY = useRef(new Animated.Value(0)).current;
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

    // Orb slow drift — gentle float across 12–15px
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(orbDriftX, { toValue: 14,  duration: 4200, useNativeDriver: true }),
          Animated.timing(orbDriftY, { toValue: -10, duration: 4200, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(orbDriftX, { toValue: -11, duration: 4800, useNativeDriver: true }),
          Animated.timing(orbDriftY, { toValue: 9,   duration: 4800, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(orbDriftX, { toValue: 0, duration: 4000, useNativeDriver: true }),
          Animated.timing(orbDriftY, { toValue: 0, duration: 4000, useNativeDriver: true }),
        ]),
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

      {/* Soft orb — stacked concentric circles simulate radial-gradient blur */}
      <Animated.View
        style={[
          s.softOrbWrap,
          {
            transform: [{ scale: orbScale }, { translateX: orbDriftX }, { translateY: orbDriftY }],
          },
        ]}
      >
        <View style={[s.softRing, { width: 340, height: 340, borderRadius: 170, opacity: isEvening ? 0.07 : 0.09, backgroundColor: "#C490C8" }]} />
        <View style={[s.softRing, { width: 280, height: 280, borderRadius: 140, opacity: isEvening ? 0.13 : 0.16, backgroundColor: "#9A70C4" }]} />
        <View style={[s.softRing, { width: 225, height: 225, borderRadius: 113, opacity: isEvening ? 0.24 : 0.28, backgroundColor: "#7B52A8" }]} />
        <View style={[s.softRing, { width: 172, height: 172, borderRadius: 86,  opacity: isEvening ? 0.40 : 0.46, backgroundColor: "#6848A0" }]} />
        <View style={[s.softRing, { width: 120, height: 120, borderRadius: 60,  opacity: isEvening ? 0.58 : 0.65, backgroundColor: "#7060B8" }]} />
        {/* Inner highlight spot — slightly offset up-left */}
        <View style={[s.softRing, { width: 64, height: 64, borderRadius: 32, opacity: isEvening ? 0.50 : 0.55, backgroundColor: "#D4BEF0",
          transform: [{ translateX: -14 }, { translateY: -16 }] }]} />
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

  // Soft orb — centered at the orb position, large enough for outermost ring (340px)
  softOrbWrap: {
    position: "absolute",
    width: 340,
    height: 340,
    left: width / 2 - 170,
    top: CTR_TOP + CONTAINER_H / 2 - 170,
    alignItems: "center",
    justifyContent: "center",
  },
  softRing: {
    position: "absolute",
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
