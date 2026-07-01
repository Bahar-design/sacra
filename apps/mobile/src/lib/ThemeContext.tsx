import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { lightC, darkC, ColorPalette } from "../theme";

interface ThemeContextType {
  C: ColorPalette;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  C: lightC,
  isDark: false,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [userPref, setUserPref] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("sacra_theme").then((val) => {
      if (val === "light" || val === "dark") setUserPref(val);
    });
  }, []);

  const isDark = userPref !== null ? userPref === "dark" : systemScheme === "dark";
  const C: ColorPalette = isDark ? darkC : lightC;

  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    setUserPref(next);
    AsyncStorage.setItem("sacra_theme", next);
  };

  return (
    <ThemeContext.Provider value={{ C, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
