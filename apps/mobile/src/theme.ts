// Design tokens from Claude Design — warm editorial light-mode palette
// with full dark-mode variant and new font system

export const C = {
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
  Hinduism: "🕉",
  Buddhism: "☸",
  Sikhism: "☬",
  Bahai: "✷",
  Zoroastrianism: "𓄂",
  Jainism: "🪬",
  Taoism: "☯",
  Shinto: "⛩",
  "Indigenous / Animist": "𖦏",
};

export function getReligionColor(name: string): string {
  return RELIGION_COLORS[name] ?? C.accent;
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
    // kept for any legacy references; new code should use C directly
    ink: C.bg,
    surface: C.surface,
    surface2: C.surface2,
    parchment: C.text,
    parchmentDim: C.text2,
    parchmentMuted: C.text3,
    gold: C.accent,
    goldLight: C.accent2,
    goldDim: C.hair,
    goldBorder: C.line,
    goldGlow: "rgba(226,85,61,0.07)",
    ember: C.accent,
    emberDim: "rgba(226,85,61,0.12)",
    sage: C.accent3,
    dust: C.text3,
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
