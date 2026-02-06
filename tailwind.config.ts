import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
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
