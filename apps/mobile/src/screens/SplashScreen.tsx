import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";
import { C } from "../theme";

const { width, height } = Dimensions.get("window");

interface Props {
  onFinish: () => void;
}

// Floating colored dots matching the Claude Design aurora orb
const DOTS = [
  { color: "#3E6FB0", size: 16, left: width / 2 - 80, top: height / 2 - 110 },
  { color: "#E0A02E", size: 13, left: width / 2 + 60, top: height / 2 - 90 },
  { color: "#1E8A7F", size: 11, left: width / 2 - 65, top: height / 2 + 70 },
  { color: "#8E5BA6", size: 15, left: width / 2 + 55, top: height / 2 + 60 },
  { color: "#C24D52", size: 9, left: width / 2 + 30, top: height / 2 - 130 },
];

export default function SplashScreen({ onFinish }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const orbScale = useRef(new Animated.Value(1)).current;
  const exitAnim = useRef(new Animated.Value(1)).current;
  const dotAnims = useRef(DOTS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 18,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Orb breathe loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbScale, {
          toValue: 1.06,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(orbScale, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Floating dot animations — staggered loops
    dotAnims.forEach((anim, i) => {
      const duration = 2200 + i * 400;
      const offset = i % 2 === 0 ? -10 : 10;
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: offset,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });

    // Exit after 2.8s
    const timer = setTimeout(() => {
      Animated.timing(exitAnim, {
        toValue: 0,
        duration: 550,
        useNativeDriver: true,
      }).start(() => onFinish());
    }, 2800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[s.container, { opacity: exitAnim }]}>
      {/* Warm stage gradient approximation */}
      <View style={s.stage} />

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
              left: dot.left,
              top: dot.top,
              transform: [{ translateY: dotAnims[i] }],
            },
          ]}
        />
      ))}

      {/* Aurora orb */}
      <Animated.View
        style={[
          s.orbWrap,
          { transform: [{ scale: orbScale }] },
        ]}
      >
        {/* Glow halo */}
        <View style={s.orbGlow} />
        {/* Core orb */}
        <View style={s.orb} />
      </Animated.View>

      {/* Text content */}
      <Animated.View
        style={[
          s.content,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Text style={s.title}>SACRA</Text>
        <Text style={s.tagline}>Find any prayer</Text>
        <Text style={s.sub}>many voices  ·  one light</Text>
      </Animated.View>
    </Animated.View>
  );
}

const ORB_SIZE = 130;

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
  stage: {
    position: "absolute",
    inset: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.bg,
  },
  dot: {
    position: "absolute",
    opacity: 0.85,
  },
  orbWrap: {
    position: "absolute",
    top: height / 2 - 195,
    alignSelf: "center",
    width: ORB_SIZE,
    height: ORB_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  orbGlow: {
    position: "absolute",
    width: ORB_SIZE + 60,
    height: ORB_SIZE + 60,
    borderRadius: (ORB_SIZE + 60) / 2,
    backgroundColor: "rgba(226,85,61,0.18)",
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    backgroundColor: C.accent,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 36,
    elevation: 16,
  },
  content: {
    alignItems: "center",
    position: "absolute",
    top: height / 2 - 20,
  },
  title: {
    fontFamily: "InstrumentSerif_400Regular",
    fontSize: 74,
    lineHeight: 74,
    color: C.text,
    letterSpacing: 1,
  },
  tagline: {
    fontFamily: "HankenGrotesk_700Bold",
    fontSize: 12,
    letterSpacing: 4,
    textTransform: "uppercase",
    color: C.accent,
    marginTop: 14,
  },
  sub: {
    fontFamily: "Newsreader_400Regular_Italic",
    fontSize: 17,
    color: C.text3,
    position: "absolute",
    top: 160,
  },
});
