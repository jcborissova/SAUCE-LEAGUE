// tailwind.config.cjs
/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: "class",
    content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
            colors: {
                border: "hsl(var(--border) / <alpha-value>)",
                input: "hsl(var(--input) / <alpha-value>)",
                ring: "hsl(var(--ring) / <alpha-value>)",
                background: "hsl(var(--background) / <alpha-value>)",
                foreground: "hsl(var(--foreground) / <alpha-value>)",
                primary: {
                  DEFAULT: "hsl(var(--primary) / <alpha-value>)",
                  foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
                },
                secondary: {
                  DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
                  foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
                },
                destructive: {
                  DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
                  foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
                },
                muted: {
                  DEFAULT: "hsl(var(--muted) / <alpha-value>)",
                  foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
                },
                accent: {
                  DEFAULT: "hsl(var(--accent) / <alpha-value>)",
                  foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
                },
                popover: {
                  DEFAULT: "hsl(var(--popover) / <alpha-value>)",
                  foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
                },
                card: {
                  DEFAULT: "hsl(var(--card) / <alpha-value>)",
                  foreground: "hsl(var(--card-foreground) / <alpha-value>)",
                },
            },
            borderRadius: {
              lg: "var(--radius)",
              md: "calc(var(--radius) - 2px)",
              sm: "calc(var(--radius) - 4px)",
            },
            fontFamily: {
              sans: ["'Space Grotesk'", "Inter", "system-ui", "-apple-system", "sans-serif"],
            },
            animation: {
              fadeIn: "fadeIn 0.2s ease-out",
            },
            keyframes: {
              fadeIn: {
                "0%": { opacity: 0, transform: "scale(0.95)" },
                "100%": { opacity: 1, transform: "scale(1)" },
              },
            },
          },
    },
    plugins: [],
  };
  
