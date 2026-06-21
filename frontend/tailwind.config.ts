import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#f3f6f4",
        panel: "#ffffff",
        border: "#dbe5df",
        primary: "#13795b",
        muted: "#64756e",
      },
      boxShadow: {
        glow: "0 14px 35px rgba(31, 65, 51, .10)",
      },
      animation: {
        pulseSlow: "pulse 2.5s ease-in-out infinite",
        car: "car 4s linear infinite",
      },
      keyframes: {
        car: {
          "0%": { transform: "translateY(120px)" },
          "100%": { transform: "translateY(-150px)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
