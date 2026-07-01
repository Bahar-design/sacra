import { useRef, useEffect } from "react";
import { Animated, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../lib/ThemeContext";

export default function ThemeToggle() {
  const { C, isDark, toggleTheme } = useTheme();
  const knobAnim = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(knobAnim, {
      toValue: isDark ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [isDark]);

  const knobTranslate = knobAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 26],
  });

  return (
    <TouchableOpacity
      style={{
        width: 56,
        height: 30,
        borderRadius: 999,
        backgroundColor: C.surface2,
        borderWidth: 1,
        borderColor: C.line,
        justifyContent: "center",
        paddingHorizontal: 3,
      }}
      onPress={toggleTheme}
      activeOpacity={0.85}
    >
      <Animated.View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: C.surface,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.22,
          shadowRadius: 4,
          elevation: 3,
          transform: [{ translateX: knobTranslate }],
        }}
      >
        {/* ☼ = U+263C WHITE SUN WITH RAYS — no emoji variant, always text */}
        <Text style={{ position: "absolute", fontSize: 11, opacity: isDark ? 0 : 1, color: C.accent, lineHeight: 13 }}>
          {"☼"}
        </Text>
        {/* ☾ = U+263E LAST QUARTER MOON — waning crescent (C-shape), + FE0E text selector */}
        <Text style={{ position: "absolute", fontSize: 11, opacity: isDark ? 1 : 0, color: C.accent, lineHeight: 13 }}>
          {"☾︎"}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}
