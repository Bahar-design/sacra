import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { lightC } from "../theme";

const { width, height } = Dimensions.get("window");

// Use the light palette directly — splash renders before ThemeContext loads
const C = lightC;

interface Props {
  onFinish: () => void;
}

// Five floating colored specks matching Claude Design
const DOTS = [
  { color: "#3E6FB0", size: 16, x: width / 2 - 85, y: height / 2 - 175 },
  { color: "#E0A02E", size: 13, x: width / 2 + 70, y: height / 2 - 158 },
  { color: "#1E8A7F", size: 11, x: width / 2 - 72, y: height / 2 + 52 },
  { color: "#8E5BA6", size: 15, x: width / 2 + 78, y: height / 2 + 33 },
  { color: "#C24D52", size: 9,  x: width / 2 + 38, y: height / 2 - 212 },
];

const ORB_SIZE = 130;
const GLOW_SIZE = ORB_SIZE + 70;

export default function SplashScreen({ onFinish }: Props) {
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(0.9)).current;
  const orbScale   = useRef(new Animated.Value(1)).current;
  const exitAnim   = useRef(new Animated.Value(1)).current;
  const dotAnims   = useRef(DOTS.map(() => new Animated.Value(0))).current;
  const glowAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Orb glow pulse (starts immediately)
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbScale, { toValue: 1.07, duration: 2200, useNativeDriver: true }),
        Animated.timing(orbScale, { toValue: 1,    duration: 2200, useNativeDriver: true }),
      ]),
    ).start();

    // Glow halo breathe
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ]),
    ).start();

    // Entrance: text fades + springs up
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 20, friction: 7, useNativeDriver: true }),
    ]).start();

    // Staggered dot floats
    dotAnims.forEach((anim, i) => {
      const dur    = 2000 + i * 350;
      const offset = i % 2 === 0 ? -12 : 12;
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: offset, duration: dur, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0,      duration: dur, useNativeDriver: true }),
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

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.85] });

  return (
    <Animated.View style={[s.container, { opacity: exitAnim }]}>
      {/* Floating colored dots */}
      {DOTS.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            s.dot,
            {
              width: dot.size,
              height: dot.size,
              borderRadius: dot.size / 2,
              backgroundColor: dot.color,
              left: dot.x,
              top: dot.y,
              transform: [{ translateY: dotAnims[i] }],
            },
          ]}
        />
      ))}

      {/* Aurora orb — layered colored glows */}
      <Animated.View style={[s.orbWrap, { transform: [{ scale: orbScale }] }]}>
        {/* Outer soft glow — terracotta */}
        <Animated.View style={[s.glowOuter, { opacity: glowOpacity }]} />
        {/* Mid glow — purple shift */}
        <View style={s.glowMid} />
        {/* Accent glow — teal */}
        <View style={s.glowTeal} />
        {/* Core orb */}
        <View style={s.orb} />
      </Animated.View>

      {/* Text block */}
      <Animated.View
        style={[
          s.content,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Text style={s.title}>SACRA</Text>
        <Text style={s.tagline}>Find any prayer</Text>
      </Animated.View>

      {/* Sub floats at the bottom third */}
      <Animated.Text style={[s.sub, { opacity: fadeAnim }]}>
        many voices  ·  one light
      </Animated.Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: "absolute",
    width,
    height,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  dot: {
    position: "absolute",
    opacity: 0.82,
  },

  // Aurora orb positioned above center
  orbWrap: {
    position: "absolute",
    top: height / 2 - 230,
    alignSelf: "center",
    width: ORB_SIZE,
    height: ORB_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  glowOuter: {
    position: "absolute",
    width: GLOW_SIZE + 30,
    height: GLOW_SIZE + 30,
    borderRadius: (GLOW_SIZE + 30) / 2,
    backgroundColor: "rgba(226,85,61,0.22)",
  },
  glowMid: {
    position: "absolute",
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    backgroundColor: "rgba(92,75,150,0.18)",
    top: 10,
    left: 20,
  },
  glowTeal: {
    position: "absolute",
    width: GLOW_SIZE - 20,
    height: GLOW_SIZE - 20,
    borderRadius: (GLOW_SIZE - 20) / 2,
    backgroundColor: "rgba(30,138,127,0.16)",
    top: -10,
    left: -15,
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    backgroundColor: C.accent,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 40,
    elevation: 20,
  },

  // Text block starts just below screen center
  content: {
    position: "absolute",
    top: height / 2 - 10,
    alignItems: "center",
  },
  title: {
    fontFamily: "InstrumentSerif_400Regular",
    fontSize: 74,
    lineHeight: 74,
    color: C.text,
    letterSpacing: 1.5,
  },
  tagline: {
    fontFamily: "HankenGrotesk_700Bold",
    fontSize: 12,
    letterSpacing: 4.08,
    textTransform: "uppercase",
    color: C.accent,
    marginTop: 14,
  },

  // Fixed 54px from bottom per Claude Design
  sub: {
    position: "absolute",
    bottom: 54,
    fontFamily: "Newsreader_400Regular_Italic",
    fontSize: 17,
    color: C.text3,
    letterSpacing: 0.3,
  },
});
