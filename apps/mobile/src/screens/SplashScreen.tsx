import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { theme } from "../theme";

const { width, height } = Dimensions.get("window");
const BARS = 8;

interface Props {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const exitAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Mandala spin — continuous
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 20000,
        useNativeDriver: true,
      }),
    ).start();

    // Exit after 2.8 seconds
    const timer = setTimeout(() => {
      Animated.timing(exitAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start(() => onFinish());
    }, 2800);

    return () => clearTimeout(timer);
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Draw mandala lines as thin rotated views
  const mandalaLines = Array.from({ length: BARS }, (_, i) => (
    <Animated.View
      key={i}
      style={[
        s.mandalaLine,
        {
          transform: [{ rotate: `${(i * 180) / BARS}deg` }],
        },
      ]}
    />
  ));

  return (
    <Animated.View style={[s.container, { opacity: exitAnim }]}>
      {/* Background glow */}
      <View style={s.glow} />

      {/* Spinning mandala */}
      <Animated.View style={[s.mandala, { transform: [{ rotate: spin }] }]}>
        {mandalaLines}
        {/* Concentric circles */}
        {[140, 110, 80, 50, 22].map((r) => (
          <View
            key={r}
            style={[
              s.circle,
              {
                width: r * 2,
                height: r * 2,
                borderRadius: r,
                top: 140 - r,
                left: 140 - r,
              },
            ]}
          />
        ))}
      </Animated.View>

      {/* Content */}
      <Animated.View
        style={[
          s.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Text style={s.eyebrow}>A PORTFOLIO PROJECT FOR THE AGES</Text>
        <Text style={s.title}>SACRA</Text>
        <View style={s.ornament}>
          <View style={s.ornLine} />
          <Text style={s.ornDia}>✦</Text>
          <Text style={s.ornDia}>◆</Text>
          <Text style={s.ornDia}>✦</Text>
          <View style={s.ornLine} />
        </View>
        <Text style={s.subtitle}>The Shazam for Sacred Prayer</Text>
        <Text style={s.tagline}>Shazam × Scripture × AI</Text>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: "absolute",
    inset: 0,
    width,
    height,
    backgroundColor: theme.colors.ink,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  glow: {
    position: "absolute",
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: "rgba(201,168,76,0.07)",
    top: height / 2 - 200,
    left: width / 2 - 200,
  },
  mandala: {
    position: "absolute",
    width: 280,
    height: 280,
    top: height / 2 - 140,
    left: width / 2 - 140,
    alignItems: "center",
    justifyContent: "center",
  },
  mandalaLine: {
    position: "absolute",
    width: 280,
    height: 1,
    backgroundColor: "rgba(201,168,76,0.15)",
    top: 139,
    left: 0,
  },
  circle: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.12)",
  },
  content: {
    alignItems: "center",
    zIndex: 10,
  },
  eyebrow: {
    fontFamily: "System",
    fontSize: 8,
    letterSpacing: 4,
    color: theme.colors.gold,
    textTransform: "uppercase",
    marginBottom: 16,
    opacity: 0.8,
  },
  title: {
    fontSize: 72,
    fontWeight: "900",
    color: theme.colors.parchment,
    letterSpacing: -2,
    fontStyle: "italic",
  },
  ornament: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 16,
    width: 220,
  },
  ornLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.goldBorder,
  },
  ornDia: {
    fontSize: 10,
    color: theme.colors.gold,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.dust,
    fontStyle: "italic",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  tagline: {
    fontFamily: "System",
    fontSize: 10,
    letterSpacing: 3,
    color: theme.colors.ember,
    textTransform: "uppercase",
  },
});
