// Design tokens from Claude Design
// Light palette (warm editorial cream) + Dark palette (deep warm black)

export const lightC = {
  bg: "#FBF7EF",
  bg2: "#F2EAD9",
  surface: "#FFFFFF",
  surface2: "#F7F0E4",
  line: "#EADFCC",
  hair: "rgba(40,30,55,0.07)",
  text: "#211B30",
  text2: "#6A6380",
  text3: "#A79FB0",
  accent: "#E2553D",
  accent2: "#5C4B96",
  accent3: "#1E8A7F",
  onacc: "#FFF6EF",
  shadow: "rgba(70,45,90,0.22)",
} as const;

export const darkC = {
  bg: "#141021",
  bg2: "#1B1530",
  surface: "#1F1934",
  surface2: "#282140",
  line: "#352E4E",
  hair: "rgba(255,255,255,0.06)",
  text: "#F4EFE6",
  text2: "#ABA4BD",
  text3: "#6E6784",
  accent: "#FF6E54",
  accent2: "#9C8BDB",
  accent3: "#3FB9AC",
  onacc: "#1A1326",
  shadow: "rgba(0,0,0,0.72)",
} as const;

export type ColorPalette = { [K in keyof typeof lightC]: string };

// Keep C as alias for lightC (used in module-scope places like SplashScreen before context loads)
export const C = lightC;

export const RELIGION_COLORS: Record<string, string> = {
  Christianity: "#E2553D",
  Islam: "#5C4B96",
  Judaism: "#E0A02E",
  Hinduism: "#FF6B35",
  Buddhism: "#3E6FB0",
  Sikhism: "#4C7CC4",
  Bahai: "#8E5BA6",
  Zoroastrianism: "#C24D52",
  Jainism: "#1E8A7F",
  Taoism: "#4A6741",
  Shinto: "#CC6A93",
  "Indigenous / Animist": "#9A7A52",
};

export const RELIGION_ICONS: Record<string, string> = {
  Christianity: "✝",
  Islam: "☪",
  Judaism: "✡",
  Hinduism: "ॐ",              // U+0950 Devanagari Om — plain text, no emoji presentation
  Buddhism: "☸︎",    // U+2638 + VS-15: force text (non-emoji) rendering on Android
  Sikhism: "☬",
  Bahai: "✷",
  Zoroastrianism: "𓄂",
  Jainism: "⊙",               // U+2299 Circled Dot — Jain concept of jiva (soul) at center of cosmos
  Taoism: "☯",
  Shinto: "⛩",
  "Indigenous / Animist": "𖦏",
};

export function getReligionColor(name: string): string {
  return RELIGION_COLORS[name] ?? lightC.accent;
}

export function getReligionIcon(name: string): string {
  return RELIGION_ICONS[name] ?? "◆";
}

export function getReligionTint(name: string): string {
  const col = getReligionColor(name);
  return col + "1F"; // ~12% opacity hex suffix
}

export const theme = {
  colors: {
    ink: lightC.bg,
    surface: lightC.surface,
    surface2: lightC.surface2,
    parchment: lightC.text,
    parchmentDim: lightC.text2,
    parchmentMuted: lightC.text3,
    gold: lightC.accent,
    goldLight: lightC.accent2,
    goldDim: lightC.hair,
    goldBorder: lightC.line,
    goldGlow: "rgba(226,85,61,0.07)",
    ember: lightC.accent,
    emberDim: "rgba(226,85,61,0.12)",
    sage: lightC.accent3,
    dust: lightC.text3,
  },
  fonts: {
    sans: "HankenGrotesk_400Regular",
    sansMed: "HankenGrotesk_500Medium",
    sansBold: "HankenGrotesk_700Bold",
    sansXBold: "HankenGrotesk_800ExtraBold",
    serif: "InstrumentSerif_400Regular",
    serifItalic: "InstrumentSerif_400Regular_Italic",
    body: "Newsreader_400Regular",
    bodyItalic: "Newsreader_400Regular_Italic",
  },
  radius: { card: 26, pill: 999, input: 14, icon: 13, tab: 24 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
} as const;
