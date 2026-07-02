import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { lightC } from "../theme";

const { width, height } = Dimensions.get("window");
const C = lightC;

interface Props {
  onFinish: () => void;
}

// Floating colored specks matching Claude Design positions (relative to 230×200 orb container)
const CONTAINER_W = 230;
const CONTAINER_H = 200;
// Container is centered horizontally; orb container top is ~163px above screen center
// (content block: 200 orb + 26 gap + ~80 title ≈ 306; offset = 306/2 - 0 = 153)
const CTR_LEFT = (width - CONTAINER_W) / 2;
const CTR_TOP  = height / 2 - 163;

const DOTS = [
  { color: "#3E6FB0", size: 16, x: CTR_LEFT + 30,          y: CTR_TOP + 24  },
  { color: "#E0A02E", size: 13, x: CTR_LEFT + 186,         y: CTR_TOP + 40  },
  { color: "#1E8A7F", size: 11, x: CTR_LEFT + 40,          y: CTR_TOP + 170 },
  { color: "#8E5BA6", size: 15, x: CTR_LEFT + 179,         y: CTR_TOP + 160 },
  { color: "#C24D52", size: 9,  x: CTR_LEFT + 157,         y: CTR_TOP + 8   },
];

const ORB_SIZE = 130;

export default function SplashScreen({ onFinish }: Props) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const orbScale  = useRef(new Animated.Value(1)).current;
  const exitAnim  = useRef(new Animated.Value(1)).current;
  const dotAnims  = useRef(DOTS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Orb breathe
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbScale, { toValue: 1.06, duration: 2000, useNativeDriver: true }),
        Animated.timing(orbScale, { toValue: 1,    duration: 2000, useNativeDriver: true }),
      ]),
    ).start();

    // Text entrance
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 18, friction: 7, useNativeDriver: true }),
    ]).start();

    // Staggered dot floats
    dotAnims.forEach((anim, i) => {
      const dur    = 2000 + i * 350;
      const offset = i % 2 === 0 ? -10 : 10;
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

  return (
    <Animated.View style={[s.container, { opacity: exitAnim }]}>

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
              transform: [{ translateY: dotAnims[i] }],
            },
          ]}
        />
      ))}

      {/* Orb — LinearGradient circle matching Claude Design gradient */}
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
        <View style={s.orb} />
        {/* Soft glow ring */}
        <View style={s.orbGlow} />
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
    backgroundColor: C.bg,
    zIndex: 999,
  },
  dot: {
    position: "absolute",
    opacity: 0.82,
  },

  orbWrap: {
    position: "absolute",
    width: ORB_SIZE,
    height: ORB_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    backgroundColor: C.accent,
  },
  orbGlow: {
    position: "absolute",
    width: ORB_SIZE + 60,
    height: ORB_SIZE + 60,
    borderRadius: (ORB_SIZE + 60) / 2,
    backgroundColor: "rgba(226,85,61,0.14)",
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
