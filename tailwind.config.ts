import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";
import defaultTheme from "tailwindcss/defaultTheme";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "\"MiSans\"",
          "\"MiSans VF\"",
          "\"HarmonyOS Sans SC\"",
          "\"PingFang SC\"",
          "\"Hiragino Sans GB\"",
          "\"Noto Sans CJK SC\"",
          "\"Noto Sans SC\"",
          "\"Source Han Sans SC\"",
          "\"Microsoft YaHei\"",
          ...defaultTheme.fontFamily.sans,
        ],
        serif: [
          "\"Noto Serif SC\"",
          "\"Noto Serif CJK SC\"",
          "\"Source Han Serif SC\"",
          "\"Songti SC\"",
          "\"STSong\"",
          "\"SimSun\"",
          ...defaultTheme.fontFamily.serif,
        ],
        display: [
          "ui-serif",
          "\"Iowan Old Style\"",
          "Georgia",
          "Cambria",
          "\"Times New Roman\"",
          "\"Noto Serif SC\"",
          "\"Noto Serif CJK SC\"",
          "\"Source Han Serif SC\"",
          "\"Songti SC\"",
          "\"STSong\"",
          "\"SimSun\"",
          ...defaultTheme.fontFamily.serif,
        ],
      },
      colors: {
        accent: {
          DEFAULT: "hsl(var(--accent))",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px color-mix(in oklab, hsl(var(--accent)) 22%, hsl(var(--border))), 0 14px 40px rgba(0,0,0,.14)",
      },
    },
  },
  plugins: [typography],
} satisfies Config;
