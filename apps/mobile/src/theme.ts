export const theme = {
  colors: {
    ink: "#0d0a08", // deepest background
    surface: "#130f0c", // card backgrounds
    surface2: "#1a1410", // elevated cards
    parchment: "#f5f0e8", // primary text
    parchmentDim: "#c8bea8", // secondary text
    parchmentMuted: "#7a6e5e", // hints, placeholders
    gold: "#c9a84c", // primary accent
    goldLight: "#e8d48a", // highlight gold
    goldDim: "rgba(201,168,76,0.15)",
    goldBorder: "rgba(201,168,76,0.25)",
    goldGlow: "rgba(201,168,76,0.07)",
    ember: "#b84a2e", // active/recording state
    emberDim: "rgba(184,74,46,0.12)",
    sage: "#4a6741", // success
    dust: "#8a7e6e", // captions, labels
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: 0, // sacred artifact = sharp corners
} as const;
