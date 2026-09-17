import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        mist: "#edf2f6",
        accent: "#0f766e",
        signal: "#c2410c"
      }
    }
  },
  plugins: []
} satisfies Config;
