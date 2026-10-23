/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        midnight: {
          sidebar: "#0C1829",
          canvas: "#142235",
          card: "#20354D",
          surface: "#172C45",
          inset: "#081C36",
          elevated: "#253F5C",
          hover: "#2A4768",
          border: "rgba(99, 165, 223, 0.22)",
          borderSubtle: "rgba(99, 165, 223, 0.12)",
          textPrimary: "#F2F7FF",
          textMuted: "#9FB3C9",
          cyan: "#46C8E5",
          cyanGlow: "rgba(70, 200, 229, 0.35)",
          violet: "#9B83F5",
          violetGlow: "rgba(155, 131, 245, 0.35)",
          green: "#33D6A6",
          amber: "#F6BA49",
          rose: "#F45B79",
          roseGlow: "rgba(244, 91, 121, 0.35)",
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        "midnight-card": "0 10px 30px -5px rgba(5, 15, 30, 0.6), 0 0 0 1px rgba(99, 165, 223, 0.18)",
        "midnight-card-hover": "0 14px 38px -5px rgba(5, 15, 30, 0.8), 0 0 0 1px rgba(70, 200, 229, 0.35)",
        "midnight-glow-cyan": "0 0 20px rgba(70, 200, 229, 0.25)",
        "midnight-glow-rose": "0 0 20px rgba(244, 91, 121, 0.25)",
        "midnight-glow-violet": "0 0 20px rgba(155, 131, 245, 0.25)",
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "20px",
      },
    },
  },
  plugins: [],
};
