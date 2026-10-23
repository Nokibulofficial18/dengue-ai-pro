/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        midnight: {
          sidebar: "#070E1A",
          canvas: "#0B1524",
          card: "#101D30",
          surface: "#14243B",
          inset: "#08111D",
          elevated: "#192B45",
          hover: "#1D3252",
          border: "rgba(255, 255, 255, 0.08)",
          borderSubtle: "rgba(255, 255, 255, 0.05)",
          borderActive: "rgba(56, 189, 248, 0.35)",
          textPrimary: "#F8FAFC",
          textSecondary: "#CBD5E1",
          textMuted: "#94A3B8",
          textDim: "#64748B",
          cyan: "#38BDF8",
          cyanMuted: "rgba(56, 189, 248, 0.12)",
          green: "#10B981",
          greenMuted: "rgba(16, 185, 129, 0.12)",
          amber: "#F59E0B",
          amberMuted: "rgba(245, 158, 11, 0.12)",
          rose: "#F43F5E",
          roseMuted: "rgba(244, 63, 94, 0.12)",
          violet: "#818CF8",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        "subtle-card": "0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.2)",
        "elevated-card": "0 4px 20px -2px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.06)",
        "dropdown": "0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08)",
        "midnight-card": "0 4px 20px -2px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.07)",
        "midnight-card-hover": "0 8px 26px -4px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(56, 189, 248, 0.3)",
      },
      borderRadius: {
        "xl": "12px",
        "2xl": "16px",
      },
    },
  },
  plugins: [],
};
