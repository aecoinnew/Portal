import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./contexts/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#EEF2FB",
          100: "#D6DEF3",
          200: "#ADBDE7",
          300: "#7A93D6",
          400: "#4D6CC1",
          500: "#2A4DAB",
          600: "#163C9C",
          700: "#0B3D91",
          800: "#0A2A6B",
          900: "#061944"
        },
        gain: "#039855",
        loss: "#D92D20",
        gold: "#B0944D",
        sand: {
          50: "#FAF7F1",
          200: "#E2D7B8",
          400: "#B0944D"
        }
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"]
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(15,24,40,0.06), 0 1px 3px 0 rgba(15,24,40,0.04)"
      }
    }
  },
  plugins: []
};

export default config;
