import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Aliases map to CSS custom properties so the single-source-of-truth
        // stays in global.css :root — no magic hex values here.
        ink:      "var(--text-primary)",
        mist:     "var(--glass-surface)",
        accent:   "var(--accent-current)",    // teal #2DD4BF
        violet:   "var(--accent-violet)",     // #7C6AF0
        signal:   "var(--status-fail)",       // #F97066
        success:  "var(--status-success)",    // #34D399
        void:     "var(--bg-void)"            // #070A14
      },
      fontFamily: {
        display: "var(--font-display)",
        body:    "var(--font-body)"
      },
      borderRadius: {
        panel: "var(--radius-panel)",
        card:  "var(--radius-card)",
        pill:  "var(--radius-pill)"
      }
    }
  },
  plugins: []
} satisfies Config;

